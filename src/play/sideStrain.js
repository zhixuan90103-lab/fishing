/**
 * Side strain: how much a rod carried against a running fish takes off its speed.
 *
 * Owns: how far the rod end of the line has been carried against the way this run is
 * heading, and the share of its speed across the line that costs the fish.
 * Does not own: which way a run heads (course.js), how the fish swims (onLine.js), the
 * rod or the hand. It reads only where the line's near end is: the rod tip.
 * No Three, no scene: it runs in Node. Design: docs/PLAY.md section 8.
 *
 * A fish held on a fixed length of line can only go round the arc the line allows, and
 * the line, pulling along itself, is square to that and cannot slow it. What a rod
 * carried the other way does is turn the line: the fish's course now has a part that is
 * straight against the line, and that part gets it nowhere. How much is the distance the
 * tip was carried over the length of line out: a metre on fifteen metres is four
 * degrees, a metre on five is eleven. So the nearer the fish, the more the rod has it.
 *
 * Truly that is a few per cent of its speed at range: the rod is two metres long. Here
 * it counts GAIN times as much, on purpose, so that carrying the rod against a run is
 * worth doing and can be seen to be. Carried the way the fish is going it takes nothing
 * off and adds nothing on.
 *
 * It is counted from where the tip was when the run set off this way, and starts again
 * with each run and each change of side: it is the carrying against this run that tells.
 *
 * Units: metres, seconds.
 */

import { toward } from './maths.js';

// How many times its true share the turning of the line counts for. 1 would be as it is
// on the water with a two metre rod.
const GAIN = 4;
// The most it takes off the fish's speed across the line.
const MOST = 0.7;
// How fast the share follows the rod, 1/s: the tip nods to every shake of the fish's
// head, and that must not brake it.
const FOLLOWS = 6;

export function createSideStrain() {
  // Where the tip was when this run set off this way, the level direction it heads, and
  // which side that is: 1 to the left of the line out to the fish, -1 to the right, 0
  // with no run under way.
  let fromX = 0;
  let fromZ = 0;
  let headX = 0;
  let headZ = 0;
  let side = 0;

  const strain = {
    // The share of its speed across the line the fish has lost to it, 0 to MOST.
    share: 0,

    // A fish is hooked: nothing is counted yet. What the last fish lost eases off by itself.
    reset() {
      side = 0;
    },

    /**
     * Once a frame. tip: the rod tip now. to: where the fish is from the tip, a level
     * unit vector x, z and how far, `far`, m. across: how fast it means to swim across
     * the line, m/s, positive to the left of the line out to it, 0 when it is not running.
     * A run setting off, or cutting to its other side, is counted from where the tip is
     * then. Returns the share of that speed the fish keeps, 1 to 1 - MOST.
     */
    step(dt, tip, to, across) {
      const now = across > 0 ? 1 : across < 0 ? -1 : 0;
      if (now !== side) {
        side = now;
        fromX = tip.x;
        fromZ = tip.z;
        headX = -to.z * side;
        headZ = to.x * side;
      }
      const against = side ? -((tip.x - fromX) * headX + (tip.z - fromZ) * headZ) : 0;
      const goal = Math.min(MOST, Math.max(0, GAIN * against / Math.max(to.far, 1)));
      strain.share = toward(strain.share, goal, FOLLOWS, dt);
      return 1 - strain.share;
    },
  };
  return strain;
}
