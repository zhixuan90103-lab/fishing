/**
 * Leaning on a running fish: how much the hand adds to the line, and whether it breaks.
 *
 * Owns: the pull the finger piles on while line is running out, the point past which the
 * line may break, and whether it has.
 * Does not own: the line or its length (catch.js lets the reel hold this much more, so
 * the tension and the rod's bend rise with it), the fish's own pull (fight.js), or what
 * happens after a break (fishing.js).
 * No Three, no scene: it runs in Node. Rule: docs/FISHING-REQUIREMENTS.md section 11.
 * Design: docs/PLAY.md section 9.
 *
 * A fish cannot break the line by itself: its hardest run is below the breaking point.
 * Holding the finger down while it takes line adds the hand's pull to the fish's. That
 * is worth something: the reel holds that much more, so the fish gets less line, or
 * none. Past the breaking point the line does not go at once. It wears, faster the further past,
 * and goes when it has worn through. How much wear it stands is drawn once per fish, so
 * a break is never certain and never on a fixed count.
 *
 * Units: seconds, newtons.
 */

// The line may break once the fish's pull and the hand's together pass this, N. Above
// the hardest run of any fish (fishKind.js) and well above where the reel gives line.
export const BREAK_AT = 11.5;
// The most the hand piles on, N, and how fast it comes on and lets go, 1/s. It comes on
// slowly: a moment's press on a run costs nothing.
const PRESS_MOST = 4;
const PRESS_ON = 1.4;
const PRESS_OFF = 7;
// How fast the line wears, per second, for each newton past the breaking point. Lower
// breaks less often.
const WEAR_RATE = 0.25;
// How much wear a line stands: at least this, and on average this much more. The first
// keeps it from going the moment it is leant on. The second is drawn for each fish.
const STANDS_LEAST = 0.3;
const STANDS_MORE = 1.2;

/** random: 0 to 1, for how much wear this line stands. */
export function createSnap(random = Math.random) {
  let wear = 0;
  let stands = Infinity;

  const snap = {
    // What the hand is adding to the line now, N.
    press: 0,
    // The fish's pull and the hand's together, N.
    load: 0,

    // A fish is on: a fresh draw of how much wear the line stands.
    begin() {
      snap.press = 0;
      snap.load = 0;
      wear = 0;
      stands = STANDS_LEAST - Math.log(1 - random()) * STANDS_MORE;
    },

    /**
     * Once a frame with a fish on. held: the finger is down. taking: the fish is pulling
     * harder than the reel holds, so line is running out. pull: the fish's own pull, N.
     * Returns true on the frame the line breaks.
     */
    step(dt, held, taking, pull) {
      if (!(dt > 0)) return false;
      const to = held && taking ? PRESS_MOST : 0;
      const rate = to > snap.press ? PRESS_ON : PRESS_OFF;
      snap.press += (to - snap.press) * (1 - Math.exp(-rate * dt));
      if (snap.press < 1e-4 && to === 0) snap.press = 0;
      snap.load = pull + snap.press;
      if (snap.load > BREAK_AT) wear += WEAR_RATE * (snap.load - BREAK_AT) * dt;
      return wear >= stands;
    },
  };
  return snap;
}
