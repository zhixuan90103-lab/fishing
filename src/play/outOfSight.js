/**
 * Out of sight: whether the view can see a place on the water, where beside the lure a
 * fish can be put in unseen, and which way a fish goes to get out of the picture.
 *
 * Owns: what counts as unseen, picking a place beside the lure that is, and the way out.
 * Does not own: the camera (it reckons from the rod tip and where the view looks), the
 * fish, or bringing one in and sending it away (suitors.js, src/fish/flock.js).
 * No Three, no scene: it runs in Node. Design: docs/PLAY.md section 7.
 *
 * A spare fish is put in the water and taken out of it in one step, so both may only
 * happen where nobody is looking. The picture is narrow: it reaches 13.5 degrees to
 * either side of the view line. Off to the side of that, or far enough away, is unseen.
 *
 * Units: metres, radians. viewYaw: where the view looks, positive toward +X from +Z.
 */

import { between } from './maths.js';

// What the view cannot see: further than this off its line, radians, or further away
// than this, m. The picture reaches 13.5 degrees to either side; the rest is margin for
// reckoning from the rod tip and not the eye, which is this far behind it, m.
const UNSEEN_OFF = 24 * Math.PI / 180;
const UNSEEN_FAR = 38;
const EYE_BEHIND = 2.2;
// Where a fish is put in: to one side of the lure by at least this, m, or this share of
// how far off the lure is, whichever is more, this much more at random, and this much
// either way along the cast.
const SIDE_LEAST = 5;
const SIDE_SHARE = 0.55;
const SIDE_MORE = [0, 2.5];
const ALONG = [-2, 4];
// Leaving, a fish heads across the view line and this much away from the eye as well.
const OUT_AND_AWAY = 0.3;

// Whether the view, looking along viewYaw from behind the rod tip, cannot see x, z.
export function unseen(x, z, viewYaw, tip) {
  const fx = Math.sin(viewYaw);
  const fz = Math.cos(viewYaw);
  const dx = x - (tip.x - fx * EYE_BEHIND);
  const dz = z - (tip.z - fz * EYE_BEHIND);
  const far = Math.hypot(dx, dz);
  const ahead = dx * fx + dz * fz;
  return far > UNSEEN_FAR || ahead <= 0 || Math.acos(Math.min(1, ahead / far)) > UNSEEN_OFF;
}

/**
 * Pick a place beside the lure that the view cannot see, into out.x, out.z. lure: x, z.
 * (homeX, homeZ): the level direction the cast went. random: 0 to 1.
 * Returns false when no such place was found in a few tries.
 */
export function placeBeside(random, lure, homeX, homeZ, viewYaw, tip, out) {
  const lureFar = Math.hypot(lure.x - tip.x, lure.z - tip.z) + EYE_BEHIND;
  const side = random() < 0.5 ? -1 : 1;
  for (let n = 0; n < 6; n += 1) {
    const along = between(random, ALONG);
    const across = side * (n % 2 ? -1 : 1) * (Math.max(SIDE_LEAST, SIDE_SHARE * (lureFar + along)) + between(random, SIDE_MORE)) * (1 + 0.25 * (n >> 1));
    out.x = lure.x + homeX * along + homeZ * across;
    out.z = lure.z + homeZ * along - homeX * across;
    if (unseen(out.x, out.z, viewYaw, tip)) return true;
  }
  return false;
}

/**
 * The level direction a fish at x, z swims to get out of the picture, into out.x, out.z:
 * off to the side of the view line it is nearer, and a little away. Not a unit vector.
 */
export function wayOut(x, z, viewYaw, tip, out) {
  const fx = Math.sin(viewYaw);
  const fz = Math.cos(viewYaw);
  const side = (x - tip.x) * fz - (z - tip.z) * fx >= 0 ? 1 : -1;
  out.x = fz * side + fx * OUT_AND_AWAY;
  out.z = -fx * side + fz * OUT_AND_AWAY;
}
