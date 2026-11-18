/**
 * How hard the hand on the rod is working right now.
 *
 * Owns: what the hand is holding with a fish on the line, and turning what it holds
 * into an effort, 0 to 1, that comes on fast and lets go a little slower.
 * Does not own: what a straining hand looks like (the rod is handed the number:
 * rod.setStrain, src/shore/rodHand.js), or the numbers that go into what it holds: the
 * fish's pull (fight.js), the reel's hold (haul.js), the finger's press (snap.js), the
 * haul against a fish that will not come (lead.js).
 * No Three, no scene: it runs in Node. Design: docs/PLAY.md section 9.
 *
 * The pull is taken from what the fish and the hand are doing, not from the line's
 * tension. The hand giving way moves the rod tip, which changes the tension: read from
 * the tension, the two would chase each other a frame apart.
 *
 * Units: seconds, newtons.
 */

import { toward } from './maths.js';

// The pull at which the hand is working as hard as it can show, N.
const FULL_AT = 9;
// How fast the effort comes on and lets go, 1/s.
const TAKE_UP = 9;
const LET_GO = 4.5;
// Hauling the rod to one side against a fish that will not be led, the hand works this
// much harder, as a share of what it was holding, with the rod square to the fish.
const AGAINST_MORE = 0.6;

/**
 * What the hand holds with a fish being fought, N. pull: the fish's own. holds: the most
 * the reel passes on before it gives line. against: how hard the rod is hauled against a
 * fish that will not come, 0 to 1. press: what the finger adds leaning on a run, N.
 */
export function handHolds(pull, holds, against, press) {
  return Math.min(pull, holds) * (1 + AGAINST_MORE * against) + press;
}

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
