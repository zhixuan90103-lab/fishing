/**
 * The muster: how many fish a cast wants round the lure, and when the next spare is due.
 *
 * Owns: the number a cast wants, how many spares are still to be brought to make it up,
 * the wait before the first and between one and the next, and the wait before more come
 * to a lure every fish has left.
 * Does not own: counting the fish that are there, or bringing one in (suitors.js).
 * No Three, no scene: it runs in Node. Rule: docs/FISHING-REQUIREMENTS.md section 3.
 * Design: docs/PLAY.md section 7.
 *
 * A cast wants a number of fish, drawn. A moment after the lure lands the fish already
 * there are counted, and spares make up the difference, one at a time. A lure cast in
 * among the school has enough and gets none. When every fish has gone from the lure,
 * after a while a new number is drawn and brought.
 *
 * Units: seconds.
 */

import { between } from './maths.js';

// A cast wants between these many fish round the lure, and never more than MOST.
const WANTED = [1, 10];
export const MOST = 10;
// The fish there are counted this long after the lure lands, s. Spares then come one at
// a time, this far apart, s.
const TOP_UP_AFTER = 1;
const BRING_EVERY = [0.4, 1.6];
// With every fish gone from the lure, more are brought after this long, s.
const COME_AFTER = [1.5, 4];

export function createMuster(random) {
  let wanted = 1;
  let toBring = 0;
  let nextIn = 0;
  let counted = false;
  // Seconds the lure has had no fish at all, and how long that goes on before more come.
  let emptyFor = 0;
  let refillAfter = 0;

  const draw = () => Math.min(MOST, Math.floor(between(random, [WANTED[0], WANTED[1] + 1])));

  return {
    // The lure has landed.
    arm() {
      wanted = draw();
      toBring = 0;
      counted = false;
      nextIn = TOP_UP_AFTER;
      emptyFor = 0;
      refillAfter = between(random, COME_AFTER);
    },

    // No more are to be brought: a fish is hooked, or the lure is out of the water.
    stop() {
      toBring = 0;
    },

    // The lure is back in the water with no fish at it, the count already made: more
    // come after a while.
    again() {
      counted = true;
      toBring = 0;
      emptyFor = 0;
      refillAfter = between(random, COME_AFTER);
    },

    /**
     * Once a frame with the lure in the water. live: how many fish are round the lure or
     * have an eye on it. Returns true when a spare is due now: bring one, then say how
     * it went with brought().
     */
    step(dt, live) {
      if (toBring > 0) {
        nextIn -= dt;
        return nextIn <= 0;
      }
      if (!counted) {
        nextIn -= dt;
        if (nextIn <= 0) {
          toBring = Math.max(0, wanted - live);
          counted = true;
          nextIn = 0;
        }
      } else if (live === 0) {
        emptyFor += dt;
        if (emptyFor >= refillAfter) {
          wanted = draw();
          toBring = wanted;
          nextIn = 0;
          emptyFor = 0;
          refillAfter = between(random, COME_AFTER);
        }
      } else emptyFor = 0;
      return false;
    },

    // A spare was due and was brought, or could not be: either way the next waits its turn.
    brought(ok) {
      if (ok) toBring -= 1;
      nextIn = between(random, BRING_EVERY);
    },
  };
}
