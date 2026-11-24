/**
 * The school as a simulation. No loading and no rendering here: a fish is any object
 * with a holder to pose. school.js supplies the real ones.
 *
 * Owns: the fish and their sizes, one frame of all of them, and the ports someone
 * outside takes a fish through.
 * Does not own: what a free fish wants (behaviors.js), what it can tell of the others
 * (neighbours.js), the water they keep to (homeWater.js), or how a fish moves (swim.js).
 *
 * One frame: every fish finds out how crowded it is and what its neighbours are doing,
 * then for each fish in turn
 *   aim    what it wants: its own mind if it is free (behaviors.js), or the brain of
 *          whoever took it
 *   swim   crowding, rocks, turning, moving, body pose (swim.js)
 * Only the last step moves anything. There is no step for the school as a whole: there
 * is no such thing here, only fish.
 *
 * A fish someone has hung on a line is not swum at all: it is posed from its mouth
 * (hung.js) until it is kept, and then it is free again.
 */

import { createHomeWater, START_DEPTH } from './homeWater.js';
import { makeSense, senseNeighbours } from './neighbours.js';
import { FREE, HELD, HUNG } from './states.js';
import { CRUISE_LENGTHS, seedNature, setFree, free } from './behaviors.js';
import { mouthOf, startHang, poseHung } from './hung.js';
import {
  clamp, makeAim, makeCrowd, measureCrowd, swimFish, restBody, writePose,
  DEPTH_MIN, DEPTH_MAX, TURN_SCHOOL, TURN_ALONE, ACCEL_CRUISE, COAST, DEPTH_RATE,
} from './swim.js';

// A fish taken out for good comes back in this far to one side of the water the school
// keeps to, metres: out of the picture, to swim in again.
const RETURN_SIDE = 11;

// The school has small fish and big ones, and nothing in between, so the two read apart
// at a glance. Body scale of each, and the share that are big.
const SMALL_SIZE = [0.78, 0.95];
const BIG_SIZE = [1.2, 1.4];
const BIG_SHARE = 0.5;

// bodyLength: nose to tail of a fish at scale 1, metres. random: 0 to 1.
export function createFlock(fishes, { bodyLength = 0.45, random = Math.random } = {}) {
  const water = createHomeWater();
  const crowd = makeCrowd(fishes.length);
  const sense = makeSense(fishes.length);
  const aim = makeAim();
  const env = { fishes, water, sense, random };
  // The unhurried speed of a fish, m/s: so many of its own lengths a second.
  const cruiseOf = (fish) => CRUISE_LENGTHS * bodyLength * fish.size * fish.pace;

  // tune: x, z and yaw (degrees) of the view the fish are put in front of.
  function place(tune) {
    const yaw = (tune.yaw * Math.PI) / 180;
    water.watch({ x: tune.x, z: tune.z, yaw, fov: 55, aspect: 390 / 844 });
    // Crossing the view, to begin with.
    const heading = yaw + Math.PI / 2;
    const fx = Math.sin(heading);
    const fz = Math.cos(heading);
    const spots = [];
    for (let i = 0; i < fishes.length; i++) {
      const fish = fishes[i];
      // Loose spots about the middle, only to start without overlap. Nobody keeps a spot.
      const spot = i === 0 ? { along: 0, side: 0, y: 0 } : freeSpot(spots, random);
      spots.push(spot);
      fish.x = water.x - fx * spot.along + -fz * spot.side;
      fish.z = water.z - fz * spot.along + fx * spot.side;
      fish.y = clamp(START_DEPTH + spot.y, DEPTH_MIN, DEPTH_MAX);
      fish.yaw = heading + (random() - 0.5) * 0.5;
      const range = random() < BIG_SHARE ? BIG_SIZE : SMALL_SIZE;
      fish.size = range[0] + random() * (range[1] - range[0]);
      fish.holder.scale.setScalar(fish.size);
      seedNature(fish, random);
      fish.speed = cruiseOf(fish);
      setFree(fish);
      restBody(fish);
      const clip = fish.action.getClip();
      fish.action.time = (i / fishes.length) * (clip.duration || 1);
      writePose(fish);
    }
  }

  function step(dt, rate, rocks = [], cam = null) {
    if (cam) water.watch(cam);
    measureCrowd(fishes, crowd);
    senseNeighbours(fishes, sense);
    for (let i = 0; i < fishes.length; i++) {
      const fish = fishes[i];
      // On a line out of the water it is posed by hang(), not swum.
      if (fish.state === HUNG) continue;
      // Left to itself a fish carries on as it is. Whoever writes its aim changes that.
      aim.cruise = cruiseOf(fish) * rate;
      aim.speed = aim.cruise;
      aim.yaw = fish.yaw;
      aim.y = fish.y;
      aim.turn = TURN_SCHOOL;
      aim.accel = ACCEL_CRUISE;
      aim.slow = COAST;
      aim.rise = DEPTH_RATE;
      aim.top = DEPTH_MAX;
      aim.effort = null;
      aim.towX = 0;
      aim.towZ = 0;
      if (fish.state === HELD) {
        aim.turn = TURN_ALONE;
        fish.brain(fish, aim, env, dt);
      } else {
        free(fish, i, aim, env, Math.hypot(crowd.x[i], crowd.y[i], crowd.z[i]), dt);
      }
      swimFish(fish, aim, crowd.x[i], crowd.y[i], crowd.z[i], rocks, dt);
    }
  }

  return {
    fishes,
    water,
    place,
    step,
    // Take a fish out of the school. From now on brain(fish, aim, env, dt) decides its
    // aim every frame. It still gives way to neighbours, avoids rocks and swims nose first.
    take(fish, brain) {
      fish.state = HELD;
      fish.brain = brain;
    },
    // Let it go. It is a free fish again wherever it is: out of its water it wants back
    // in, and seeing the others it closes on them. Nothing fetches it.
    giveBack(fish) {
      setFree(fish);
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
      const side = random() < 0.5 ? -1 : 1;
      fish.x = water.x + water.alongZ * side * RETURN_SIDE;
      fish.z = water.z - water.alongX * side * RETURN_SIDE;
      fish.y = START_DEPTH;
      fish.yaw = Math.atan2(water.x - fish.x, water.z - fish.z);
      fish.speed = cruiseOf(fish);
      restBody(fish);
      setFree(fish);
      writePose(fish);
    },
    // Where the tip of the fish's mouth is now, world space, into out.x, out.y, out.z.
    mouth(fish, out) {
      return mouthOf(fish, bodyLength, out);
    },
  };
}

function freeSpot(spots, random) {
  let along = 0.55;
  let side = 0;
  let y = 0;
  for (let n = 0; n < 48; n++) {
    along = random() * 8;
    side = (random() - 0.5) * 8;
    y = (random() - 0.5) * 1.6;
    const clear = spots.every((p) => {
      const d = Math.hypot(along - p.along, side - p.side, (y - p.y) * 1.4);
      return d > 0.7;
    });
    if (clear) break;
  }
  return { along, side, y };
}
