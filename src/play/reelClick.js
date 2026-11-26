/**
 * The reel clicking in the hand while a fish is on.
 *
 * Owns: when a click falls due, and how hard and how sharp it is.
 * Does not own: how much line goes out or comes in (haul.js), the haptics (catch.js
 * hands what this returns to them), or any sound.
 * No Three, no scene: it runs in Node. Design: docs/PLAY.md section 9.
 *
 * A click is tied to line going out, not to time: one for every so much the fish takes
 * while the reel is locked against it. Line wound in is a turn of the reel, and that is
 * a continuous vibration, not these clicks.
 *
 * Units: metres, newtons.
 */

// One click for every this much line a fish takes, m. Lower rattles faster.
const CLICK_OUT = 0.09;
// A click as line runs out: how hard and how sharp, 0 to 1.
const OUT_CLICK = { intensity: 0.75, sharpness: 0.9 };

export function createReelClick() {
  // Line taken since the last click.
  let gone = 0;

  return {
    reset() {
      gone = 0;
    },

    /**
     * Once a frame. given: metres the fish took this frame.
     * Returns a click to play, { intensity, sharpness }, or null. At most one a frame.
     */
    step(given) {
      gone += given;
      if (gone >= CLICK_OUT) {
        gone %= CLICK_OUT;
        return OUT_CLICK;
      }
      return null;
    },
  };
}
