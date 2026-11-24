/**
 * The strike: whether the hand has just snapped the rod upward.
 *
 * Owns: reading how fast the hand is tipping the rod up, and saying when that is a strike.
 * Does not own: the phone (phoneLook.js), what a strike does to a bite (catch.js), or
 * the rod: a strike is what the hand does, so it is read off the hand and not off the
 * rod tip, which nods to every pluck of a fish.
 * No Three, no scene: it runs in Node. Rule: docs/FISHING-REQUIREMENTS.md sections 5, 8.
 * Design: docs/PLAY.md section 7.
 *
 * The rate is not a difference of two frames. A point chases the hand's angle, and how
 * far it trails is the rate: steady, and the same at any frame rate.
 *
 * Units: degrees, seconds.
 */

// How closely the trailing point follows the hand, 1/s. The rate read is about
// 1 / TRAIL_RATE seconds old.
const TRAIL_RATE = 14;
// Tipped up faster than this, degrees a second, the hand has struck. Shaking the rod
// about as one jigs a lure is some 60; a slow lift to look round is far less.
const STRIKE_RATE = 110;
// Once it has struck, the rate has to fall under this share of that before the next
// counts: one lift is one strike.
const AGAIN_UNDER = 0.4;

export function createStrike() {
  let trail = 0;
  let last = 0;
  let started = false;
  // The hand is in a strike it has already been credited with. And the stand-in key was
  // down a frame ago.
  let struck = false;
  let keyWas = false;

  const strike = {
    // How fast the hand is tipping the rod up right now, degrees a second.
    rate: 0,

    // Forget the hand so far.
    reset() {
      started = false;
      struck = false;
      strike.rate = 0;
    },

    /**
     * Once a frame. raised: how far up the hand has tipped the rod, degrees, or null
     * with no sensor reading it. key: the desktop stand-in for a strike is down.
     * Returns true on the frame a strike begins.
     */
    step(dt, raised, key = false) {
      const pressed = key && !keyWas;
      keyWas = key;
      if (raised === null || raised === undefined || !(dt > 0)) return pressed;
      if (!started) {
        trail = last = raised;
        started = true;
      }
      // Exact for a hand that turns evenly through the frame.
      const keep = Math.exp(-TRAIL_RATE * dt);
      const share = 1 - (1 - keep) / (TRAIL_RATE * dt);
      trail = last + (trail - last) * keep + (raised - last) * share;
      last = raised;
      strike.rate = TRAIL_RATE * (raised - trail);
      if (struck) {
        if (strike.rate < STRIKE_RATE * AGAIN_UNDER) struck = false;
        return pressed;
      }
      if (strike.rate > STRIKE_RATE) {
        struck = true;
        return true;
      }
      return pressed;
    },
  };
  return strike;
}
