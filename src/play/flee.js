/**
 * A frightened fish: how frightened, whether it has the nerve to stay, and if it bolts
 * how fast, how far, and whether it comes back.
 *
 * Owns: the fright each thing gives a fish, how much a fish stands before it bolts, the
 * aim of a fish running from the lure, how the fright wears off with the distance run,
 * and the draw for coming back.
 * Does not own: what frightens it or which fish are near enough to be (suitors.js), how
 * a fish swims (src/fish/swim.js), or the fish that comes next.
 * No Three, no scene: it runs in Node. Rule: docs/FISHING-REQUIREMENTS.md section 9.
 * Design: docs/PLAY.md section 7.
 *
 * A strike frightens every fish near the lure: the one biting most, the ones beside it
 * less. Fright adds up, and each fish decides for itself: it stays while its fright is
 * under its nerve, and a hungry fish has more nerve than a full one, which has no need
 * to take chances. A fish that stays gets over it, slowly, and keeps off the lure until
 * it has: a strike that missed leaves the water quiet for a while.
 *
 * Bolting, it only writes the aim. The more frightened, the faster it goes, and since the fright
 * wears off by the metre, the further. It is calm again far from the lure, not at it.
 *
 * Units: metres, seconds. Fright is 0, calm, to 1.
 */

// The fright each thing gives the fish at the lure: a strike that found nothing in its
// mouth, a strike at a fish that had only nipped, the lure wound out of its mouth, and
// a hook thrown in a fight. And what a strike, or a fish being hooked beside it, gives
// a fish that was only near: this much right at the lure, falling to nothing NEAR
// metres off.
export const FRIGHT = { missed: 1.3, nipped: 0.8, drawn: 0.8, shed: 1, beside: 0.8 };
export const NEAR = 6;
// How much fright a fish stands before it bolts: a full fish, and a starved one.
const NERVE = [0.3, 1.5];
// A fish that stayed gets over its fright at this rate, a second.
const GETS_OVER = 0.05;
// And until its fright is down to this share of its nerve it keeps off the lure: it
// idles round it and does not go for it.
const WARY_ABOVE = 0.25;
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

// The fright a fish stands before it bolts. hunger: 0 full to 1 starved.
export function nerveOf(hunger) {
  return NERVE[0] + (NERVE[1] - NERVE[0]) * Math.min(1, Math.max(0, hunger));
}

// Whether a fish that stayed is still too frightened to go for the lure.
export function wary(fright, hunger) {
  return fright > WARY_ABOVE * nerveOf(hunger);
}

// The fright of a fish that stayed, dt seconds on.
export function getsOver(fright, dt) {
  return Math.max(0, fright - GETS_OVER * dt);
}

// What a strike gives a fish this far from the lure, level metres, that was not biting.
export function frightBeside(far) {
  return FRIGHT.beside * Math.max(0, 1 - far / NEAR);
}

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
