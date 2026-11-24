/**
 * One bite: what kind it is, whether the hook is in the mouth right now, how hard the
 * fish plucks the line, and what a strike or a wound-in line does to it.
 *
 * Owns: how hungry a fish is, which kind of bite a touch turns into, how long the hook
 * is held in the mouth, the pluck on the line, and when winding has drawn the lure out.
 * Does not own: which fish comes or when it touches (suitors.js, visit.js), reading the
 * strike (strike.js), what the fish does once it bolts (flee.js), or the line.
 * No Three, no scene: it runs in Node. Rule: docs/FISHING-REQUIREMENTS.md section 8.
 * Design: docs/PLAY.md section 7.
 *
 * A bite is a touch, then perhaps the hook in the mouth for a while, then a moment in
 * which the fish is still at the lure having let it go, then it is over.
 *   light   a nip. The hook never goes in. A strike finds nothing.
 *   medium  taken in and blown out almost at once. A strike has to fall in that moment.
 *   heavy   held a good while longer, and held harder.
 *   dead    a heavy bite in which the hook scrapes home as it goes in: hooked, no strike.
 * Winding while the hook is in the mouth draws the lure out of it, once so much line
 * has been taken: more for a heavy bite, which is held harder.
 *
 * What the rod and the hand get of a bite is its pull on the line, in newtons: a pluck
 * as the fish touches or takes the lure, and while the hook is in the mouth the steady
 * drag of a fish holding it. The line is stiff, a centimetre of stretch is newtons, so
 * the pull is said here as a force and not left to how far the fish happens to swim.
 *
 * Units: seconds, newtons, metres.
 */

import { between } from './maths.js';

// From the touch to the hook going in, s. A strike this early is ahead of the fish.
const TOUCH_FOR = [0.08, 0.14];
// How long each kind holds the hook, s. A light bite is over in this long, hook never in.
const LIGHT_FOR = [0.25, 0.4];
const MEDIUM_HOLDS = [0.5, 0.7];
const HEAVY_HOLDS = [1.2, 1.7];
// Having let go, the fish is still at the lure for this long, s: a strike now is late,
// and frightens it. After that the bite is over and a strike is at nothing.
const LETS_GO_FOR = 0.3;
// Line wound in with the hook in the mouth draws the lure out after this much, m.
const DRAWN_OUT = { medium: 0.1, heavy: 0.3 };

// Which bite. Appeal is 0 to 1: how hungry the fish is, and how good a mouthful the
// lure looked as it was touched (allure.js: best swimming slowly, worst hauled in
// fast). A full fish at a poor lure nips. Of every bite this share is medium whatever
// the appeal.
const HUNGER_COUNTS = 0.6;
const TASTE_COUNTS = 0.4;
const LIGHT_SHARE = [0.6, 0.15];
const MEDIUM_SHARE = 0.3;
// Of heavy bites, the share in which the hook scrapes home: from a full fish to a
// starved one.
const SCRAPES = [0.04, 0.3];

// The pluck on the line as the fish touches or takes the lure, N for a fish of full
// heft, and how long it lasts, s: one rise and fall. A heavy bite plucks again as it
// mouths the lure, this often, s, each a share of the last.
const PLUCK = { light: 2, medium: 5, heavy: 9, dead: 9 };
const PLUCK_FOR = { light: 0.09, medium: 0.12, heavy: 0.16, dead: 0.16 };
const PLUCKS_AGAIN = [0.3, 0.5];
const AGAIN_SHARE = 0.6;
// With the hook in its mouth the fish drags on the line this hard, N at full heft, until
// it lets go: the tip stays drawn down, and springs back when the lure is blown out.
const DRAGS = { medium: 2, heavy: 5, dead: 5 };
// The smallest fish plucks this share as hard as the biggest.
const SMALL_SHARE = 0.5;
// The knock in the hand with each pluck: how strong and how sharp, at full heft.
const KNOCK = { light: [0.3, 0.8], medium: [0.6, 0.6], heavy: [0.95, 0.35], dead: [0.95, 0.35] };

/**
 * How hungry a fish coming to the lure is, 0 full to 1 starved, drawn with random().
 * starved: after a long while with nothing landed, the next fish is from the hungry half.
 */
export function drawHunger(random, starved = false) {
  return starved ? 0.5 + 0.5 * random() : random();
}

export function createBite(random) {
  // Seconds since the touch, when the hook goes in and comes out, and when the bite ends.
  let age = 0;
  let inAt = 0;
  let outAt = 0;
  let endAt = 0;
  // Line wound in since the hook went in, m.
  let wound = 0;
  // The pluck now under way: seconds into it, how long it lasts, its peak, N. And when
  // the next one starts, by the bite's age.
  let pluckAge = 0;
  let pluckFor = 0;
  let pluckPeak = 0;
  let pluckNext = Infinity;
  let heft = 1;
  const knock = { intensity: 0, sharpness: 0 };

  function pluck(share) {
    pluckAge = 0;
    pluckFor = PLUCK_FOR[bite.kind];
    pluckPeak = PLUCK[bite.kind] * heft * share;
    knock.intensity = KNOCK[bite.kind][0] * (SMALL_SHARE + (1 - SMALL_SHARE) * heft) * (0.5 + 0.5 * share);
    knock.sharpness = KNOCK[bite.kind][1];
    return knock;
  }

  const bite = {
    // '' with no bite under way, else 'light', 'medium', 'heavy' or 'dead'.
    kind: '',
    // The hook is in the mouth this frame.
    held: false,
    // The fish's pull on the line this frame, N: the pluck, as its mean over the frame so
    // a slow frame neither misses it nor makes more of it, and the drag of a held hook.
    pull: 0,

    /**
     * A fish has touched the lure. hunger: 0 to 1. taste: how good the lure looked as
     * it was touched, 0 to 1. big: how big a fish, 0 the smallest to 1 the biggest.
     */
    begin(hunger, taste, big) {
      const appeal = HUNGER_COUNTS * hunger + TASTE_COUNTS * Math.min(1, Math.max(0, taste));
      const light = LIGHT_SHARE[0] + (LIGHT_SHARE[1] - LIGHT_SHARE[0]) * appeal;
      const draw = random();
      bite.kind = draw < light ? 'light' : draw < light + MEDIUM_SHARE ? 'medium' : 'heavy';
      if (bite.kind === 'heavy' && random() < SCRAPES[0] + (SCRAPES[1] - SCRAPES[0]) * hunger) bite.kind = 'dead';
      heft = SMALL_SHARE + (1 - SMALL_SHARE) * Math.min(1, Math.max(0, big));
      age = 0;
      wound = 0;
      bite.held = false;
      bite.pull = 0;
      pluckFor = 0;
      pluckNext = Infinity;
      if (bite.kind === 'light') {
        inAt = outAt = Infinity;
        endAt = between(random, LIGHT_FOR);
      } else {
        inAt = between(random, TOUCH_FOR);
        outAt = inAt + between(random, bite.kind === 'medium' ? MEDIUM_HOLDS : HEAVY_HOLDS);
        endAt = outAt + LETS_GO_FOR;
      }
    },

    // The bite is off: the fish has gone, or been hooked.
    end() {
      bite.kind = '';
      bite.held = false;
      bite.pull = 0;
      pluckFor = 0;
    },

    /**
     * Once a frame while a bite is under way. taken: line wound in this frame, m.
     * Sets held and pull, and returns what happened in the frame:
     *   null      nothing new.
     *   'knock'   a pluck began: bite.knock is what the hand feels.
     *   'scraped' a dead bite's hook went home: the fish is hooked.
     *   'drawn'   winding has pulled the lure out of its mouth.
     *   'over'    the bite has passed, the fish still there.
     */
    step(dt, taken) {
      if (!bite.kind || !(dt > 0)) return null;
      const before = age;
      age += dt;
      let happened = null;
      // A light bite plucks at the touch. The others as the hook goes in.
      const starts = bite.kind === 'light' ? 0 : inAt;
      if (before <= starts && age > starts) {
        pluck(1);
        happened = 'knock';
        if (bite.kind === 'heavy') pluckNext = age + between(random, PLUCKS_AGAIN);
      } else if (age >= pluckNext && age < outAt) {
        pluck(AGAIN_SHARE);
        happened = 'knock';
        pluckNext = age + between(random, PLUCKS_AGAIN);
      }
      // The mean of one rise and fall over this frame's part of it.
      bite.pull = 0;
      if (pluckFor > 0) {
        const a = Math.min(1, pluckAge / pluckFor);
        pluckAge += dt;
        const b = Math.min(1, pluckAge / pluckFor);
        bite.pull = pluckPeak * (Math.cos(Math.PI * a) - Math.cos(Math.PI * b)) / Math.PI * pluckFor / dt;
        if (b >= 1) pluckFor = 0;
      }
      if (age > inAt && bite.kind === 'dead') return 'scraped';
      bite.held = age > inAt && age <= outAt;
      if (bite.held) {
        bite.pull += DRAGS[bite.kind] * heft;
        wound += taken;
        if (wound > DRAWN_OUT[bite.kind]) return 'drawn';
      }
      if (age > endAt) {
        bite.end();
        return 'over';
      }
      return happened;
    },

    // What the hand feels of the pluck that just began: intensity and sharpness, 0 to 1.
    knock,
  };
  return bite;
}
