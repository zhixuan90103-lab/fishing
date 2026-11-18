/**
 * A jerk of the rod with the finger up: how much of it reaches the lure.
 *
 * Owns: how much the line gives when the rod is drawn away from a lure that is not
 * being wound in, how far that leaves the lure to come, and how hard it is shaken.
 * Does not own: the line out (fishing.js adds this file's give to it for the moment), the
 * lure's motion or its flutter (lureMove.js), winding (retrieve.js), or the rod.
 * No Three, no scene: it runs in Node. Rule: docs/FISHING-REQUIREMENTS.md section 7.
 * Design: docs/PLAY.md section 6.
 *
 * Only winding brings a lure in. A jerk of the rod is taken up by the line: by its
 * stretch, by the belly it lies in through the water, by the rod's own bend. What reaches
 * the lure is its life, not its place: it darts a hand's breadth and shivers, and stays
 * about where it was. So of every length the rod tip draws away, the line gives most
 * and the lure comes a small share, never far in one go. The give is elastic: it goes
 * back as the tip comes back, so the next jerk works the lure again.
 *
 * It works on distance, not time: how far the tip has drawn the line since it last
 * eased. So it is the same at any frame rate. Draws smaller than a hand's tremor are
 * not counted, or a lure would creep in under a rod that is only being held.
 *
 * Units: metres.
 */

// The share of the rod's draw that reaches the lure as movement.
const REACHES = 0.15;
// And the most a lure is left to come at any moment, m. Past this the line gives it all.
const MOST = 0.25;
// A draw has to pass this before it counts, m: the hand's own tremor at the tip.
const TREMOR = 0.03;
// How much the lure flutters for each metre of draw: metres of swimming its body beats
// through (lureMove's `swum`).
const FLUTTER = 0.3;

export function createTwitch() {
  // What the lure has yet to come, m. The stretch the draws are counted from, m. And how
  // much the line is giving right now, m.
  let owed = 0;
  let from = 0;
  const twitch = {
    // How much longer than what is out the line lies for the moment, m.
    give: 0,

    // Nothing is owed and nothing gives: the lure has just landed, been lifted out, or
    // is being wound in.
    reset() {
      owed = 0;
      from = 0;
      twitch.give = 0;
    },

    /**
     * Before the lure is moved, with the finger up. stretch: how much further the lure
     * is from the tip than there is line out, m. Below zero the line is loose.
     * Sets `give`. Returns how many metres to flutter the lure by.
     */
    draw(stretch) {
      if (stretch < from) from = stretch;
      let fresh = 0;
      if (stretch > from + TREMOR) {
        fresh = stretch - from - TREMOR;
        from = stretch - TREMOR;
      }
      owed = Math.min(MOST, owed + REACHES * fresh);
      twitch.give = Math.max(0, stretch - owed);
      return fresh * FLUTTER;
    },

    // After the lure has moved and line has been let out after its sinking. stretch: as
    // above, now.
    settle(stretch) {
      owed = Math.max(0, stretch - twitch.give);
      twitch.give = Math.max(0, Math.min(twitch.give, stretch));
    },
  };
  return twitch;
}
