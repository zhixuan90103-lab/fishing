/**
 * A fought fish breaking the surface: when its back comes out of the water, and when it
 * goes back in.
 *
 * Owns: telling the two moments from how far under the surface its back is, and how
 * hard each is.
 * Does not own: where the fish is or why (onLine.js, highRod.js), or what a splash looks
 * like (src/shore/splashBurst.js): it only says that the water was broken, which way and
 * how hard.
 * No Three, no scene: it runs in Node. Design: docs/PLAY.md section 8.
 *
 * Held up at the top by a raised rod a fish rides the rod's spring, and now and then its
 * back comes out. Coming out it brings water up with it; dropping back it hits the water,
 * harder the faster it falls. Left under the water it does neither.
 *
 * Its back wavers at the surface, so it has to be clear of it by CLEAR m to count as out
 * and as far under again to count as back in, and one moment is at least APART s after
 * the last.
 *
 * Units: metres, seconds.
 */

const CLEAR = 0.015;
const APART = 0.3;
// Coming out it breaks the water this hard, 0 to 1.
const COMES_OUT = 0.3;
// Going back in: this hard however gently, and all of 1 falling at FALLS_HARD m/s.
const GOES_IN = 0.25;
const FALLS_HARD = 1.2;

export function createSurfacing() {
  let out = false;
  let since = APART;
  let was = null;

  return {
    // A fish is hooked.
    begin() {
      out = false;
      since = APART;
      was = null;
    },

    /**
     * Once a frame with a fish being fought. backUnder: how far under the surface its
     * back is, m; below zero it is out by that much. Returns null, or what has just
     * happened: { out: true, strength } as its back comes out, { out: false, strength }
     * as it goes back in.
     */
    step(dt, backUnder) {
      since += dt;
      const fell = was !== null && dt > 0 ? (backUnder - was) / dt : 0;
      was = backUnder;
      if (since < APART) return null;
      if (!out && backUnder < -CLEAR) {
        out = true;
        since = 0;
        return { out: true, strength: COMES_OUT };
      }
      if (out && backUnder > CLEAR) {
        out = false;
        since = 0;
        return { out: false, strength: Math.min(1, GOES_IN + (1 - GOES_IN) * Math.max(0, fell) / FALLS_HARD) };
      }
      return null;
    },
  };
}
