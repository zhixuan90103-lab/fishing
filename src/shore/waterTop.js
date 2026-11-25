/**
 * The top of the water: how much a thing at a depth is at it, and how much of it is in
 * the water at all.
 *
 * Owns: where the top of the water begins and ends for a thing that is near it.
 * Does not own: what being at the top does: spray is the wake's (wakeTrack.js), how tall
 * a wake stands there is the wake marks' (wakeMarks.js), and how the water over a thing
 * deeper down swells is the rings' (rippleField.js).
 * No Three, no scene: it runs in Node. Design: docs/SPLASH.md section 9.
 *
 * Units: metres. depth: how far under the surface a thing is; below zero it is that far
 * out of the water.
 */

// A thing within TOP m of the surface is at the top of the water. By DEEP m under it is
// not at all.
const TOP = 0.04;
const DEEP = 0.14;
// A thing that has come up out of the water is not moving it: by OUT m above the surface
// it leaves nothing on it.
const OUT = 0.05;

// How much of a thing is left in the water for its being out of it: all of it under the
// surface and at it, none by OUT m above.
export function inWater(depth) {
  return depth < 0 ? Math.max(0, 1 + depth / OUT) : 1;
}

// How much a thing at this depth is at the top of the water: 1 within TOP of the
// surface, 0 from DEEP down, and 0 again by OUT above it.
export function atTop(depth) {
  if (depth < 0) return inWater(depth);
  return Math.min(1, Math.max(0, (DEEP - depth) / (DEEP - TOP)));
}
