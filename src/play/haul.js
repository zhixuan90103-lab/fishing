/**
 * How fast line comes in while the finger is down with a fish on.
 *
 * Owns: the speed of winding against a fish, the tension at which line runs out, and how
 * much runs out.
 * Does not own: the line's length (fishing.js applies what this returns), the tension
 * (line.js reports it), the fish (fight.js), or the empty retrieve (retrieve.js).
 * No Three, no scene: it runs in Node. Rule: docs/FISHING-REQUIREMENTS.md section 11.
 * Design: docs/PLAY.md section 9.
 *
 * Not the empty retrieve's slow-then-steady. The weight comes onto the rod first, and the
 * line then comes in at one speed, less the nearer the tension is to the point where
 * line runs out. Letting go eases it off, it does not stop dead.
 *
 * Past that point the reel gives line, finger down or not: exactly as much as brings the
 * tension back to the point. That is a length, not a rate, so it is the same at any
 * frame rate. A finger held down on a running fish does not stop the line. It leans on
 * it: the reel holds that much more (snap.js says how much), so the tension rises with it.
 *
 * Units: metres, seconds, newtons.
 */

// Line speed against no tension at all, m/s.
const HAUL_SPEED = 2;
// The tension at which line stops coming in and starts running out, N.
export const RUN_OUT_AT = 4.5;
// How fast the speed comes up on a press and dies on release, 1/s.
const TAKE_UP = 4;
const LET_GO = 9;

export function createHaul() {
  const haul = {
    // Line speed right now, m/s.
    speed: 0,

    reset() {
      haul.speed = 0;
    },

    // How much line the reel gives up right now, m. stretch: how much further the hook is
    // from the tip than there is line. stiffness: the line's, N per metre stretched.
    // press: what a hand leaning on the run adds to what the reel holds, N (snap.js).
    slip(stretch, stiffness, press = 0) {
      return Math.max(0, stretch - (RUN_OUT_AT + press) / stiffness);
    },

    // Once a frame. held: the finger is down. tension: the line's pull now, N.
    // Returns the metres of line taken in during the frame.
    step(dt, held, tension) {
      if (!(dt > 0)) return 0;
      const to = held ? HAUL_SPEED * Math.max(0, 1 - tension / RUN_OUT_AT) : 0;
      const rate = to > haul.speed ? TAKE_UP : LET_GO;
      const keep = Math.exp(-rate * dt);
      // Exact for a target that holds through the frame.
      const taken = to * dt + (haul.speed - to) * (1 - keep) / rate;
      haul.speed = to + (haul.speed - to) * keep;
      return taken;
    },
  };
  return haul;
}
