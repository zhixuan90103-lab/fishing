/**
 * The spray thrown by something cutting along the water.
 *
 * Owns: drawing that.
 * Does not own: how fast the thing is, which way it goes or where its drops are
 * (wakeTrack.js), what is making it (the caller leads it: track.follow), or the sea. The
 * ocean's look is settled and is not touched: this is geometry laid on top.
 * Design: docs/SPLASH.md section 8.
 *
 * It is see-through, so like the splash it goes in the scene startShore.js draws after
 * the water. It tests depth and writes none.
 * Tried and taken out: a V of two flat strips on the surface trailing behind the thing.
 *
 * World space.
 */

import * as THREE from 'three/webgpu';
import { createSprayMaterial } from './sprayMaterial.js';
import { createWakeTrack } from './wakeTrack.js';

// A drop of spray is this big across at its start, m.
const DROP = 0.012;
// Standing still it is this many times as long as it is wide, and STREAKS more for each
// m/s it is making.
const DROP_LONG = 1.4;
const STREAKS = 0.9;

/** size: how big it is drawn against a line's own spray, which is 1. drops: spray in the air at once. */
export function createWake(size = 1, drops = 32, rings = null) {
  const track = createWakeTrack(drops, Math.random, rings);
  // What it looks like is the spray's (sprayMaterial.js), the same as a splash's.
  const material = createSprayMaterial(false, true);
  const spray = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), material.material, drops);
  spray.name = 'wake';
  spray.frustumCulled = false;
  spray.castShadow = false;
  spray.visible = false;
  const matrix = new THREE.Matrix4();
  const along = new THREE.Vector3();
  const upright = new THREE.Vector3(0, 1, 0);
  const turned = new THREE.Quaternion();
  const where = new THREE.Vector3();
  const sized = new THREE.Vector3();

  return {
    object: spray,
    // What leads it: follow(dt, x, z, share) while the thing is on the surface, lift(dt) when not.
    track,

    // Once a frame, after the track has been led.
    update() {
      let any = false;
      for (let i = 0; i < drops; i += 1) {
        const d = track.drops[i];
        const r = d.left > 0 ? DROP * size * (0.5 + 0.5 * d.left) : 0;
        if (r > 0) any = true;
        // Drawn out along its way: a round drop with a bright rim reads as a bubble.
        const speed = Math.hypot(d.vx, d.vy, d.vz);
        if (speed > 1e-6) turned.setFromUnitVectors(upright, along.set(d.vx / speed, d.vy / speed, d.vz / speed));
        else turned.identity();
        matrix.compose(where.set(d.x, d.y, d.z), turned, sized.set(r, r * (DROP_LONG + STREAKS * speed), r));
        spray.setMatrixAt(i, matrix);
      }
      spray.instanceMatrix.needsUpdate = true;
      spray.visible = any;
    },

    dispose() {
      spray.geometry.dispose();
      material.dispose();
    },
  };
}
