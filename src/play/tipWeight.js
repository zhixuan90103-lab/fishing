/**
 * How much a landed fish weighs on the rod tip.
 *
 * Owns: the weight for how far out of the water the hook is, and feeding it to the rod
 * in small steps as it comes on and goes off.
 * Does not own: the rod (catch.js hands what this returns to rod.setTipLoad), where the
 * hook is, or when the fish is on the hook at all.
 * No Three, no scene: it runs in Node. Design: docs/PLAY.md section 10.
 *
 * The weight goes onto the rod tip, not through the line. A light, soft blank and a
 * short, stiff line wait on each other a frame apart, and the tension jumps between
 * nothing and a spike.
 *
 * Units: metres, seconds, kilograms.
 */

import { toward } from './maths.js';

const GRAVITY = 9.81;

// What a fish weighs on the rod tip once it is out of the water is the fish's own: hang()
// is handed it (the `load` of fishKind.js).
// Still in the water it weighs this share of that. The weight comes on as the hook rises
// from DRY_FROM to DRY_BY, metres: the fish has some length and leaves the water bit by bit.
const SUNK_SHARE = 0.25;
const DRY_FROM = -0.3;
const DRY_BY = 0.25;
// How fast the weight on the tip follows, 1/s, and the step it is given to the rod in, kg.
const LOAD_RATE = 6;
const LOAD_STEP = 0.001;

// How far out of the water a fish is with the hook at this height: 0 under, 1 clear.
export function dryness(hookY) {
  return Math.min(1, Math.max(0, (hookY - DRY_FROM) / (DRY_BY - DRY_FROM)));
}

export function createTipWeight() {
  // What it should be, what it is, and what the rod was last told.
  let aim = 0;
  let now = 0;
  let told = 0;

  return {
    // What the hand has to hold up for it right now, N.
    get pull() {
      return aim * GRAVITY;
    },
    // A fish hangs on the hook, this far out of the water, 0 to 1. load: what it weighs
    // on the tip once clear, kg.
    hang(dry, load) {
      aim = load * (SUNK_SHARE + (1 - SUNK_SHARE) * dry * dry * (3 - 2 * dry));
    },
    // Nothing hangs there.
    off() {
      aim = 0;
    },

    // Once a frame. Returns the weight to tell the rod, kg, or null if it has not changed.
    step(dt) {
      now = toward(now, aim, LOAD_RATE, dt);
      const step = Math.round(now / LOAD_STEP) * LOAD_STEP;
      if (step === told) return null;
      told = step;
      return step;
    },
  };
}
