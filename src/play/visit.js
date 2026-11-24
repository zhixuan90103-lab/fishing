/**
 * A fish coming to the lure: how it swims there, and when it has reached the hook.
 *
 * Owns: the aim of a fish on its way to the lure, the distance that counts as touching,
 * the aim of a fish with the lure in its mouth, of one idling near the lure, and of one
 * swimming off out of sight.
 * Does not own: which fish comes or when (suitors.js, allure.js), how a fish swims (src/fish/swim.js),
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

// With the lure in its mouth it moves off with it, away from the rod, this fast, m/s: a
// heavy bite makes off, a medium one hardly moves before it lets go. The line goes with
// it; how hard it drags on the line is the bite's (bite.js). It turns that way this
// fast, 1/s.
const CARRIES = { medium: 0.25, heavy: 0.55 };
const CARRY_TURN = 2.5;

// A fish near the lure that is not going for it idles round it: this fast, m/s, turning
// this sharply, 1/s, and a fish still far from its ring swims in this fast.
const IDLE_SPEED = 0.35;
const IDLE_IN = 0.9;
const IDLE_TURN = 1.6;
// Leaving, it makes off this fast, m/s.
const OFF_SPEED = 1.5;

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

/**
 * Write the aim of a fish holding the lure in its mouth: off with it, away from the rod
 * tip, at the depth it is at. bite: 'medium' or 'heavy'. tip: x, z.
 */
export function steerWithLure(fish, aim, tip, bite) {
  aim.yaw = Math.atan2(fish.x - tip.x, fish.z - tip.z);
  aim.speed = CARRIES[bite] || 0;
  aim.y = Math.min(fish.y, SHALLOWEST);
  aim.top = SHALLOWEST;
  aim.turn = CARRY_TURN;
  aim.accel = ACCEL;
  aim.slow = SLOW;
  aim.rise = RISE;
}

/**
 * Write the aim of a fish idling near the lure: round it at `ring` metres, `turn` +1 or
 * -1 for which way round, about `depth` m. Far outside its ring it swims in toward it.
 * fish: x, z. lure: x, z.
 */
export function steerAbout(fish, aim, lure, ring, turn, depth) {
  const dx = fish.x - lure.x;
  const dz = fish.z - lure.z;
  const far = Math.hypot(dx, dz) || 1e-6;
  // Along the ring, leaning in or out by how far off it is.
  const off = Math.max(-1, Math.min(1, (far - ring) / Math.max(ring, 1)));
  const along = Math.atan2(dx, dz) + turn * (Math.PI / 2 + off * Math.PI / 2.4);
  aim.yaw = along;
  aim.speed = IDLE_SPEED + (IDLE_IN - IDLE_SPEED) * smooth((far - ring) / 3);
  aim.y = Math.min(depth, SHALLOWEST);
  aim.top = SHALLOWEST;
  aim.turn = IDLE_TURN;
  aim.accel = ACCEL;
  aim.slow = SLOW;
  aim.rise = RISE;
}

/**
 * Write the aim of a fish swimming off: the level direction (dirX, dirZ), down to depth.
 */
export function steerOff(fish, aim, dirX, dirZ, depth) {
  aim.yaw = Math.atan2(dirX, dirZ);
  aim.speed = OFF_SPEED;
  aim.y = depth;
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
