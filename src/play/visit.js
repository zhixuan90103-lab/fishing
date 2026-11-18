/**
 * A fish coming to the lure: how it swims there, and when it has reached the hook.
 *
 * Owns: the aim of a fish on its way to the lure, and the distance that counts as touching.
 * Does not own: which fish comes or when (fishing.js), how a fish swims (src/fish/swim.js),
 * what the touch turns into, or the lure.
 * No Three, no scene: it runs in Node. Rule: docs/FISHING-REQUIREMENTS.md section 6.
 * Design: docs/PLAY.md section 7.
 *
 * It only writes the aim. The fish is seen all the way in: it swims from where it was in
 * the school, it is never placed near the lure.
 *
 * Units: metres, seconds.
 */

// How much faster than the lure the fish swims, m/s: far off, and right at the lure. The
// lure may be being wound in, so the speed is on top of the lure's own.
const CLOSE_FAR = 1.3;
const CLOSE_NEAR = 0.3;
// Inside this distance from the lure it eases from the first speed to the second, m.
const NEAR = 1.6;
// Not pointing at the lure, it slows to this share of that speed while it turns, so it
// comes round onto the lure instead of swimming rings about it.
const OFF_LINE = 0.15;
// A fish cannot back up. Having swum past the lure, it carries straight on at this much
// over the lure's speed, m/s, until it is this far off, m, and only then turns back. Turning
// at once would leave it circling with the lure under its belly.
const PAST_SPEED = 0.6;
const PAST_UNTIL = 0.8;
// The mouth this close to the lure has touched the hook, m.
const TOUCH = 0.14;
// The shallowest the fish comes for a lure, m. Negative is under water.
export const SHALLOWEST = -0.22;
// How sharply it turns, speeds up, slows and changes depth on the way in, 1/s.
const TURN = 4.2;
const ACCEL = 2.6;
const SLOW = 3;
const RISE = 1.8;

function smooth(t) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t * t * (3 - 2 * t);
}

/**
 * Write the aim of a fish heading for the lure.
 * fish: x, z, yaw. mouth and lure: x, y, z. lureSpeed: how fast the lure is moving, m/s.
 */
export function steerToLure(fish, aim, mouth, lure, lureSpeed) {
  const gap = Math.hypot(lure.x - mouth.x, lure.z - mouth.z);
  aim.yaw = Math.atan2(lure.x - fish.x, lure.z - fish.z);
  const facing = Math.max(0, Math.cos(aim.yaw - fish.yaw));
  const closing = CLOSE_NEAR + (CLOSE_FAR - CLOSE_NEAR) * smooth(gap / NEAR);
  aim.speed = (lureSpeed + closing) * (OFF_LINE + (1 - OFF_LINE) * facing);
  // The lure is behind the mouth and still close: swim on, come round later.
  const ahead = (lure.x - mouth.x) * Math.sin(fish.yaw) + (lure.z - mouth.z) * Math.cos(fish.yaw);
  if (ahead < 0 && Math.hypot(lure.x - fish.x, lure.z - fish.z) < PAST_UNTIL) {
    aim.yaw = fish.yaw;
    aim.speed = lureSpeed + PAST_SPEED;
  }
  aim.y = Math.min(lure.y, SHALLOWEST);
  aim.top = SHALLOWEST;
  aim.turn = TURN;
  aim.accel = ACCEL;
  aim.slow = SLOW;
  aim.rise = RISE;
}

// Whether the mouth has reached the lure.
export function touching(mouth, lure) {
  return Math.hypot(lure.x - mouth.x, lure.y - mouth.y, lure.z - mouth.z) < TOUCH;
}
