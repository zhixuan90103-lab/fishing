/**
 * The water the school keeps to: a patch in front of the angler that a fish is at ease
 * in, and less and less at ease the further out of it it gets.
 *
 * Owns: where the patch is, how uneasy a fish at some place is and which way is back,
 * and a place inside it for a fish that wants somewhere to go.
 * Does not own: what a fish does about being uneasy (behaviors.js), or anything about
 * the school as a whole. There is no school here, only water.
 * No Three, no scene: it runs in Node. Design: docs/FISH-SCHOOL.md section 3.
 *
 * It is not a wall. Inside the calm middle nothing is felt at all. Toward the edge the
 * wish to turn back grows, and goes on growing outside, so a fish that has been dragged
 * far off on a line comes back by itself.
 *
 * Units: metres, radians. Yaw 0 faces +Z and grows toward +X.
 */

// The middle of the patch is this far in front of the camera.
const AHEAD = 24;
// The patch reaches this far nearer and further than its middle, and this share of the
// way to the side of the picture at that distance.
const HALF_DEEP = 5;
const SIDE_SHARE = 0.9;
// Inside this share of the patch a fish feels nothing. At the edge its unease is 1, and
// it goes on rising at the same rate outside.
const CALM = 0.6;
// Where the school starts, m below the surface.
export const START_DEPTH = -2.7;

export function createHomeWater() {
  const water = {
    // The middle of the patch, and the level directions across and along the view.
    x: 0,
    z: AHEAD + 2,
    alongX: 0,
    alongZ: 1,
    halfWide: 5,

    // cam: x, z, yaw, fov (degrees, vertical) and aspect of the view the patch sits in.
    watch(cam) {
      water.alongX = Math.sin(cam.yaw);
      water.alongZ = Math.cos(cam.yaw);
      water.x = cam.x + water.alongX * AHEAD;
      water.z = cam.z + water.alongZ * AHEAD;
      const half = Math.atan(Math.tan((cam.fov * Math.PI) / 360) * cam.aspect);
      water.halfWide = AHEAD * Math.tan(half) * SIDE_SHARE;
    },

    // How far out a place is: 0 at the middle, 1 at the edge, more outside.
    reach(x, z) {
      const dx = x - water.x;
      const dz = z - water.z;
      const along = dx * water.alongX + dz * water.alongZ;
      const across = dx * water.alongZ - dz * water.alongX;
      return Math.hypot(along / HALF_DEEP, across / water.halfWide);
    },

    /**
     * How uneasy a fish at x, z is: 0 in the calm middle, 1 at the edge, more outside.
     * The level direction back toward the middle goes into out.x, out.z.
     */
    unease(x, z, out) {
      const dx = water.x - x;
      const dz = water.z - z;
      const d = Math.hypot(dx, dz) || 1e-6;
      out.x = dx / d;
      out.z = dz / d;
      const r = water.reach(x, z);
      return r <= CALM ? 0 : (r - CALM) / (1 - CALM);
    },

    // A place well inside the patch, into out.x, out.z. random: 0 to 1.
    pick(random, out) {
      const turn = random() * Math.PI * 2;
      const r = Math.sqrt(random()) * CALM;
      const along = Math.cos(turn) * r * HALF_DEEP;
      const across = Math.sin(turn) * r * water.halfWide;
      out.x = water.x + water.alongX * along + water.alongZ * across;
      out.z = water.z + water.alongZ * along - water.alongX * across;
    },
  };
  return water;
}
