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
 *
 * A fish someone has hung on a line is not swum at all: it is posed from its mouth
 * (hung.js) until it is kept, and then it is back in the school.
 */

import { createShoal, startPose, resetShoal, watchCamera, advanceShoal, CRUISE_SPEED } from './shoal.js';
import { STATES, FREE, HELD, HUNG, seedFlocking, seedHabits, habits, regroup, sendHome } from './behaviors.js';
import { mouthOf, startHang, poseHung } from './hung.js';
import {
  clamp, makeAim, makeCrowd, measureCrowd, swimFish, restBody, writePose,
  DEPTH_MIN, DEPTH_MAX, TURN_SCHOOL, TURN_ALONE, ACCEL_CRUISE, COAST, DEPTH_RATE,
} from './swim.js';

// A fish taken out for good comes back in this far to one side of the school, metres:
// out of the picture, to swim in again.
const RETURN_SIDE = 11;

// The school has small fish and big ones, and nothing in between, so the two read apart
// at a glance. Body scale of each, and the share that are big.
const SMALL_SIZE = [0.78, 0.95];
const BIG_SIZE = [1.2, 1.4];
const BIG_SHARE = 0.5;

// roamers: how many fish, counted from the end of the list, leave the school now and then.
// bodyLength: nose to tail of a fish at scale 1, metres.
export function createFlock(fishes, { roamers = 0, bodyLength = 0.45 } = {}) {
  const shoal = createShoal();
  const crowd = makeCrowd(fishes.length);
  const aim = makeAim();
  const env = { shoal, fishes, cx: 0, cz: 0 };
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
      seedFlocking(fish);
      seedHabits(fish);
      restBody(fish);
      const range = Math.random() < BIG_SHARE ? BIG_SIZE : SMALL_SIZE;
      fish.size = range[0] + Math.random() * (range[1] - range[0]);
      fish.holder.scale.setScalar(fish.size);
      const clip = fish.action.getClip();
      fish.action.time = (i / fishes.length) * (clip.duration || 1);
      writePose(fish);
    }
    resetShoal(shoal, start);
  }

  function step(dt, rate, rocks = [], cam = null) {
    if (cam) watchCamera(shoal, cam);
    advanceShoal(shoal, dt);
    measureCrowd(fishes, crowd);
    findCentre();
    for (let i = 0; i < fishes.length; i++) {
      const fish = fishes[i];
      // aim.cruise is the base speed for this fish at this swim-rate
      aim.cruise = CRUISE_SPEED * rate * fish.pace;
      aim.speed = aim.cruise;
      aim.yaw = shoal.homeYaw;
      aim.y = shoal.homeDepth + fish.followY;
      aim.turn = TURN_SCHOOL;
      aim.accel = ACCEL_CRUISE;
      aim.slow = COAST;
      aim.rise = DEPTH_RATE;
      aim.top = DEPTH_MAX;
      aim.effort = null;
      // On a line out of the water it is posed by hang(), not swum.
      if (fish.state === HUNG) continue;
      if (fish.state === HELD) {
        aim.turn = TURN_ALONE;
        fish.brain(fish, aim, env, dt);
      } else {
        STATES[fish.state](fish, aim, env, dt);
        habits(fish, aim, env, dt);
        regroup(fish, aim, env);
      }
      swimFish(fish, aim, crowd.x[i], crowd.y[i], crowd.z[i], rocks, dt);
    }
    shoal.x = env.cx;
    shoal.z = env.cz;
  }

  // Centre of the free fish. Held and hung fish do not count.
  function findCentre() {
    let cx = 0;
    let cz = 0;
    let cn = 0;
    for (let i = 0; i < fishes.length; i++) {
      const fish = fishes[i];
      if (fish.state !== FREE) continue;
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
     * free: it hangs clear on a line, and turns about it as it kicks. Pass false for a
     * fish lying in a net, which has nothing to turn on.
     */
    hang(fish, mx, my, mz, upX, upY, upZ, dt, vigor = 1, free = true) {
      if (fish.state !== HUNG) {
        fish.state = HUNG;
        fish.brain = null;
        startHang(fish, vigor);
      }
      poseHung(fish, mx, my, mz, upX, upY, upZ, dt, vigor, bodyLength, free);
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
      return mouthOf(fish, bodyLength, out);
    },
  };
}

function freeSpot(spots) {
  let along = 0.55;
  let side = 0;
  let y = 0;
  for (let n = 0; n < 48; n++) {
    along = Math.random() * 8;
    side = (Math.random() - 0.5) * 8;
    y = (Math.random() - 0.5) * 1.6;
    const clear = spots.every((p) => {
      const d = Math.hypot(along - p.along, side - p.side, (y - p.y) * 1.4);
      return d > 0.7;
    });
    if (clear) break;
  }
  return { along, side, y };
}
