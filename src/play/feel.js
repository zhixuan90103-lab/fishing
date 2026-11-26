/**
 * What the hand on the rod feels this frame.
 *
 * Owns: the one continuous vibration, and which knock is primary so the continuous
 * one yields. Does not own: when a bite, a cast or the reel asks for one (bite.js,
 * fishing.js, catch.js), or playing it (fishing.js hands the frame to the haptics).
 * No Three, no scene: it runs in Node. Design: docs/PLAY.md section 14.
 *
 * One continuous at a time. A knock is the primary for a short moment and the
 * continuous drops while it is. Nothing is queued to play later.
 */

// How long a knock keeps the continuous down, s, and the share it is held at.
const DUCK_FOR = 0.07;
const DUCK_TO = 0.35;

export function createFeel() {
  let want = 0;
  let duck = 0;
  let hitI = 0;
  let hitS = 0;
  let hitOn = false;

  return {
    // The continuous wanted this frame, 0 to 1, before it yields to a knock.
    bed(level) {
      want = level > 0 ? Math.min(1, level) : 0;
    },

    // A primary knock. The latest one in the frame is the one that plays.
    hit(intensity, sharpness) {
      hitOn = true;
      hitI = Math.min(1, Math.max(0, intensity));
      hitS = Math.min(1, Math.max(0, sharpness));
      duck = DUCK_FOR;
    },

    /**
     * Once a frame, after every hit and the bed have been asked for.
     * Returns { bed, knock }. knock is null when nothing primary happened.
     */
    step(dt) {
      const bed = duck > 0 ? want * DUCK_TO : want;
      if (dt > 0 && duck > 0) duck = Math.max(0, duck - dt);
      const knock = hitOn ? { intensity: hitI, sharpness: hitS } : null;
      hitOn = false;
      return { bed, knock };
    },
  };
}
