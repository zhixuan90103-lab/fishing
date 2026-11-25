/**
 * What a thing going along the water leaves on it: the line where it goes in, a hooked
 * fish, the lure towed along under it.
 *
 * Owns: for each of those, what it weighs as far as the water is concerned, how much of
 * its wake's strength goes into the water, how often it leaves a piece, and how much
 * taller its wake stands when it is at the very top; and turning a wake's reading into a
 * piece of wake on the water.
 * Does not own: how fast the thing is going or how strong its wake is (wakeTrack.js), the
 * piece itself and what depth does to it (rippleField.js), or leading the wake (whoever
 * has the thing: play for the fish, startShore.js for the line and the lure).
 * No Three, no scene: it runs in Node. Design: docs/SPLASH.md section 9.
 *
 * Units: kilograms, seconds, metres.
 */

import { LURE_KG } from './lureMove.js';
import { atTop, inWater } from './waterTop.js';

// weight: what makes rings the size of this thing's, kg, unless whoever leads its wake
// says what it weighs (a fish: each has its own). share: this much of how strong
// its wake is goes into the water. every: it leaves a piece this often, s. atTop: at the
// very top of the water its wake stands this many times as tall, and no wider.
// The pieces of one wake lie on top of one another along its arms. Measured from above,
// drawn along steadily at the surface: the fish's arms stand 8.5 cm at 4 m/s, the line's
// 0.25 cm at 2 m/s.
// The line is a thread.
// It leaves a piece a little less often than its wake would join up at: it is faint, and
// the fish's wake is the one to spend on.
export const LINE_WAKE = { weight: 0.0003, share: 0.35, every: 0.1, atTop: 1 };
// A fish: play says what this one weighs, 0.66 to 2.16 kg (until 2026-11-25 every fish
// was taken as 1.2). Cutting the top of the water with its back it throws it about far
// more than one just under.
export const FISH_WAKE = { weight: 1.2, share: 1.3, every: 0.12, atTop: 2 };
// The lure drawn along under the water raises a soft furrow over itself.
export const LURE_WAKE = { weight: LURE_KG, share: 1.2, every: 0.1, atTop: 1 };

/**
 * The piece of wake this thing leaves where its wake's track is now, for trail() in
 * rippleField.js. mark: one of the three above. track: the wake's own reading
 * (wakeTrack.js): x, z, strength, dirX, dirZ, speed, depth.
 */
export function pieceOf(mark, track) {
  return {
    x: track.x,
    z: track.z,
    strength: track.strength * mark.share * inWater(track.depth),
    weight: track.weight ?? mark.weight,
    dirX: track.dirX,
    dirZ: track.dirZ,
    speed: track.speed,
    depth: Math.max(0, track.depth),
    taller: 1 + (mark.atTop - 1) * atTop(track.depth),
  };
}

/**
 * What a wake's track is given to leave this thing's marks on the water. water: where
 * the pieces go, with trail() (rippleField.js or ripples.js).
 */
export function marksOf(mark, water) {
  return {
    every: mark.every,
    hit(track) {
      water.trail(pieceOf(mark, track));
    },
  };
}
