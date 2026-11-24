/**
 * Throwing the hook: whether a hooked fish, given slack line, has shaken it out.
 *
 * Owns: how much slack counts, how long this hook holds on a slack line, and when it is out.
 * Does not own: the line or how slack it is (catch.js reads that off the line out and
 * where the fish is), the fish's pull (fight.js), or what the fish does once free (flee.js).
 * No Three, no scene: it runs in Node. Design: docs/PLAY.md section 8.
 *
 * A hook stays in against a tight line. On a slack one a fish with any go left in it
 * shakes its head, and nothing holds the hook in while it does. So the slack is counted
 * as it lasts, faster for a fresher fish; a spent fish shakes nothing loose. A hook
 * worked loose does not seat itself again: the slack of a whole fight adds up. How long
 * a hook stands this is drawn once for each fish hooked: some are well in, some barely.
 * Tried with the count running back on a tight line: a big fish takes its slack back
 * in a second, the count ran back between one rest and the next, and a rod dropped at
 * every rest of a whole fight never lost it.
 *
 * It is meant to be rare. A line kept tight never loses a fish this way.
 *
 * Units: metres, seconds.
 */

import { between } from './maths.js';

// The line is slack when there is this much more of it out than reaches the fish, m. Less
// is the sag any working line has for a moment as a fish turns.
const SLACK_COUNTS = 0.15;
// Seconds of slack a hook stands with a fresh fish shaking at it, drawn for each fish.
const HOLDS_FOR = [1.6, 5];
// A fish with this much of its go left shakes as hard as a fresh one; below it, less,
// down to nothing when it is spent.
const SHAKES_UNTIL = 0.3;

export function createShed(random) {
  let holds = Infinity;

  const shed = {
    // How near the hook is to coming out, 0 well in to 1 out.
    loose: 0,

    // A fish is hooked.
    begin() {
      holds = between(random, HOLDS_FOR);
      shed.loose = 0;
    },

    /**
     * Once a frame with a fish being fought. spare: how much more line is out than
     * reaches the fish, m, below zero when the line is stretched. stamina: how fresh the
     * fish is, 1 to 0. Returns true on the frame the hook comes out.
     */
    step(dt, spare, stamina) {
      if (!(dt > 0)) return false;
      if (spare > SLACK_COUNTS) shed.loose += dt * Math.min(1, Math.max(0, stamina) / SHAKES_UNTIL) / holds;
      return shed.loose >= 1;
    },
  };
  return shed;
}
