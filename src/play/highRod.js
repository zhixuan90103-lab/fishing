/**
 * A rod held high: how far up it brings the fish.
 *
 * Owns: how high counts, and how much of the way from where a hooked fish hangs up to
 * the top of the water a raised rod brings it.
 * Does not own: the rod or the hand (it reads only how high the line's near end, the
 * rod tip, stands above the water), where the fish hangs and where the top is for it
 * (onLine.js), what a lowered rod does (lowRod.js), or the strike, which is the hand
 * snapping the rod up and not where it is held (strike.js).
 * No Three, no scene: it runs in Node. Design: docs/PLAY.md section 8.
 *
 * The line pulls the fish by the mouth toward the rod tip. With the rod carried as
 * usual that is toward the angler and hardly upward, and the fish stays down where it
 * hangs. Raise the rod and the pull is upward: its head comes up and the fish with it,
 * to the top of the water, where it cuts the surface and throws it about. Lower the rod
 * again and it goes back down. That is the angler's doing and not the fish's: left
 * alone, running or resting, it keeps under.
 *
 * As the rod is usually carried the tip stands at about 1.9 m and nods between 1.76 and
 * 2.03 in a fight: that brings the fish up not at all. It comes on as the tip goes above
 * FROM and is all there by FULL, which is the rod raised to a little over 30 degrees,
 * a dozen degrees more than it is carried at: measured, the tip stands 2.2 m with the
 * rod at 30 degrees, 2.6 at 45 and 3.0 at 60. (2.1 to 2.5 m, about 40 degrees, was more
 * of a lift than the hand wanted to give: 2026-11-25.)
 *
 * Units: metres, seconds.
 */

import { toward } from './maths.js';

// As the rod is usually carried its tip stands about this high, m.
export const USUAL = 1.9;
const FROM = 2.0;
const FULL = 2.25;
// How fast it follows the rod, 1/s.
const FOLLOWS = 5;
// The rod is a spring, and a fish held up on it rides the spring. The fish shakes its
// head or bolts: the line snatches, the rod bends and its tip dips, and the fish drops
// with it; the rod straightens and throws it up again, past where it was, and its back
// comes out of the water; out there nothing bears it up and it falls back. So how far up
// or down of where the rod holds it the fish is, is how far the tip is up or down of
// where the tip has been standing lately, over SETTLES s: measured, the tip goes 5 to 10
// cm either way of that, three or four times a second with a big fish shaking its head,
// and dips 14 cm as a run starts. A fish rides it RIDES times over, for one that weighs
// WEIGHS kg, and a heavier one less, as the root of the weight: a small fish is flung
// about and a big one wallows. It is bigger than true: 26 m off, a tip that lifts 10 cm
// lifts the fish a hand's breadth of that.
const SETTLES = 0.8;
const RIDES = 1.1;
const WEIGHS = 1;

export function createHighRod() {
  // Where the tip has been standing lately, m. Null until it is known.
  let stood = null;

  const high = {
    // How much of the way up the raised rod is bringing the fish now, 0 to 1.
    lifts: 0,
    // How far up of where the rod holds it the rod's spring has it now, m. Below zero, down.
    rides: 0,
    // How high the rod tip stands above the water, m.
    tip: USUAL,

    // A fish is hooked.
    begin() {
      high.lifts = 0;
      high.rides = 0;
      high.tip = USUAL;
      stood = null;
    },

    // Once a frame with a fish being fought. tipHeight: how high the rod tip stands
    // above the water, m. load: what the fish weighs, kg. Returns how much of the way up
    // it brings the fish, 0 to 1.
    step(dt, tipHeight, load = WEIGHS) {
      high.tip = tipHeight;
      const t = Math.min(1, Math.max(0, (tipHeight - FROM) / (FULL - FROM)));
      high.lifts = toward(high.lifts, t * t * (3 - 2 * t), FOLLOWS, dt);
      stood = stood === null ? tipHeight : toward(stood, tipHeight, 1 / SETTLES, dt);
      // Only a fish the rod is holding up rides it.
      high.rides = (tipHeight - stood) * RIDES * Math.sqrt(WEIGHS / Math.max(load, 0.05)) * high.lifts;
      return high.lifts;
    },
  };
  return high;
}
