/**
 * The wake of something cutting along the water: a V on the surface trailing behind it,
 * and the spray it throws.
 *
 * Owns: drawing that.
 * Does not own: how strong it is, which way it points or where its drops are
 * (wakeTrack.js), what is making it (the caller leads it: track.follow), or the sea. The
 * ocean's look is settled and is not touched: this is geometry laid on top.
 * Design: docs/SPLASH.md.
 *
 * It is see-through, so like the splash it goes in the scene startShore.js draws after
 * the water. It tests depth and writes none.
 *
 * World space.
 */

import * as THREE from 'three/webgpu';
import { createWakeTrack } from './wakeTrack.js';

// Scene-linear colour, a little over white: the post pass applies an exposure well under 1.
const COLOR = new THREE.Color(0xdcebf2).multiplyScalar(1.15);
// How solid the V is at its strongest, and the spray.
const OPACITY = 0.42;
// The V: half the angle between its arms, radians. How long an arm is at its faintest and
// how much longer at its strongest, m. How wide an arm is at the point and at its end, m.
const HALF_ANGLE = 21 * Math.PI / 180;
const ARM = [0.25, 1.1];
const WIDTH = [0.012, 0.06];
// It rides this far above the still surface so the low swell does not cover it, m.
const LIFT = 0.025;
// A drop of spray is this big across at its start, m.
const DROP = 0.022;

/** size: how big it is drawn against a line's own wake, which is 1. drops: spray in the air at once. */
export function createWake(size = 1, drops = 32) {
  const track = createWakeTrack(drops);
  const object = new THREE.Group();
  object.name = 'wake';
  object.visible = false;

  const flat = new THREE.MeshBasicMaterial({ color: COLOR, transparent: true, opacity: OPACITY, depthWrite: false, side: THREE.DoubleSide });
  const solid = new THREE.MeshBasicMaterial({ color: COLOR, transparent: true, opacity: OPACITY, depthWrite: false });

  // Two arms, each a strip of four points: two at the point of the V, two at its end.
  const positions = new Float32Array(8 * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex([0, 1, 2, 2, 1, 3, 4, 5, 6, 6, 5, 7]);
  const vee = new THREE.Mesh(geometry, flat);
  vee.frustumCulled = false;
  object.add(vee);

  const spray = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), solid, drops);
  spray.frustumCulled = false;
  spray.castShadow = false;
  object.add(spray);
  const matrix = new THREE.Matrix4();

  // One arm of the V into the strip starting at point `at`: back from where the thing is,
  // off to one side of the way it came.
  function arm(at, turn, length) {
    const c = Math.cos(turn);
    const s = Math.sin(turn);
    // Backward, turned by `turn` about the upright.
    const bx = -(track.dirX * c - track.dirZ * s);
    const bz = -(track.dirZ * c + track.dirX * s);
    const sx = -bz;
    const sz = bx;
    const near = WIDTH[0] * size * 0.5;
    const wide = WIDTH[1] * size * 0.5;
    const ex = track.x + bx * length;
    const ez = track.z + bz * length;
    positions.set([track.x + sx * near, LIFT, track.z + sz * near, track.x - sx * near, LIFT, track.z - sz * near, ex + sx * wide, LIFT, ez + sz * wide, ex - sx * wide, LIFT, ez - sz * wide], at * 3);
  }

  return {
    object,
    // What leads it: follow(dt, x, z, share) while the thing is on the surface, lift(dt) when not.
    track,

    // Once a frame, after the track has been led.
    update() {
      let any = false;
      for (let i = 0; i < drops; i += 1) {
        const d = track.drops[i];
        const r = d.left > 0 ? DROP * size * (0.5 + 0.5 * d.left) : 0;
        if (r > 0) any = true;
        matrix.makeScale(r, r, r).setPosition(d.x, d.y, d.z);
        spray.setMatrixAt(i, matrix);
      }
      spray.instanceMatrix.needsUpdate = true;
      object.visible = any || track.strength > 0.01;
      if (!object.visible) return;
      const length = (ARM[0] + (ARM[1] - ARM[0]) * track.strength) * size;
      arm(0, HALF_ANGLE, length);
      arm(4, -HALF_ANGLE, length);
      geometry.attributes.position.needsUpdate = true;
      flat.opacity = OPACITY * track.strength;
    },

    dispose() {
      geometry.dispose();
      spray.geometry.dispose();
      flat.dispose();
      solid.dispose();
    },
  };
}
