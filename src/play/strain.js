/**
 * How hard the hand on the rod is working right now.
 *
 * Owns: turning the pull the hand is holding into an effort, 0 to 1, that comes on fast
 * and lets go a little slower.
 * Does not own: what a straining hand looks like (the rod is handed the number:
 * rod.setStrain, src/shore/rodHold.js), or the pull itself (catch.js works it out).
 * No Three, no scene: it runs in Node. Design: docs/PLAY.md section 9.
 *
 * The pull is taken from what the fish and the hand are doing, not from the line's
 * tension. The hand giving way moves the rod tip, which changes the tension: read from
 * the tension, the two would chase each other a frame apart.
 *
 * Units: seconds, newtons.
 */

// The pull at which the hand is working as hard as it can show, N.
const FULL_AT = 9;
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
      strain.effort += (to - strain.effort) * (1 - Math.exp(-rate * dt));
      if (strain.effort < 1e-4 && to === 0) strain.effort = 0;
    },
  };
  return strain;
}
