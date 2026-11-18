/**
 * The reel clicking in the hand while a fish is on.
 *
 * Owns: when a click falls due, and how hard and how sharp it is.
 * Does not own: how much line goes out or comes in (haul.js), the haptics (catch.js
 * hands what this returns to them), or any sound.
 * No Three, no scene: it runs in Node. Design: docs/PLAY.md section 9.
 *
 * A click is tied to line, not to time: one for every so much line the fish takes, one
 * for every so much wound in against it. So the faster the run, the faster it rattles.
 *
 * Units: metres, newtons.
 */

// One click for every this much line a fish takes, and for every this much wound in
// against one, m. Lower rattles faster.
const CLICK_OUT = 0.09;
const CLICK_IN = 0.3;
// A click as line runs out: how hard and how sharp, 0 to 1.
const OUT_CLICK = { intensity: 0.75, sharpness: 0.9 };
// A click as line comes in: duller, and from this hard on a loose line to this much
// harder on one at the point where line runs out.
const IN_SOFT = 0.25;
const IN_MORE = 0.5;
const IN_SHARPNESS = 0.3;

export function createReelClick() {
  // Line taken and wound since the last click of each kind.
  let gone = 0;
  let come = 0;
  const inClick = { intensity: 0, sharpness: IN_SHARPNESS };

  return {
    reset() {
      gone = 0;
      come = 0;
    },

    /**
     * Once a frame. given: metres the fish took this frame. taken: metres wound in.
     * load: the line's tension as a share of the point where line runs out, 0 to 1.
     * Returns a click to play, { intensity, sharpness }, or null. At most one a frame,
     * and line running out drowns the other kind.
     */
    step(given, taken, load) {
      gone += given;
      come += taken;
      if (gone >= CLICK_OUT) {
        gone %= CLICK_OUT;
        come = 0;
        return OUT_CLICK;
      }
      if (come >= CLICK_IN) {
        come %= CLICK_IN;
        inClick.intensity = IN_SOFT + IN_MORE * load;
        return inClick;
      }
      return null;
    },
  };
}
