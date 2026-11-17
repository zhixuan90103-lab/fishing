/**
 * How much line is out past the rod tip during a cast.
 *
 * Owns: the length of line out, and the slack it carries: the belly it flies with, and
 * drawing that belly out after the lure lands.
 * Does not own: the line itself (line.js is told this length), how fast line is wound
 * (retrieve.js), where the lure is (lureMove.js), or which stage the cast is in.
 * No Three, no scene: it runs in Node. Design: docs/PLAY.md section 6.
 *
 * The length never steps. In the air it follows the lure with a little to spare. In the
 * water that spare is drawn out over about half a second, and only then is the line just
 * the gap from tip to lure and winding shortens it.
 *
 * Units: metres, seconds. `gap` is always the straight distance from the tip to the lure.
 */

// Line past the tip with the lure wound in: the lure's nose sits just under the tip ring.
// The cast ends when the line is back to this.
export const STOW_LENGTH = 0.025;
// Extra line in the air during the flight, as a share of the gap, so it bellies a little.
const FLIGHT_SPARE = 0.04;
// After the lure lands, how fast that belly is drawn out of the line, 1/s. The line
// straightens over about half a second instead of snapping straight. Lower is slower.
const SETTLE_RATE = 5;
// Belly smaller than this is gone.
const SETTLE_DONE = 0.002;

export function createLineOut() {
  // What is left of the flight's spare line after landing.
  let belly = 0;

  const out = {
    // Line out past the tip.
    length: STOW_LENGTH,

    // All the line is back in.
    get stowed() {
      return out.length <= STOW_LENGTH + 1e-6;
    },
    // How much can still be wound in.
    get room() {
      return out.length - STOW_LENGTH;
    },

    // Wound right in.
    stow() {
      out.length = STOW_LENGTH;
      belly = 0;
    },

    // In the air: line runs out after the lure, with a little to spare.
    fly(gap) {
      out.length = gap * (1 + FLIGHT_SPARE);
    },

    // The lure has landed. The spare line it flew with stays for now.
    land(gap) {
      belly = out.length - gap;
    },

    /**
     * Once a frame in the water, with the line wound in this frame. While the belly
     * lasts it fades by itself, and winding is spent on it first. Returns how much of
     * `taken` reaches the lure: none of it until the line is straight.
     */
    wind(dt, taken, gap) {
      if (belly > 0) {
        belly = belly * Math.exp(-SETTLE_RATE * dt) - taken;
        if (belly < SETTLE_DONE) belly = 0;
        out.length = Math.max(STOW_LENGTH, gap + belly);
        return belly > 0 ? 0 : taken;
      }
      out.length -= taken;
      return taken;
    },

    // Let out whatever the line is stretched by, so the far end is not snapped inward.
    ease(gap) {
      out.length = Math.max(out.length, gap);
    },
  };
  return out;
}
