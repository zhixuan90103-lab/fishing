/**
 * The spray thrown by something cutting along the water.
 *
 * Owns: putting that spray in the air: for each drop the wake throws, a drop and the
 * white water torn off with it.
 * Does not own: how fast the thing is, which way it goes or when it throws a drop
 * (wakeTrack.js), what is making it (the caller leads it: track.follow), what water in
 * the air looks like (sprayPool.js), or the sea.
 * Design: docs/SPLASH.md section 8.
 *
 * It draws nothing itself: it throws into the pool it is given, which startShore.js
 * draws after the water.
 * Tried and taken out: a V of two flat strips on the surface trailing behind the thing;
 * and drawing each drop as a ball drawn out long (until 2026-11-25: a string of beads).
 *
 * World space.
 */

import { DROP, WATER } from './sprayPool.js';
import { createWakeTrack } from './wakeTrack.js';

// A drop of spray is this big, m, radius, and lasts this long, s. The air hardly slows it.
const DROP_SIZE = 0.0035;
const DROP_LIFE = 0.42;
const DROP_DRAG = 0.02;
// With each drop this many clots of white water are torn off, this big, m. They go the
// same way at between these shares of its speed, and the air stops them soon, 1/s.
const CLOTS = 3;
const CLOT_SIZE = 0.011;
const CLOT_SPEED = [0.35, 0.9];
const CLOT_LIFE = 0.3;
const CLOT_DRAG = 3.2;

/** size: how big it is drawn against a line's own spray, which is 1. drops: spray in the air at once. pool: sprayPool.js. */
export function createWake(size = 1, drops = 32, rings = null, pool = null) {
  const track = createWakeTrack(drops, Math.random, rings);
  // How much of its life each of the track's drops had left last frame: one with more
  // now than then has just been thrown.
  const had = new Float32Array(drops);

  return {
    // What leads it: follow(dt, x, z, share) while the thing is on the surface, lift(dt) when not.
    track,

    // Once a frame, after the track has been led.
    update() {
      for (let i = 0; i < drops; i += 1) {
        const d = track.drops[i];
        if (pool && d.left > had[i] + 0.2) {
          pool.throw(d.x, d.y, d.z, d.vx, d.vy, d.vz, DROP_SIZE * size, DROP_LIFE, DROP, DROP_DRAG);
          for (let k = 0; k < CLOTS; k += 1) {
            const share = CLOT_SPEED[0] + (CLOT_SPEED[1] - CLOT_SPEED[0]) * Math.random();
            pool.throw(d.x, d.y, d.z, d.vx * share, d.vy * share, d.vz * share, CLOT_SIZE * size * (0.7 + 0.6 * Math.random()), CLOT_LIFE, WATER, CLOT_DRAG);
          }
        }
        had[i] = d.left;
      }
    },
  };
}
