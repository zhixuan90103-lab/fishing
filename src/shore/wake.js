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
import { createWakeTrack } from './wakeTrack.js';

// Scene-linear colour, a little over white: the post pass applies an exposure well under 1.
const COLOR = new THREE.Color(0xdcebf2).multiplyScalar(1.15);
const OPACITY = 0.42;
// A drop of spray is this big across at its start, m.
const DROP = 0.022;

/** size: how big it is drawn against a line's own spray, which is 1. drops: spray in the air at once. */
export function createWake(size = 1, drops = 32, rings = null) {
  const track = createWakeTrack(drops, Math.random, rings);
  const material = new THREE.MeshBasicMaterial({ color: COLOR, transparent: true, opacity: OPACITY, depthWrite: false });
  const spray = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), material, drops);
  spray.name = 'wake';
  spray.frustumCulled = false;
  spray.castShadow = false;
  spray.visible = false;
  const matrix = new THREE.Matrix4();

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
        matrix.makeScale(r, r, r).setPosition(d.x, d.y, d.z);
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
