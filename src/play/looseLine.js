/**
 * A line with nothing winding it: the bail is open and a lure lies in the water.
 *
 * Owns: the two things such a line does. It gives to a jerk of the rod, so the lure
 * darts and shivers and is not hauled in. And it follows a sinking lure down, so the lure
 * sinks where it is.
 * Does not own: the line out (fishing.js adds this file's give to it for the moment, and
 * lets out what this says), the lure's motion or its flutter (lureMove.js), how slack the
 * line looks (the line's own business, from what has pulled on it: lineCurve.js), winding
 * (retrieve.js), or the rod.
 * No Three, no scene: it runs in Node. Rule: docs/FISHING-REQUIREMENTS.md section 7.
 * Design: docs/PLAY.md section 6.
 *
 * Only winding brings a lure in. A jerk of the rod is taken up by the line: by its
 * stretch, by the belly it lies in through the water, by the rod's own bend. What reaches
 * the lure is its life, not its place. So of every length the rod tip draws away, the
 * line gives most and the lure comes a small share, never far in one go. The give is
 * elastic: it goes back as the tip comes back, so the next jerk works the lure again.
 *
 * The jerk works on distance, not time: how far the tip has drawn the line since it last
 * eased. So it is the same at any frame rate. Draws smaller than a hand's tremor are not
 * counted, or a lure would creep in under a rod that is only being held.
 *
 * The moment the line is taken up, by winding, by a fish, or by the lure leaving the
 * water, all of this is over: nothing gives.
 *
 * Units: metres, seconds.
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

export function createLooseLine() {
  // What the lure has yet to come, m, and the stretch the draws are counted from, m.
  let owed = 0;
  let from = 0;

  const loose = {
    // How much longer than what is out the line lies for the moment, m.
    give: 0,

    // Once a frame while the line is not loose: it is being wound, a fish has it, or the
    // lure is not in the water. Nothing gives and nothing is owed.
    takenUp() {
      owed = 0;
      from = 0;
      loose.give = 0;
    },

    /**
     * Once a frame while it is loose, before the lure is moved. stretch: how much
     * further the lure is from the tip than there is line out, m. Below zero the line is
     * slack. Sets `give`. Returns how many metres to flutter the lure by.
     */
    drawn(dt, stretch) {
      if (stretch < from) from = stretch;
      let fresh = 0;
      if (stretch > from + TREMOR) {
        fresh = stretch - from - TREMOR;
        from = stretch - TREMOR;
      }
      owed = Math.min(MOST, owed + REACHES * fresh);
      loose.give = Math.max(0, stretch - owed);
      return fresh * FLUTTER;
    },

    /**
     * Once a frame while it is loose, after the lure has moved. stretch: as above, now.
     * sank: how much further from the tip the lure's sinking alone has left it, m.
     * Returns how many metres of line to let out after it, so that it sinks where it is.
     * Line already slack is used up first.
     */
    follows(stretch, sank) {
      const out = Math.min(sank, Math.max(0, stretch));
      const left = stretch - out;
      owed = Math.max(0, left - loose.give);
      loose.give = Math.max(0, Math.min(loose.give, left));
      return out;
    },
  };
  return loose;
}
