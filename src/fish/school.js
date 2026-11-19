/**
 * The dorade school on the shore: the real fish for the flock simulation, plus their
 * body animation. Design and rules: docs/FISH-SCHOOL.md
 *
 *   dorade.js     model, pool, spine pose
 *   flock.js      one frame of the school
 *   shoal.js      the school as one body: heading, depth, tempo
 *   behaviors.js  what a fish wants: states, habits, staying together
 *   swim.js       how a fish gets there. Nose first, always.
 */

import { loadDorade, createDoradePool, poseSpine } from './dorade.js';
import { createFlock } from './flock.js';
import { CRUISE_SPEED, TAIL_RATE } from './shoal.js';

const CORE_COUNT = 20;
const ROAM_COUNT = 20;
const BODY_LENGTH = 0.45;

export async function createShoreSchool(scene) {
  const stale = [];
  scene.traverse((o) => { if (o.name === 'dorade') stale.push(o); });
  for (const o of stale) o.removeFromParent();
  const template = await loadDorade(BODY_LENGTH);
  const pool = createDoradePool(template, CORE_COUNT + ROAM_COUNT);
  const fishes = [];
  for (let i = 0; i < CORE_COUNT + ROAM_COUNT; i++) {
    const fish = pool.acquire();
    scene.add(fish.holder);
    fishes.push(fish);
  }
  const flock = createFlock(fishes, { roamers: ROAM_COUNT, bodyLength: BODY_LENGTH });
  return {
    fishes,
    place: flock.place,
    take: flock.take,
    giveBack: flock.giveBack,
    mouth: flock.mouth,
    hang: flock.hang,
    keep: flock.keep,
    update(dt, rate, rocks, cam) {
      flock.step(dt, rate, rocks, cam);
      // The tail beats in step with the distance covered, or with the fish's effort when
      // that is more (swim.js), then the spine wave goes on top.
      const tail = (rate * TAIL_RATE) / CRUISE_SPEED;
      for (const fish of fishes) {
        fish.action.setEffectiveTimeScale(tail * fish.stroke);
        fish.mixer.update(dt);
        poseSpine(fish, fish.drive, fish.bend);
      }
    },
  };
}
