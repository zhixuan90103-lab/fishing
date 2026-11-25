/**
 * A rod held low: how much harder the reel holds against a fish for it.
 *
 * Owns: how low counts, and the pull a lowered rod adds to what the reel holds before
 * it gives line.
 * Does not own: the rod or the hand (it reads only how high the line's near end, the
 * rod tip, stands above the water), the reel's own hold (haul.js), what a held finger
 * adds (lean.js), or the fish's pull (fight.js).
 * No Three, no scene: it runs in Node. Rule: docs/FISHING-REQUIREMENTS.md section 11.
 * Design: docs/PLAY.md section 9.
 *
 * Held high, a rod works on its soft tip and gives to every pull: a fish takes line
 * against the reel alone. Lowered, the stiff butt comes into it and the rod stops giving:
 * the fish has the butt and the reel to pull against together, and gets line more
 * slowly, or none. That is what lowering the rod on a running fish is for. It costs the
 * hand, which carries all of it, and the cushion: a rod that is not bending is not
 * sparing anything.
 *
 * As the rod is usually carried it adds nothing. It comes on as the tip goes below
 * FROM and is all there by FULL. Raising the rod higher than usual takes nothing away.
 *
 * Units: metres, seconds, newtons.
 */

import { toward } from './maths.js';

// The tip this high above the water, m, and higher, adds nothing: carried as usual it
// stands at about 1.9, and a hard run bends it down to 1.8. By FULL it adds all of MOST.
const FROM = 1.7;
const FULL = 0.6;
// The most a lowered rod adds to what the reel holds, N. The reel alone holds 27, and a
// finger held down adds up to 24 more.
const MOST = 14;
// How fast it follows the rod, 1/s: the tip nods to every shake of the fish's head.
const FOLLOWS = 6;

export function createLowRod() {
  const low = {
    // What the lowered rod is adding to what the reel holds now, N.
    holds: 0,

    // A fish is hooked.
    begin() {
      low.holds = 0;
    },

    // Once a frame with a fish being fought. tipHeight: how high the rod tip stands
    // above the water, m. Returns what the rod adds to the reel's hold, N.
    step(dt, tipHeight) {
      const t = Math.min(1, Math.max(0, (FROM - tipHeight) / (FROM - FULL)));
      low.holds = toward(low.holds, MOST * t * t * (3 - 2 * t), FOLLOWS, dt);
      return low.holds;
    },
  };
  return low;
}
