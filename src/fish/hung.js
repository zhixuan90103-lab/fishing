/**
 * A fish out of the water, hung by its mouth: on a line, or lying in a net.
 *
 * Owns: where a fish's mouth is, the pose of a hung fish from its mouth, and how it
 * thrashes there.
 * Does not own: which fish is hung, where its mouth is put or how hard it kicks (the
 * caller says), or anything about a fish in the water (swim.js). flock.js calls this.
 * No Three, no scene: it runs in Node. Design: docs/FISH-SCHOOL.md section 7.
 *
 * This is the one case where a fish is placed and not swum. Its mouth goes exactly where
 * it is told. The body turns to hang from there, it is never snapped round.
 *
 * Head is +Z of the holder, yaw then pitch then roll, as in swim.js.
 */

import { clamp } from './swim.js';

// The mouth, measured on the model: this share of the body length ahead of the fish's
// centre, and this share below its middle line. The snout ends under the eye line, not on it.
const MOUTH_AHEAD = 0.485;
const MOUTH_BELOW = 0.073;
// A fish hung on a line. How fast its body swings round to hang from its mouth, 1/s.
const HANG_TURN = 6;
// It thrashes: how far the body bends each way, radians, how fast, rad/s, and how fast
// the thrashing dies down to HANG_CALM of that, 1/s.
const HANG_BEND = 0.5;
const HANG_BEAT = 17;
const HANG_TIRE = 0.5;
const HANG_CALM = 0.35;
// And how far it twists about the line each way, radians.
const HANG_TWIST = 0.35;
// Its whole body swings from the mouth as it kicks: this far off the line each way,
// radians, at this beat, rad/s. Two beats that never line up, so it does not tick.
const HANG_SWING = 0.2;
const HANG_SWING_BEAT = 7.3;
// The bend, the swing and the twist are not allowed past these, radians, however hard it
// kicks.
const BEND_MOST = 0.85;
const SWING_MOST = 0.6;
const TWIST_MOST = 0.55;
// How fast a harder kick comes on, 1/s.
const VIGOR_RATE = 9;
// Hanging free on a line it turns about the line, so every side of it comes round. Its
// kicking drives it one way, this hard for the usual thrash, rad/s². The twist it puts
// in the line pulls it back, this hard per radian it has turned, 1/s², and the air slows
// it, 1/s. So it winds round a turn or two, faster with each hard kick, and unwinds part
// of the way as it tires: never a steady spin.
const SPIN_DRIVE = 3.4;
const SPIN_UNWIND = 0.18;
const SPIN_LOSS = 1.6;
// Lying in a net it has nothing to turn on: what turn it has left dies this fast, 1/s.
const SPIN_STOPS = 9;
// Fixed step for the turning, s.
const SPIN_DT = 1 / 240;
// Tail speed while it thrashes, as a swimming speed, m/s.
const HANG_TAIL = 0.9;

// Out of the water a fish can point any way at all, straight up included, where a
// heading and a pitch stop meaning anything: a nose passing through vertical flips the
// heading half a turn, and the fish would snap from belly to back. So a hung fish
// carries its nose and its back as two vectors, turned a little each frame, and the
// angles are read off those.

// Which way a fish's back points for the pose it has, into out.x, out.y, out.z.
function backOf(fish, out) {
  const cy = Math.cos(fish.yaw), sy = Math.sin(fish.yaw);
  const cp = Math.cos(fish.pitch), sp = Math.sin(fish.pitch);
  const cr = Math.cos(fish.roll), sr = Math.sin(fish.roll);
  out.x = -sr * cy + cr * sp * sy;
  out.y = cr * cp;
  out.z = sr * sy + cr * sp * cy;
  return out;
}

// Start from the pose it has now.
function takeFrame(fish) {
  const cy = Math.cos(fish.yaw), sy = Math.sin(fish.yaw);
  const cp = Math.cos(fish.pitch), sp = Math.sin(fish.pitch);
  const cr = Math.cos(fish.roll), sr = Math.sin(fish.roll);
  fish.noseX = sy * cp; fish.noseY = -sp; fish.noseZ = cy * cp;
  fish.backX = -sr * cy + cr * sp * sy; fish.backY = cr * cp; fish.backZ = sr * sy + cr * sp * cy;
}

// Turn the nose toward (tx, ty, tz) at `rate`, carrying the back round with it and never
// spinning it about the nose.
function turnFrame(fish, tx, ty, tz, rate, dt) {
  const far = Math.hypot(tx, ty, tz) || 1;
  const k = 1 - Math.exp(-rate * dt);
  let nx = fish.noseX + (tx / far - fish.noseX) * k;
  let ny = fish.noseY + (ty / far - fish.noseY) * k;
  let nz = fish.noseZ + (tz / far - fish.noseZ) * k;
  const nl = Math.hypot(nx, ny, nz);
  // Asked to point straight back the way it faces: nothing to turn through this frame.
  if (nl > 1e-4) { fish.noseX = nx / nl; fish.noseY = ny / nl; fish.noseZ = nz / nl; }
  nx = fish.noseX; ny = fish.noseY; nz = fish.noseZ;
  const along = fish.backX * nx + fish.backY * ny + fish.backZ * nz;
  const bx = fish.backX - nx * along;
  const by = fish.backY - ny * along;
  const bz = fish.backZ - nz * along;
  const bl = Math.hypot(bx, by, bz);
  if (bl > 1e-4) { fish.backX = bx / bl; fish.backY = by / bl; fish.backZ = bz / bl; }
}

// Read yaw, pitch and roll off the frame, with the back twisted `twist` radians about
// the nose. The same order writePose uses: yaw, then pitch, then roll.
function poseFrame(fish, twist) {
  const nx = fish.noseX, ny = fish.noseY, nz = fish.noseZ;
  const c = Math.cos(twist), s = Math.sin(twist);
  // back, turned about the nose.
  const bx = fish.backX * c + (ny * fish.backZ - nz * fish.backY) * s;
  const by = fish.backY * c + (nz * fish.backX - nx * fish.backZ) * s;
  const bz = fish.backZ * c + (nx * fish.backY - ny * fish.backX) * s;
  // The fish's own right-hand side: back cross nose.
  const rx = by * nz - bz * ny;
  const ry = bz * nx - bx * nz;
  const rz = bx * ny - by * nx;
  fish.pitch = -Math.asin(clamp(ny, -1, 1));
  if (Math.hypot(nx, nz) > 1e-4) {
    fish.yaw = Math.atan2(nx, nz);
    fish.roll = Math.atan2(ry, by);
  } else {
    // Nose dead vertical: heading and roll are one turn. Put all of it in the heading.
    fish.yaw = Math.atan2(-rz, rx);
    fish.roll = 0;
  }
}

// Scratch: which way the back points.
const back = { x: 0, y: 1, z: 0 };

// Where the tip of the fish's mouth is now, world space, into out.x, out.y, out.z.
// bodyLength: nose to tail at scale 1, metres.
export function mouthOf(fish, bodyLength, out) {
  const reach = bodyLength * MOUTH_AHEAD * fish.size;
  const below = bodyLength * MOUTH_BELOW * fish.size;
  const level = Math.cos(fish.pitch) * reach;
  backOf(fish, back);
  out.x = fish.x + Math.sin(fish.yaw) * level - back.x * below;
  out.y = fish.y - Math.sin(fish.pitch) * reach - back.y * below;
  out.z = fish.z + Math.cos(fish.yaw) * level - back.z * below;
  return out;
}

// A fish is hung from this moment: it starts from the pose it has, kicking this hard.
export function startHang(fish, vigor) {
  fish.hungFor = 0;
  fish.vigor = vigor;
  // How far it has turned about the line, radians, how fast, and which way its kicking
  // drives it.
  fish.spin = 0;
  fish.spinRate = 0;
  fish.spinWay = Math.random() < 0.5 ? -1 : 1;
  takeFrame(fish);
}

// One frame of its turning about the line. free: it hangs clear on a line.
function turnOnLine(fish, thrash, free, dt) {
  let done = 0;
  while (done < dt - 1e-9) {
    const h = Math.min(SPIN_DT, dt - done);
    done += h;
    if (free) {
      fish.spinRate += (SPIN_DRIVE * thrash * fish.spinWay - SPIN_UNWIND * fish.spin) * h;
      fish.spinRate *= Math.exp(-SPIN_LOSS * h);
    } else {
      fish.spinRate *= Math.exp(-SPIN_STOPS * h);
    }
    fish.spin += fish.spinRate * h;
  }
}

/**
 * One frame of a hung fish. Its mouth is at (mx, my, mz) and the line runs up toward
 * (upX, upY, upZ). The body swings round to hang below the mouth, and it thrashes, less
 * as time goes on. vigor: how hard it is kicking right now, 1 for the usual.
 * free: it hangs clear on a line and turns about it. False for one lying in a net.
 * Writes x, y, z, yaw, pitch, roll and the body state. The caller writes the pose out.
 */
export function poseHung(fish, mx, my, mz, upX, upY, upZ, dt, vigor, bodyLength, free = true) {
  fish.hungFor += dt;
  // A kick comes on fast but not in one frame: the bend and the twist are laid straight
  // onto the pose, and a jump in how hard it kicks would be a jump in the fish.
  fish.vigor += (vigor - fish.vigor) * (1 - Math.exp(-VIGOR_RATE * dt));
  const thrash = (HANG_CALM + (1 - HANG_CALM) * Math.exp(-HANG_TIRE * fish.hungFor)) * fish.vigor;
  // The line it hangs along, swung to and fro across itself: the body follows, so the
  // tail kicks out to one side and the other.
  let lx = upX - mx, ly = upY - my, lz = upZ - mz;
  const ll = Math.hypot(lx, ly, lz) || 1;
  lx /= ll; ly /= ll; lz /= ll;
  // Two level-ish directions square to the line.
  let ax = ly, ay = -lx, az = 0;
  if (Math.hypot(ax, ay) < 0.2) { ax = 0; ay = lz; az = -ly; }
  const al = Math.hypot(ax, ay, az);
  ax /= al; ay /= al; az /= al;
  const bx = ly * az - lz * ay, by = lz * ax - lx * az, bz = lx * ay - ly * ax;
  const swing = Math.min(SWING_MOST, HANG_SWING * thrash);
  const sa = Math.sin(fish.hungFor * HANG_SWING_BEAT) * swing;
  const sb = Math.sin(fish.hungFor * HANG_SWING_BEAT * 0.62 + 2) * swing * 0.7;
  turnFrame(fish, lx + ax * sa + bx * sb, ly + ay * sa + by * sb, lz + az * sa + bz * sb, HANG_TURN, dt);
  // It twists about the line as it thrashes. The twist is laid on top of the frame,
  // never stored in it, so it cannot build up into a turn.
  const twist = Math.sin(fish.hungFor * HANG_BEAT * 0.37 + 1) * Math.min(TWIST_MOST, HANG_TWIST * thrash);
  // And it turns about the line. Kept apart from the frame, like the twist, and laid on
  // with it.
  turnOnLine(fish, thrash, free, dt);
  poseFrame(fish, twist + fish.spin);
  // The body is placed from the mouth: back along the nose, and up toward its back by
  // as much as the mouth lies below the middle line. The same twist as the pose.
  const reach = bodyLength * MOUTH_AHEAD * fish.size;
  const below = bodyLength * MOUTH_BELOW * fish.size;
  backOf(fish, back);
  fish.x = mx - fish.noseX * reach + back.x * below;
  fish.y = my - fish.noseY * reach + back.y * below;
  fish.z = mz - fish.noseZ * reach + back.z * below;
  fish.bend = clamp(Math.sin(fish.hungFor * HANG_BEAT) * HANG_BEND * thrash, -BEND_MOST, BEND_MOST);
  fish.drive = Math.min(1.3, 1.2 * thrash);
  fish.speed = HANG_TAIL * Math.min(2, thrash);
  fish.yawRate = 0;
}
