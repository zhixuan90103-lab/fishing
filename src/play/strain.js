/**
 * How hard the hand on the rod is working right now.
 *
 * Owns: turning what the hand holds into an effort, 0 to 1, that comes on fast and lets
 * go a little slower.
 * Does not own: what a straining hand looks like (the rod is handed the number:
 * rod.setStrain, src/shore/rodHand.js), or what it holds: that is the pull on the grip,
 * read off the rod (catch.js hands it in).
 * No Three, no scene: it runs in Node. Design: docs/PLAY.md section 9, docs/CHAIN.md.
 *
 * The hand feels what the rod carries, and that is read where it is: the line's pull on
 * the rod. It used to be worked out apart, from the fish's pull and the winding, because
 * a hand that gave way toward the pull moved the rod tip and so the pull it was reading.
 * The hand no longer gives way toward the pull, so there is nothing to chase.
 *
 * Units: seconds, newtons.
 */

import { toward } from './maths.js';

// The pull at which the hand is working as hard as it can show, N.
const FULL_AT = 54;
// How fast the effort comes on and lets go, 1/s.
const TAKE_UP = 9;
const LET_GO = 4.5;
export function createStrain() {
  const strain = {
    // 0 at ease, 1 all it has.
    effort: 0,

    // Once a frame. pull: what the hand is holding now, N.
    step(dt, pull) {
      if (!(dt > 0)) return;
      const to = Math.min(1, Math.max(0, pull / FULL_AT));
      const rate = to > strain.effort ? TAKE_UP : LET_GO;
      strain.effort = toward(strain.effort, to, rate, dt);
      if (strain.effort < 1e-4 && to === 0) strain.effort = 0;
    },
  };
  return strain;
}
