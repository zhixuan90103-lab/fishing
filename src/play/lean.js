/**
 * Leaning on a running fish: how much the hand adds to the line.
 *
 * Owns: the pull the finger piles on while line is running out.
 * Does not own: the line or its length (catch.js lets the reel hold this much more, so
 * the tension and the rod's bend rise with it), or the fish's own pull (fight.js).
 * No Three, no scene: it runs in Node. Rule: docs/FISHING-REQUIREMENTS.md section 10.
 * Design: docs/PLAY.md section 9.
 *
 * Holding the finger down while a fish takes line adds the hand's pull to the fish's.
 * That is worth something: the reel holds that much more, so the fish gets less line, or
 * none. It costs the hand and bends the rod deeper. It does not break the line: whether
 * a line can break is not decided, and nothing here wears or parts (docs/PLAY.md section 14).
 *
 * Units: seconds, newtons.
 */

import { toward } from './maths.js';

// The most the hand piles on, N, and how fast it comes on and lets go, 1/s. It comes on
// slowly: a moment's press on a run costs nothing.
const PRESS_MOST = 24;
const PRESS_ON = 1.4;
const PRESS_OFF = 7;

export function createLean() {
  const lean = {
    // What the hand is adding to the line now, N.
    press: 0,

    // A fish is on.
    begin() {
      lean.press = 0;
    },

    /**
     * Once a frame with a fish on. held: the finger is down. taking: the fish is pulling
     * harder than the reel holds, so line is running out.
     */
    step(dt, held, taking) {
      if (!(dt > 0)) return;
      const to = held && taking ? PRESS_MOST : 0;
      const rate = to > lean.press ? PRESS_ON : PRESS_OFF;
      lean.press = toward(lean.press, to, rate, dt);
      if (lean.press < 1e-4 && to === 0) lean.press = 0;
    },
  };
  return lean;
}
