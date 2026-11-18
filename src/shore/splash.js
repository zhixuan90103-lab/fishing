/**
 * A splash where something small hits the water: a crown of water, drops thrown up out
 * of it, and rings spreading on the surface.
 *
 * Owns: drawing one splash at a time, and its age.
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
import {
  DROPS, RINGS, SPLASH_LIFE, crownAt, dropAt, makeDrops, ringAt, sizeAt,
} from './splashBurst.js';

// Scene-linear colour of the spray. A little over white, because the post pass applies an
// exposure well under 1. Higher is whiter and harder against the water.
const COLOR = new THREE.Color(0xdcebf2).multiplyScalar(1.15);
// How much of the water shows through it, 0 solid to 1 nothing there, at the start.
const OPACITY = 0.5;
// It fades out over this last share of its life, on top of shrinking.
const FADE_OVER = 0.6;
// The crown is a ring of this many points, every other one standing taller. It flares:
// its lip is this many times as wide as its foot. The low points stand this share of
// the height.
const CROWN_POINTS = 14;
const CROWN_FLARE = 1.7;
const CROWN_DIP = 0.5;
// The rings ride this far above the still surface so the low swell does not cover them, metres.
const RING_LIFT = 0.025;
// Segments around a ring.
const RING_SEGMENTS = 40;

export function createSplash() {
  const object = new THREE.Group();
  object.name = 'splash';
  object.visible = false;

  const material = new THREE.MeshBasicMaterial({
    color: COLOR, transparent: true, opacity: OPACITY, depthWrite: false,
  });
  const flat = new THREE.MeshBasicMaterial({
    color: COLOR, transparent: true, opacity: OPACITY, depthWrite: false, side: THREE.DoubleSide,
  });

  const dropShape = new THREE.IcosahedronGeometry(1, 0);
  const drops = new THREE.InstancedMesh(dropShape, material, DROPS);
  drops.frustumCulled = false;
  drops.castShadow = false;
  object.add(drops);

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
  }
  const crown = new THREE.Mesh(crownShape, flat);
  crown.frustumCulled = false;
  crown.castShadow = false;
  object.add(crown);

  // Each ring is a strip of quads whose inner and outer edge are rewritten every frame.
  const rings = [];
  for (let r = 0; r < RINGS; r += 1) {
    const positions = new Float32Array((RING_SEGMENTS + 1) * 2 * 3);
    const index = [];
    for (let i = 0; i < RING_SEGMENTS; i += 1) {
      const a = i * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setIndex(index);
    const mesh = new THREE.Mesh(geometry, flat);
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    object.add(mesh);
    rings.push({ geometry, positions });
  }

  const table = makeDrops();
  const at = { x: 0, y: 0, z: 0, size: 0 };
  const ring = { radius: 0, width: 0 };
  const sheet = { radius: 0, height: 0 };
  const matrix = new THREE.Matrix4();
  // Where it is seen from, to size a far splash up.
  const eye = new THREE.Vector3();
  let age = SPLASH_LIFE;
  let strength = 0;

  function draw() {
    const fade = Math.min(1, (1 - age / SPLASH_LIFE) / FADE_OVER);
    material.opacity = OPACITY * fade;
    flat.opacity = OPACITY * fade;
    crownAt(age, strength, sheet);
    crown.visible = sheet.height > 0;
    crown.scale.set(sheet.radius, sheet.height, sheet.radius);
    for (let i = 0; i < DROPS; i += 1) {
      dropAt(table[i], age, strength, at);
      matrix.makeScale(at.size, at.size, at.size).setPosition(at.x, at.y, at.z);
      drops.setMatrixAt(i, matrix);
    }
    drops.instanceMatrix.needsUpdate = true;
    for (let r = 0; r < RINGS; r += 1) {
      ringAt(r, age, strength, ring);
      const inner = Math.max(0, ring.radius - ring.width * 0.5);
      const outer = ring.radius + ring.width * 0.5;
      const p = rings[r].positions;
      for (let i = 0; i <= RING_SEGMENTS; i += 1) {
        const a = (i / RING_SEGMENTS) * Math.PI * 2;
        const c = Math.cos(a);
        const s = Math.sin(a);
        const k = i * 6;
        p[k] = c * inner; p[k + 1] = RING_LIFT; p[k + 2] = s * inner;
        p[k + 3] = c * outer; p[k + 4] = RING_LIFT; p[k + 5] = s * outer;
      }
      rings[r].geometry.attributes.position.needsUpdate = true;
    }
  }

  return {
    object,
    // True while a splash is still playing.
    get active() {
      return age < SPLASH_LIFE;
    },

    // Where the splash is looked at from, world space. One far away is drawn larger.
    seenFrom(position) {
      eye.copy(position);
    },

    // Start a splash on the surface at (x, z). strength 0 to 1: how hard it hit. A new
    // one replaces any still playing.
    burst(x, z, hit = 1) {
      object.position.set(x, 0, z);
      object.scale.setScalar(sizeAt(Math.hypot(x - eye.x, eye.y, z - eye.z)));
      // Each splash is the same crown turned a different way.
      object.rotation.y = (x * 12.9898 + z * 78.233) % (Math.PI * 2);
      strength = Math.max(0, Math.min(1, hit));
      age = 0;
      object.visible = true;
      draw();
    },

    // Once a frame.
    update(dt) {
      if (age >= SPLASH_LIFE) return;
      age += dt;
      if (age >= SPLASH_LIFE) {
        object.visible = false;
        return;
      }
      draw();
    },

    dispose() {
      dropShape.dispose();
      crownShape.dispose();
      for (const r of rings) r.geometry.dispose();
      material.dispose();
      flat.dispose();
    },
  };
}
