/**
 * A hooked fish shaking its head: how hard each shake snatches the line right now.
 *
 * Owns: when a shake comes, how hard it is, and the shape of the snatch.
 * Does not own: the line (catch.js turns the pull this reports into a shorter line for a
 * moment, and the rod nods by itself), the haptics (catch.js plays what step returns),
 * the fish's runs and stamina (fight.js), or how the fish looks.
 * No Three, no scene: it runs in Node. Design: docs/PLAY.md section 9.
 *
 * A fish only shakes while it is running, so the shakes are the sign in the hand and on
 * the rod tip that it is still fighting, and their stopping is the sign that it has
 * given up for now. Fresh, they come fast and hard. Worn out, slow and weak.
 *
 * They come in bursts with a pause between, each gap drawn afresh: a steady beat reads
 * as a machine, and one that only fades reads as dying.
 *
 * Units: seconds, newtons.
 */

import { between } from './maths.js';

// A burst is this many shakes, then a pause this long, s.
const BURST = [3, 7];
const PAUSE = [0.25, 0.7];
// Worn out, the gaps between shakes are this many times longer, and each shake this
// share as hard.
const SPENT_SLOW = 1.9;
const SPENT_SHARE = 0.35;
// No two shakes are alike: each is between this share and all of what it could be.
const UNEVEN = 0.55;
// How long one snatch lasts, s. It rises and falls smoothly inside that.
const SNATCH_FOR = 0.11;
// The shake in the hand: from this hard for a faint one to this much harder for one of
// FULL_AT newtons, and how dull.
const SOFT = 0.3;
const MORE = 0.6;
const FULL_AT = 15.6;
const SHARPNESS = 0.45;

// A snatch rises to 1 and falls back over SNATCH_FOR. This is how much of it, in
// seconds at full strength, lies before time t.
function before(t) {
  const u = Math.min(1, Math.max(0, t / SNATCH_FOR));
  return SNATCH_FOR * (u / 2 - Math.sin(2 * Math.PI * u) / (4 * Math.PI));
}

/** random: 0 to 1, for the gaps and the strength of each shake. */
export function createThump(random = Math.random) {
  let kind = { thump: 0, beat: [1, 1] };
  // Seconds until the next shake, and how many are left in this burst.
  let nextIn = 0;
  let burstLeft = 0;
  // The snatch in hand: how hard at its peak, and how long ago it began.
  let peak = 0;
  let age = SNATCH_FOR;
  const shake = { intensity: 0, sharpness: SHARPNESS };

  const thump = {
    // How much harder than the fish's steady pull the line is being snatched now, N.
    pull: 0,

    // A fish is on. fish: its numbers, from fishOf() in fishKind.js.
    begin(fish) {
      kind = fish;
      nextIn = 0;
      burstLeft = Math.round(between(random, BURST));
      peak = 0;
      age = SNATCH_FOR;
      thump.pull = 0;
    },

    // Nothing is on the line.
    end() {
      peak = 0;
      thump.pull = 0;
    },

    /**
     * Once a frame. running: the fish is in a run. stamina: 1 fresh to 0.
     * Returns the shake to play in the hand on the frame one begins, { intensity,
     * sharpness }, or null.
     */
    step(dt, running, stamina) {
      if (!(dt > 0)) return null;
      let felt = null;
      if (running) {
        nextIn -= dt;
        if (nextIn <= 0) {
          peak = kind.thump * (SPENT_SHARE + (1 - SPENT_SHARE) * stamina) * (UNEVEN + (1 - UNEVEN) * random());
          age = 0;
          burstLeft -= 1;
          if (burstLeft <= 0) {
            burstLeft = Math.round(between(random, BURST));
            nextIn = between(random, PAUSE);
          } else {
            nextIn = between(random, kind.beat) * (1 + (SPENT_SLOW - 1) * (1 - stamina));
          }
          shake.intensity = SOFT + MORE * Math.min(1, peak / FULL_AT);
          felt = shake;
        }
      } else {
        // The next run opens with a shake.
        nextIn = 0;
      }
      // The frame's share of the snatch, not its value at one instant: a short snatch
      // then gives the line the same jolt at any frame rate.
      const from = age;
      age = Math.min(SNATCH_FOR, age + dt);
      thump.pull = peak * (before(age) - before(from)) / dt;
      return felt;
    },
  };
  return thump;
}
