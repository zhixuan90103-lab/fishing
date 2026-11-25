/**
 * A fish bolting from the lure: how fast, how far, and whether it comes back.
 *
 * Owns: the aim of a fish running from the lure, how its fright wears off with the
 * distance run, and the draw for coming back.
 * Does not own: what frightens a fish, how much, or whether it bolts at all (fright.js),
 * which fish are near (suitors.js), how a fish swims (src/fish/swim.js), or the fish
 * that comes next.
 * No Three, no scene: it runs in Node. Rule: docs/FISHING-REQUIREMENTS.md section 9.
 * Design: docs/PLAY.md section 7.
 *
 * It only writes the aim. The more frightened, the faster it goes, and since the fright
 * wears off by the metre, the further. It is calm again far from the lure, not at it.
 *
 * Units: metres, seconds. Fright is 0, calm, to 1.
 */

// How fast it runs, m/s: barely frightened, and at full fright.
const RUN_CALM = 0.9;
const RUN_FULL = 3.2;
// The fright that wears off with each metre run. At full fright it is calm after 1 / this.
const WEARS_OFF = 0.11;
// The chance it comes back to the lure once calm: a full fish, and a starved one.
const COMES_BACK = [0.15, 0.75];
// How sharply it turns and picks up speed as it bolts, and slows as it calms, 1/s.
const TURN = 6;
const ACCEL = 7;
const SLOW = 2;
// It goes back down toward the water the school keeps to, m, this fast, 1/s.
const DEPTH = -2.2;
const RISE = 0.8;
const SHALLOWEST = -0.3;

export function createFlee(random) {
  // Where it was a frame ago, for the distance run.
  let lastX = 0;
  let lastZ = 0;

  const flee = {
    // How frightened it still is, 0 to 1.
    fright: 0,

    // It bolts from where it is, this frightened. Past 1 it can be no more frightened.
    begin(fish, fright) {
      flee.fright = Math.min(1, fright);
      lastX = fish.x;
      lastZ = fish.z;
    },

    /**
     * Write the aim of the bolting fish: away from the lure, as fast as it is
     * frightened. Wears the fright off by how far it has come since the last call.
     * fish: x, z, yaw. lure: x, z.
     */
    steer(fish, aim, lure) {
      const run = Math.hypot(fish.x - lastX, fish.z - lastZ);
      lastX = fish.x;
      lastZ = fish.z;
      flee.fright = Math.max(0, flee.fright - run * WEARS_OFF);
      const dx = fish.x - lure.x;
      const dz = fish.z - lure.z;
      // Right on the lure there is no away: it goes the way it is facing.
      aim.yaw = Math.hypot(dx, dz) > 0.05 ? Math.atan2(dx, dz) : fish.yaw;
      aim.speed = RUN_CALM + (RUN_FULL - RUN_CALM) * flee.fright;
      aim.y = DEPTH;
      aim.top = SHALLOWEST;
      aim.turn = TURN;
      aim.accel = ACCEL;
      aim.slow = SLOW;
      aim.rise = RISE;
    },

    // It is calm again.
    get calm() {
      return flee.fright <= 0;
    },

    // Calm, whether it turns back for the lure: the hungrier it was, the likelier.
    comesBack(hunger) {
      return random() < COMES_BACK[0] + (COMES_BACK[1] - COMES_BACK[0]) * hunger;
    },
  };
  return flee;
}
