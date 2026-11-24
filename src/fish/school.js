/**
 * The dorade school on the shore: the real fish for the flock simulation, plus their
 * body animation. Design and rules: docs/FISH-SCHOOL.md
 *
 * Owns: taking forty fish from the pool into the scene, handing the flock's ports on,
 * and each frame playing the tail clip and laying the spine wave on it.
 * Does not own: anything a fish does (flock.js and below), or the model (dorade.js).
 *
 *   dorade.js     model, pool, spine pose
 *   flock.js      one frame of all the fish
 *   behaviors.js  what a free fish wants: its own mind
 *   neighbours.js what it can tell of the fish around it
 *   homeWater.js  the water they keep to
 *   swim.js       how a fish gets there. Nose first, always.
 */

import { loadDorade, createDoradePool, poseSpine } from './dorade.js';
import { createFlock } from './flock.js';

const COUNT = 40;
// The tail clip plays TAIL_RATE times as fast as it was made for each TAIL_SPEED m/s the
// fish covers.
const TAIL_SPEED = 0.351;
const TAIL_RATE = 2.2;
const BODY_LENGTH = 0.45;

export async function createShoreSchool(scene) {
  const stale = [];
  scene.traverse((o) => { if (o.name === 'dorade') stale.push(o); });
  for (const o of stale) o.removeFromParent();
  const template = await loadDorade(BODY_LENGTH);
  const pool = createDoradePool(template, COUNT);
  const fishes = [];
  for (let i = 0; i < COUNT; i++) {
    const fish = pool.acquire();
    scene.add(fish.holder);
    fishes.push(fish);
  }
  const flock = createFlock(fishes, { bodyLength: BODY_LENGTH });
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
      const tail = (rate * TAIL_RATE) / TAIL_SPEED;
      for (const fish of fishes) {
        fish.action.setEffectiveTimeScale(tail * fish.stroke);
        fish.mixer.update(dt);
        poseSpine(fish, fish.drive, fish.bend);
      }
    },
  };
}
