/**
 * The splash where something goes into the water or is drawn up out of it: a crown, the
 * column that jumps up in the middle, and drops. The rings on the water are the water's
 * own (ripples.js); a drop that falls back in is reported, so that it can make one.
 *
 * Owns: drawing a few splashes at a time, and the age of each.
 * Does not own: the shape over time (splashBurst.js), when one happens (the caller), or
 * the sea. The ocean's look is settled and is not touched: this is geometry laid on top.
 * Design: docs/SPLASH.md.
 *
 * It is see-through, so it must be drawn after the water, not in the main scene. The
 * water is drawn over the main scene: anything see-through in there is blended with the
 * sea bed first and then left as a hole in the water. `object` goes in the scene that
 * startShore.js draws after the water. It tests depth, so the rod still covers it, and
 * writes none.
 *
 * World space.
 */

import * as THREE from 'three/webgpu';
import { createSprayMaterial, placeDrop } from './sprayMaterial.js';
import {
  DROPS, bigOf, columnAt, crownAt, dropAt, landsAt, lifeOf, makeDrops, sizeAt,
} from './splashBurst.js';

// It fades out over this last share of its life, on top of shrinking.
const FADE_OVER = 0.6;
// The crown is a ring of this many points, every other one standing taller. It flares:
// its lip is this many times as wide as its foot. The low points stand this share of
// the height.
const CROWN_POINTS = 14;
const CROWN_FLARE = 1.7;
const CROWN_DIP = 0.5;
// The column is a round spike of this many sides, its top this share as wide as its foot.
const COLUMN_SIDES = 10;
const COLUMN_TOP = 0.25;
// How many splashes there can be at once. One more takes the place of the oldest.
const AT_ONCE = 4;
// A drop that falls back in hits the water this hard, for a splash of size 1, and as a
// thing of this weight, kg: a ring a hand's breadth across.
const DROP_HITS = 0.14;
const DROP_KG = 0.001;

/**
 * landed(x, z, strength, weight): called when a drop that makes a ring falls back into
 * the water, optional.
 */
export function createSplash(landed = null) {
  const object = new THREE.Group();
  object.name = 'splash';

  const dropShape = new THREE.IcosahedronGeometry(1, 1);
  // The crown: a flared sheet with a jagged lip, one unit tall on a foot of radius one.
  // It is scaled to the size crownAt gives.
  const crownShape = new THREE.BufferGeometry();
  {
    const p = [];
    const index = [];
    for (let i = 0; i <= CROWN_POINTS; i += 1) {
      const a = (i / CROWN_POINTS) * Math.PI * 2;
      const tall = i % 2 === 0 ? 1 : CROWN_DIP;
      p.push(Math.cos(a), 0, Math.sin(a));
      p.push(Math.cos(a) * (1 + (CROWN_FLARE - 1) * tall), tall, Math.sin(a) * (1 + (CROWN_FLARE - 1) * tall));
      if (i < CROWN_POINTS) {
        const k = i * 2;
        index.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
      }
    }
    crownShape.setAttribute('position', new THREE.BufferAttribute(new Float32Array(p), 3));
    crownShape.setIndex(index);
    crownShape.computeVertexNormals();
  }
  // The column: a spike one unit tall on a foot of radius one, its foot on the water.
  const columnShape = new THREE.CylinderGeometry(COLUMN_TOP, 1, 1, COLUMN_SIDES, 1, false);
  columnShape.translate(0, 0.5, 0);

  const tables = { in: makeDrops('in'), out: makeDrops('out'), thrash: makeDrops('thrash') };
  const at = { x: 0, y: 0, z: 0, size: 0, vx: 0, vy: 0, vz: 0 };
  const sheet = { radius: 0, height: 0 };
  const matrix = new THREE.Matrix4();
  // Where it is seen from, to size a far splash up.
  const eye = new THREE.Vector3();

  // One splash: its own crown, column and drops, so that several can go on at once.
  const splashes = Array.from({ length: AT_ONCE }, () => {
    const group = new THREE.Group();
    group.visible = false;
    // What it looks like is the spray's (sprayMaterial.js): the sheet is seen from both sides.
    const material = createSprayMaterial();
    const flat = createSprayMaterial(true);
    const speck = createSprayMaterial(false, true);
    const drops = new THREE.InstancedMesh(dropShape, speck.material, DROPS);
    const crown = new THREE.Mesh(crownShape, flat.material);
    const column = new THREE.Mesh(columnShape, material.material);
    for (const mesh of [drops, crown, column]) {
      mesh.frustumCulled = false;
      mesh.castShadow = false;
      group.add(mesh);
    }
    object.add(group);
    return { group, material, flat, speck, drops, crown, column, kind: 'in', age: Infinity, life: 0, big: 0, done: new Array(DROPS).fill(true) };
  });

  function draw(one) {
    const fade = Math.min(1, (1 - one.age / one.life) / FADE_OVER);
    one.material.setFade(fade);
    one.flat.setFade(fade);
    one.speck.setFade(fade);
    crownAt(one.kind, one.age, one.big, sheet);
    one.crown.visible = sheet.height > 0;
    one.crown.scale.set(sheet.radius, sheet.height, sheet.radius);
    columnAt(one.kind, one.age, one.big, sheet);
    one.column.visible = sheet.height > 0;
    one.column.scale.set(sheet.radius, sheet.height, sheet.radius);
    const table = tables[one.kind];
    for (let i = 0; i < DROPS; i += 1) {
      dropAt(table[i], one.age, one.big, at);
      placeDrop(matrix, at.x, at.y, at.z, at.vx, at.vy, at.vz, at.size);
      one.drops.setMatrixAt(i, matrix);
      // A drop that has fallen back in: say so, once, where it came down.
      if (!one.done[i] && one.age >= landsAt(table[i], one.big)) {
        one.done[i] = true;
        if (landed && table[i].rings) {
          const turn = one.group.rotation.y;
          const scale = one.group.scale.x;
          const c = Math.cos(turn);
          const s = Math.sin(turn);
          landed(one.group.position.x + (at.x * c + at.z * s) * scale, one.group.position.z + (at.z * c - at.x * s) * scale, DROP_HITS * one.big, DROP_KG);
        }
      }
    }
    one.drops.instanceMatrix.needsUpdate = true;
  }

  function start(kind, x, z, strength, weight) {
    let one = splashes.find((it) => !(it.age < it.life));
    if (!one) one = splashes.reduce((oldest, it) => (it.age > oldest.age ? it : oldest));
    one.kind = kind;
    one.group.position.set(x, 0, z);
    one.group.scale.setScalar(sizeAt(Math.hypot(x - eye.x, eye.y, z - eye.z)));
    // Each splash is the same one turned a different way.
    one.group.rotation.y = (x * 12.9898 + z * 78.233) % (Math.PI * 2);
    one.big = bigOf(strength, weight, kind);
    one.life = lifeOf(kind);
    one.age = 0;
    one.done.fill(false);
    one.group.visible = true;
    draw(one);
  }

  return {
    object,
    // True while any splash is still playing.
    get active() {
      return splashes.some((it) => it.age < it.life);
    },

    // Where the splashes are looked at from, world space. One far away is drawn larger.
    seenFrom(position) {
      eye.copy(position);
    },

    // Something went into the water at (x, z). strength 0 to 1: how hard it hit.
    // weight: of the thing, kg.
    burst(x, z, strength = 1, weight) {
      start('in', x, z, strength, weight);
    },

    // Something was drawn up out of the water at (x, z). strength 0 to 1: how much water
    // it brings with it. weight: of what comes through, kg.
    breach(x, z, strength = 1, weight) {
      start('out', x, z, strength, weight);
    },

    // A fish thrashing at the top of the water at (x, z) threw it about. strength 0 to
    // 1: how hard. weight: of what struck the water, kg.
    thrash(x, z, strength = 1, weight) {
      start('thrash', x, z, strength, weight);
    },

    // Once a frame.
    update(dt) {
      for (const one of splashes) {
        if (!(one.age < one.life)) continue;
        one.age += dt;
        if (one.age >= one.life) {
          one.group.visible = false;
          continue;
        }
        draw(one);
      }
    },

    dispose() {
      dropShape.dispose();
      crownShape.dispose();
      columnShape.dispose();
      for (const one of splashes) {
        one.material.dispose();
        one.flat.dispose();
        one.speck.dispose();
      }
    },
  };
}
