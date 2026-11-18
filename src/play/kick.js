/**
 * How hard a landed fish is kicking right now.
 *
 * Owns: the moments that set a hung fish off, how much harder it kicks at each, and how
 * that dies away.
 * Does not own: what a kick looks like (src/fish/hung.js is given the number this
 * reports), where the fish is, or the net.
 * No Three, no scene: it runs in Node. Design: docs/PLAY.md section 10.
 *
 * A hung fish that only winds down looks dead by the time it is in the net. So it is set
 * off again: as it breaks the surface, as it lands in the net, and in fits while it lies
 * there.
 */

// How much harder than usual it kicks as it breaks the surface and as it lands in the
// net, on top of 1, and how fast that dies away, 1/s.
const KICK_SURFACE = 1.3;
const KICK_NET = 2.2;
const KICK_FADE = 1.6;
// It breaks the surface when it is this far out of the water, 0 to 1.
const BREAKS_AT = 0.5;
// In the net it goes on kicking in fits: another one this often, s, each this strong.
const FIT_EVERY = [0.35, 0.8];
const FIT_KICK = 1.4;

/** random: 0 to 1, for when the next fit comes. */
export function createKick(random = Math.random) {
  let extra = 0;
  let broke = false;
  let fitIn = 0;

  const untilNext = () => FIT_EVERY[0] + random() * (FIT_EVERY[1] - FIT_EVERY[0]);

  return {
    // How hard it is kicking: 1 is the usual.
    get vigor() {
      return 1 + extra;
    },

    // A fish has just been landed.
    reset() {
      extra = 0;
      broke = false;
    },

    // Once a frame: the last kick dies away.
    fade(dt) {
      extra *= Math.exp(-KICK_FADE * dt);
    },

    // It is this far out of the water, 0 to 1. Returns true the one time it breaks the
    // surface.
    rise(dry) {
      if (broke || !(dry > BREAKS_AT)) return false;
      broke = true;
      extra = KICK_SURFACE;
      return true;
    },

    // It has just landed in the net.
    land() {
      extra = KICK_NET;
      fitIn = untilNext();
    },

    // Once a frame while it lies in the net. Returns true on the frame a fit begins.
    lie(dt) {
      fitIn -= dt;
      if (fitIn > 0) return false;
      extra = Math.max(extra, FIT_KICK);
      fitIn = untilNext();
      return true;
    },
  };
}
