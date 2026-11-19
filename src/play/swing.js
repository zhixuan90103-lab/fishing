/**
 * How fast the rod tip is carrying the lure, and how far a lure let go at that speed flies.
 *
 * Owns: reading the tip's speed, the best of the last moment, and what speed throws how far.
 * Does not own: the phone or the aim (phoneLook.js, aim.js), the rod and how its blank
 * whips (rodFlex.js), when a cast may start, which way it goes, or the lure's flight
 * (lureMove.js).
 * No Three, no scene: it runs in Node. Rule: docs/FISHING-REQUIREMENTS.md sections 5, 6.
 * Design: docs/PLAY.md section 4, docs/CHAIN.md.
 *
 * The lure is at the rod tip until it is let go, so it leaves at the tip's speed. That is
 * all a cast's strength is: the hand swings the grip, the blank whips, the tip carries
 * the lure, and the speed it has at the release is the speed the lure flies off at. No
 * table stands between the swing and the distance. How fast is the tip's own. Which way
 * is the view's, fixed. How high it leaves goes by how high the rod is when it lets go:
 * stopped high, the lure is lobbed, followed through low, it is driven flat.
 *
 * The lure does not leave a tip that is still speeding up. The blank loads before it
 * throws: the hand is half way through its swing before the tip has got going, and a
 * finger lifted then would let the lure go at next to nothing. So the caller holds the
 * lure at the tip until the tip's speed has stopped rising (fishing.js), and reads it then.
 *
 * The speed is not a difference of two frames. A point chases the tip, and how far it
 * trails is the speed: steady, and the same at any frame rate.
 */

import { LAUNCH_ANGLE } from '../shore/lureMove.js';

const GRAVITY = 9.81;
// How closely the trailing point follows the tip, 1/s. The speed read is about
// 1 / TRAIL_RATE seconds old, and that much of a swing's sharpest moment is smoothed off.
const TRAIL_RATE = 18;
// A release a little after the fastest part of the swing still gets most of it: the best
// speed fades at this rate, 1/s. Lower forgives a later release. At 4 a release 0.15 s
// late read half its swing, and a hard cast that was let go a moment late fell short.
const BEST_FADE = 2.5;
// A tip slower than this, m/s, throws nothing: the release is not a cast and the line
// stays in. An unhurried tilt of the phone is about half this.
export const SPEED_MIN = 4.6;
// The share of its flight in still air that a lure on a line makes: the air and the line
// it drags hold it back. Lower and every cast lands shorter.
const CARRY = 0.8;
// The furthest a cast goes, metres: the most this lure and line will carry.
export const REACH_MAX = 28;
// The tip speed that throws that far at the usual angle, m/s.
export const SPEED_FULL = Math.sqrt((REACH_MAX * GRAVITY) / (CARRY * Math.sin(2 * LAUNCH_ANGLE)));
// The angle the lure leaves at goes by how high the phone is aiming the rod as it lets
// go, degrees: at LEVEL_AIM it is the usual LAUNCH_ANGLE, and each degree the aim is
// above or below that adds or takes this many degrees, between LOWEST and HIGHEST. A
// rod stopped high lobs it, one followed through low drives it flat and a little short.
const LEVEL_AIM = -5;
const ANGLE_PER_AIM = 0.6;
const LOWEST = 12;
const HIGHEST = 50;

export function createSwing() {
  const trail = { x: 0, y: 0, z: 0 };
  const last = { x: 0, y: 0, z: 0 };
  let best = 0;
  let started = false;

  const swing = {
    // How fast the tip is going this way right now, m/s, by the same reading.
    speed: 0,

    // Forget the swing so far. The next step starts from rest wherever the tip is.
    reset() {
      started = false;
      best = 0;
      swing.speed = 0;
    },

    /**
     * Once a frame. tip: where the rod tip is, world space. (aheadX, aheadZ): the level
     * direction a cast goes. Returns the best recent speed of the tip while it was
     * travelling that way, m/s: a tip swung back, or only up and down, throws nothing.
     */
    step(dt, tip, aheadX, aheadZ) {
      if (!(dt > 0)) return best;
      if (!started) {
        trail.x = last.x = tip.x;
        trail.y = last.y = tip.y;
        trail.z = last.z = tip.z;
        started = true;
      }
      // Exact for a tip that moves evenly through the frame: close on where it was, then
      // take a share of its move.
      const keep = Math.exp(-TRAIL_RATE * dt);
      const share = 1 - (1 - keep) / (TRAIL_RATE * dt);
      trail.x = last.x + (trail.x - last.x) * keep + (tip.x - last.x) * share;
      trail.y = last.y + (trail.y - last.y) * keep + (tip.y - last.y) * share;
      trail.z = last.z + (trail.z - last.z) * keep + (tip.z - last.z) * share;
      last.x = tip.x;
      last.y = tip.y;
      last.z = tip.z;
      const lx = tip.x - trail.x;
      const ly = tip.y - trail.y;
      const lz = tip.z - trail.z;
      swing.speed = lx * aheadX + lz * aheadZ > 0 ? TRAIL_RATE * Math.hypot(lx, ly, lz) : 0;
      best = Math.max(swing.speed, best * Math.exp(-BEST_FADE * dt));
      return best;
    },
  };
  return swing;
}

// The angle a lure leaves at, radians above level, with the phone aiming the rod this
// high, degrees. It eases into its lowest and highest, it does not hit them.
export function launchAngle(aimPitch) {
  const usual = LAUNCH_ANGLE * 180 / Math.PI;
  const mid = (LOWEST + HIGHEST) / 2;
  const half = (HIGHEST - LOWEST) / 2;
  const wanted = usual + (aimPitch - LEVEL_AIM) * ANGLE_PER_AIM;
  return (mid + half * Math.tanh((wanted - mid) / half)) * Math.PI / 180;
}

// How far a lure let go at this speed and this angle flies, metres from under the tip.
// 0: not a cast.
export function castReach(speed, angle = LAUNCH_ANGLE) {
  if (speed < SPEED_MIN) return 0;
  return Math.min(REACH_MAX, (CARRY * speed * speed * Math.sin(2 * angle)) / GRAVITY);
}
