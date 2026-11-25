/**
 * Fright: what frightens a fish at the lure and by how much, and whether it has the
 * nerve to stay.
 *
 * Owns: the fright each thing gives a fish, how far from the lure a strike is felt, how
 * much a fish stands before it bolts, how long it keeps off the lure after, and how it
 * gets over it.
 * Does not own: which fish are near enough to be frightened (suitors.js), or what a fish
 * that bolts does (flee.js).
 * No Three, no scene: it runs in Node. Rule: docs/FISHING-REQUIREMENTS.md section 8.
 * Design: docs/PLAY.md section 7.
 *
 * A strike that hooks nothing frightens every fish near the lure: the one biting most,
 * the ones beside it less, and less the further off. Fright adds up, and each fish
 * decides for itself: it stays while its fright is under its nerve, and a hungry fish
 * has more nerve than a full one, which has no need to take chances. A fish that stays
 * gets over it, slowly, and keeps off the lure until it has: a strike that missed leaves
 * the water quiet for a while.
 *
 * Units: metres, seconds. Fright is 0, calm, upward; a bolting fish carries no more than 1.
 */

// The fright each thing gives the fish at the lure: a strike that found nothing in its
// mouth, a strike at a fish that had only nipped, the lure wound out of its mouth, and
// a hook thrown in a fight. And what a strike, or a fish being hooked beside it, gives
// a fish that was only near: this much right at the lure, falling to nothing NEAR
// metres off.
export const FRIGHT = { missed: 1.3, nipped: 0.8, drawn: 0.8, shed: 1, beside: 0.8 };
export const NEAR = 6;
// How much fright a fish stands before it bolts: a full fish, and a starved one.
const NERVE = [0.3, 1.5];
// A fish that stayed gets over its fright at this rate, a second.
const GETS_OVER = 0.05;
// And until its fright is down to this share of its nerve it keeps off the lure: it
// idles round it and does not go for it.
const WARY_ABOVE = 0.25;
// The fright a fish stands before it bolts. hunger: 0 full to 1 starved.
export function nerveOf(hunger) {
  return NERVE[0] + (NERVE[1] - NERVE[0]) * Math.min(1, Math.max(0, hunger));
}

// Whether a fish that stayed is still too frightened to go for the lure.
export function wary(fright, hunger) {
  return fright > WARY_ABOVE * nerveOf(hunger);
}

// The fright of a fish that stayed, dt seconds on.
export function getsOver(fright, dt) {
  return Math.max(0, fright - GETS_OVER * dt);
}

// What a strike gives a fish this far from the lure, level metres, that was not biting.
export function frightBeside(far) {
  return FRIGHT.beside * Math.max(0, 1 - far / NEAR);
}
