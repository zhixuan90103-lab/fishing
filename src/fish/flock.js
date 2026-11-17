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
import { STATES, SCHOOL, HELD, seedStraying, seedHabits, habits, regroup, sendHome } from './behaviors.js';
import {
  clamp, makeAim, makeCrowd, measureCrowd, swimFish, restBody, writePose,
  DEPTH_MIN, DEPTH_MAX, TURN_SCHOOL, TURN_ALONE, ACCEL_CRUISE,
} from './swim.js';

// roamers: how many fish, counted from the end of the list, leave the school now and then.
export function createFlock(fishes, { roamers = 0 } = {}) {
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
      seedStraying(fish);
      seedHabits(fish);
      restBody(fish);
      fish.holder.scale.setScalar(0.82 + Math.random() * 0.36);
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
