/**
 * The school as a simulation. No loading and no rendering here: a fish is any object
 * with a holder to pose. school.js supplies the real ones.
 *
 * One frame, for each fish in turn:
 *   state    what it wants (behaviors.js), or the brain of whoever took it
 *   habits   its own wander and darts
 *   regroup  the pull back toward the school
 *   swim     crowding, rocks, turning, moving, body pose (swim.js)
 * Only the last step moves anything.
 */

import { createShoal, startPose, resetShoal, watchCamera, advanceShoal, CRUISE_SPEED } from './shoal.js';
import { STATES, SCHOOL, HELD, HUNG, seedStraying, seedHabits, habits, regroup, sendHome } from './behaviors.js';
import {
  clamp, makeAim, makeCrowd, measureCrowd, swimFish, restBody, writePose,
  DEPTH_MIN, DEPTH_MAX, TURN_SCHOOL, TURN_ALONE, ACCEL_CRUISE, COAST, DEPTH_RATE,
} from './swim.js';

// The mouth, measured on the model: this share of the body length ahead of the fish's
// centre, and this share below its middle line. The snout ends under the eye line, not on it.
const MOUTH_AHEAD = 0.485;
const MOUTH_BELOW = 0.073;
// A fish taken out for good comes back in this far to one side of the school, metres:
// out of the picture, to swim in again.
const RETURN_SIDE = 11;

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

// roamers: how many fish, counted from the end of the list, leave the school now and then.
// bodyLength: nose to tail of a fish at scale 1, metres.
export function createFlock(fishes, { roamers = 0, bodyLength = 0.45 } = {}) {
  const shoal = createShoal();
  const crowd = makeCrowd(fishes.length);
  const aim = makeAim();
  const env = { shoal, fishes, cx: 0, cz: 0 };
  // Which way a fish's back points, reused.
  const back = { x: 0, y: 1, z: 0 };
  fishes.forEach((fish, i) => { fish.roamer = i >= fishes.length - roamers; });

  function place(tune) {
    const start = startPose(tune);
    const fx = Math.sin(start.yaw);
    const fz = Math.cos(start.yaw);
    const spots = [];
    for (let i = 0; i < fishes.length; i++) {
      const fish = fishes[i];
      // Loose slots behind the first fish, only to start without overlap. Nobody keeps a slot.
      const spot = i === 0 ? { along: 0, side: 0, y: 0 } : freeSpot(spots);
      spots.push(spot);
      fish.followY = spot.y;
      fish.x = start.x - fx * spot.along + -fz * spot.side;
      fish.z = start.z - fz * spot.along + fx * spot.side;
      fish.y = clamp(start.y + spot.y, DEPTH_MIN, DEPTH_MAX);
      fish.yaw = start.yaw;
      fish.pace = 0.78 + Math.random() * 0.46;
      fish.speed = CRUISE_SPEED * fish.pace;
      fish.brain = null;
      seedStraying(fish);
      seedHabits(fish);
      restBody(fish);
      fish.size = 0.82 + Math.random() * 0.36;
      fish.holder.scale.setScalar(fish.size);
      const clip = fish.action.getClip();
      fish.action.time = (i / fishes.length) * (clip.duration || 1);
      writePose(fish);
    }
    resetShoal(shoal, start);
  }

  function step(dt, rate, rocks = [], cam = null) {
    if (cam) watchCamera(shoal, cam);
    advanceShoal(shoal, dt, rate);
    measureCrowd(fishes, crowd);
    findCentre();
    for (let i = 0; i < fishes.length; i++) {
      const fish = fishes[i];
      aim.cruise = shoal.speed * fish.pace;
      aim.speed = aim.cruise;
      aim.yaw = shoal.yaw;
      aim.y = shoal.y + fish.followY;
      aim.turn = TURN_SCHOOL;
      aim.accel = ACCEL_CRUISE;
      aim.slow = COAST;
      aim.rise = DEPTH_RATE;
      aim.top = DEPTH_MAX;
      // On a line out of the water it is posed by hang(), not swum.
      if (fish.state === HUNG) continue;
      if (fish.state === HELD) {
        aim.turn = TURN_ALONE;
        fish.brain(fish, aim, env, dt);
      } else {
        STATES[fish.state](fish, aim, env, dt);
        habits(fish, aim, dt);
        regroup(fish, aim, env);
      }
      swimFish(fish, aim, crowd.x[i], crowd.y[i], crowd.z[i], rocks, dt);
    }
    shoal.x = env.cx;
    shoal.z = env.cz;
  }

  // Centre of the fish that are in the school. Strays and held fish do not count.
  function findCentre() {
    let cx = 0;
    let cz = 0;
    let cn = 0;
    for (let i = 0; i < fishes.length; i++) {
      const fish = fishes[i];
      if (fish.state !== SCHOOL) continue;
      cx += fish.x;
      cz += fish.z;
      cn += 1;
    }
    env.cx = cx / (cn || 1);
    env.cz = cz / (cn || 1);
  }

  return {
    fishes,
    shoal,
    place,
    step,
    // Take a fish out of the school. From now on brain(fish, aim, env, dt) decides its
    // aim every frame. It still gives way to neighbours, avoids rocks and swims nose first.
    take(fish, brain) {
      fish.state = HELD;
      fish.brain = brain;
    },
    // Let it go. It swims back to the school on its own and merges.
    giveBack(fish) {
      fish.brain = null;
      sendHome(fish);
    },
    /**
     * Hang a taken fish from its mouth, out of the school's hands. The one case where a
     * fish is placed and not swum: it is a weight on a line now. Call every frame with
     * where the mouth is and a point the line runs up to. The mouth goes exactly there,
     * the body swings round to hang below it, and it thrashes, less as time goes on.
     * vigor: how hard it is kicking right now, 1 for the usual. The caller raises it for
     * a moment when something sets the fish off: breaking the surface, landing in a net.
     */
    hang(fish, mx, my, mz, upX, upY, upZ, dt, vigor = 1) {
      if (fish.state !== HUNG) {
        fish.state = HUNG;
        fish.brain = null;
        fish.hungFor = 0;
        fish.vigor = vigor;
        takeFrame(fish);
      }
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
      poseFrame(fish, twist);
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
      writePose(fish);
    },
    // A hung fish has been taken away for good: netted and carried out of sight. The school
    // gets it back out of the picture, off to one side, and it swims in again. Call only
    // when the fish cannot be seen: this is the one place a fish is moved in one step.
    keep(fish) {
      const side = Math.random() < 0.5 ? -1 : 1;
      fish.x = env.cx + Math.cos(shoal.camYaw) * side * RETURN_SIDE;
      fish.z = env.cz - Math.sin(shoal.camYaw) * side * RETURN_SIDE;
      fish.y = clamp(shoal.y, DEPTH_MIN, DEPTH_MAX);
      fish.yaw = Math.atan2(env.cx - fish.x, env.cz - fish.z);
      fish.speed = CRUISE_SPEED * fish.pace;
      fish.brain = null;
      restBody(fish);
      sendHome(fish);
      writePose(fish);
    },
    // Where the tip of the fish's mouth is now, world space, into out.x, out.y, out.z.
    mouth(fish, out) {
      const reach = bodyLength * MOUTH_AHEAD * fish.size;
      const below = bodyLength * MOUTH_BELOW * fish.size;
      const level = Math.cos(fish.pitch) * reach;
      backOf(fish, back);
      out.x = fish.x + Math.sin(fish.yaw) * level - back.x * below;
      out.y = fish.y - Math.sin(fish.pitch) * reach - back.y * below;
      out.z = fish.z + Math.cos(fish.yaw) * level - back.z * below;
      return out;
    },
  };
}

function freeSpot(spots) {
  let along = 0.55;
  let side = 0;
  let y = 0;
  for (let n = 0; n < 24; n++) {
    along = 0.4 + Math.random() * 2.2;
    side = (Math.random() - 0.5) * 1.35;
    y = (Math.random() - 0.5) * 0.7;
    const clear = spots.every((p) => {
      const d = Math.hypot(along - p.along, side - p.side, (y - p.y) * 1.4);
      return d > 0.7;
    });
    if (clear) break;
  }
  return { along, side, y };
}
