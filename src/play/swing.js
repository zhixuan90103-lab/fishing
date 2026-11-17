/**
 * How hard the rod is being swung, and how far that throws the lure.
 *
 * Owns: how fast the aim is tipping forward, the best of the last moment, and the
 * speed-to-distance table of a cast.
 * Does not own: the phone or the aim (phoneLook.js, aim.js), when a cast may start, or the
 * lure's flight (lureMove.js).
 * No Three, no scene: it runs in Node. Rule: docs/FISHING-REQUIREMENTS.md sections 5, 6.
 *
 * The swing is read at the hand, not at the rod tip. The blank is soft: in a quick flick
 * the tip hangs back and then springs through, so its speed says more about the blank
 * than about the throw, and a 220°/s flick moves the tip forward at barely 1 m/s.
 *
 * The rate is not a difference of two frames. A value chases the aim's pitch, and how far
 * it trails is the rate: steady, and the same at any frame rate.
 */

import { chaseAngle as chase } from '../shore/phoneLook.js';

// How closely the trailing value follows the pitch, 1/s. The rate read is about
// 1 / TRAIL_RATE seconds old. Lower is steadier and later.
const TRAIL_RATE = 18;
// A release a little after the fastest part of the swing still gets most of it: the best
// rate fades at this speed, 1/s. Lower forgives a later release.
const BEST_FADE = 4;
// Forward tipping rate, degrees per second. Below SWING_MIN a release is not a cast and
// the line stays in. At SWING_FULL and above the lure goes the full distance.
export const SWING_MIN = 90;
export const SWING_FULL = 420;
// Nearest and furthest a cast lands from under the tip, metres.
export const REACH_MIN = 6;
export const REACH_MAX = 28;

export function createSwing() {
  let trail = 0;
  let last = 0;
  let best = 0;
  let started = false;

  return {
    // Forget the swing so far. The next step starts from rest at whatever pitch it is given.
    reset() {
      started = false;
      best = 0;
    },

    // Once a frame with the aim's pitch, degrees, positive upward. Tipping forward is the
    // pitch coming down. Returns the best recent forward rate, degrees per second.
    step(dt, pitch) {
      if (!(dt > 0)) return best;
      if (!started) {
        trail = last = pitch;
        started = true;
      }
      trail = chase(trail, pitch, last, TRAIL_RATE, dt);
      last = pitch;
      best = Math.max(TRAIL_RATE * (trail - pitch), best * Math.exp(-BEST_FADE * dt));
      return best;
    },
  };
}

// How far a release at this forward rate throws the lure, metres. 0: not a cast.
export function castReach(rate) {
  if (rate < SWING_MIN) return 0;
  const t = Math.min(1, (rate - SWING_MIN) / (SWING_FULL - SWING_MIN));
  return REACH_MIN + (REACH_MAX - REACH_MIN) * t * t * (3 - 2 * t);
}
