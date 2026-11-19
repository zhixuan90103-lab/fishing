/**
 * How much of a landed fish's weight is on the line, for how far out of the water it is.
 *
 * Owns: the share of its weight a fish has under water, and the heights of the hook
 * between which it leaves the water and the rest comes on.
 * Does not own: carrying that weight (the fish hangs on the line, and the line brings it
 * onto the rod tip: catch.js gives these numbers to the lure it hangs from,
 * src/shore/lureMove.js), where the hook is, or what the fish weighs (fishKind.js).
 * No Three, no scene: it runs in Node. Design: docs/PLAY.md section 10.
 *
 * The weight used to be put on the rod tip apart from the line, because a soft blank and
 * a short stiff line waiting on each other a frame apart made the tension jump. The rod
 * now moves a hanging weight in step with itself, so it goes through the line.
 *
 * Units: metres.
 */

// Still in the water a fish puts this share of its weight on the line: what the water
// does not carry, and its hanging back. The same number is what it pulls with when it
// is doing nothing at all in a fight (fishKind.js).
export const SUNK_SHARE = 0.45;
// The weight comes on as the hook rises between these, metres: the fish has some length
// and leaves the water bit by bit.
export const DRY_FROM = -0.3;
export const DRY_BY = 0.25;

// How far out of the water a fish is with the hook at this height: 0 under, 1 clear.
export function dryness(hookY) {
  return Math.min(1, Math.max(0, (hookY - DRY_FROM) / (DRY_BY - DRY_FROM)));
}
