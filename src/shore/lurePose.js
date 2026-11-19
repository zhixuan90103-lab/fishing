/**
 * Which way the lure faces: its nose and its back.
 *
 * Owns: turning the nose along the line, the tail trailing a moving rod tip while the
 * lure is held there, a sinking lure going nose down and rocking, and carrying the back
 * round with the nose.
 * Does not own: where the lure is or how it moves (lureMove.js hands in what this needs
 * and shows the nose and back as its own), the model (lure.js), or any fishing rule.
 * No Three, no scene: it runs in Node. Design: docs/LURE.md section 3.
 *
 * Hanging from the tip its nose points straight up, and there "back as near up as it
 * goes" has no answer: worked out afresh each frame, the back flips half a turn whenever
 * the nose wobbles through vertical. So the back is carried as a vector, the keel, turned
 * a little each frame with the nose, and only eased upright while the nose lies near
 * level. What is shown is the keel with the rock of a sinking lure laid on: the rock is
 * never stored in it, so it cannot build up.
 *
 * Units: metres, seconds, radians.
 */

// How fast the nose turns to follow the line, 1/s.
const NOSE_RATE = 10;
// In the water the nose lies nearer level than the line: this share of the line's slope.
const NOSE_LEVEL = 0.25;
// Sinking, its nose goes down: this far below where the line would lay it, as a share of
// a level unit, at full sinking speed. And it rocks from side to side about its own
// length as it goes: this far each way, radians, once over for every ROCK_EVERY metres
// sunk. Not a tail beat: a lure that beats its tail with its nose toward the angler
// reads as swimming in, when it is only going down.
const SINK_DIP = 1;
const SINK_ROCK = 0.5;
const ROCK_EVERY = 0.45;
// Held at the tip it is not stiff: its tail trails behind the tip's movement. The tail
// hangs this far below the tie, m, follows it at this rate, 1/s, and the body never
// tilts further than this, radians. It eases into that, it does not hit it.
const SWAY_ARM = 0.09;
const SWAY_RATE = 9;
const SWAY_MOST = 28 * Math.PI / 180;
// How fast it rolls upright, back to the sky, with the nose level, 1/s. Less the steeper
// the nose, and not at all with it straight up or down, where there is no upright.
const UPRIGHT_RATE = 7;

export function createLurePose() {
  // Which way the nose points. Not kept to unit length: the model normalises it.
  const nose = { x: 0, y: 1, z: 0 };
  // Which way its back faces: a unit vector square to the nose, the rock laid on.
  const back = { x: 0, y: 0, z: 1 };
  // Its back before any rock is laid on: this is what is carried from frame to frame.
  const keel = { x: 0, y: 0, z: 1 };
  // Metres it has sunk under its own weight, for the rock.
  let sunk = 0;
  // Held at the tip: where its tail is, level, and where the tail was last asked to be.
  let tailX = 0, tailZ = 0;
  let lastTailX = 0, lastTailZ = 0;

  // Keep the keel square to the nose as the nose turns, without spinning it about the
  // nose, then roll it toward upright by as much as the nose is level. And show it.
  // sinking, full: how fast the lure is sinking, and the fastest it does, m/s.
  function carryBack(dt, sinking, full) {
    const nl = Math.hypot(nose.x, nose.y, nose.z) || 1;
    const nx = nose.x / nl, ny = nose.y / nl, nz = nose.z / nl;
    const b = keel;
    const along = b.x * nx + b.y * ny + b.z * nz;
    let bx = b.x - nx * along, by = b.y - ny * along, bz = b.z - nz * along;
    let bl = Math.hypot(bx, by, bz);
    if (bl < 1e-6) {
      // The back lay along the nose: any direction square to it will do.
      bx = Math.abs(ny) < 0.9 ? -nx * ny : 1 - nx * nx;
      by = Math.abs(ny) < 0.9 ? 1 - ny * ny : -ny * nx;
      bz = Math.abs(ny) < 0.9 ? -nz * ny : -nz * nx;
      bl = Math.hypot(bx, by, bz);
    }
    bx /= bl; by /= bl; bz /= bl;
    // Upright: the part of straight up that is square to the nose.
    const level = 1 - ny * ny;
    if (dt > 0 && level > 1e-6) {
      const ux = -nx * ny, uy = 1 - ny * ny, uz = -nz * ny;
      // The angle from the back round to upright, about the nose.
      const cross = (by * uz - bz * uy) * nx + (bz * ux - bx * uz) * ny + (bx * uy - by * ux) * nz;
      const dot = bx * ux + by * uy + bz * uz;
      const turn = Math.atan2(cross, dot) * (1 - Math.exp(-UPRIGHT_RATE * level * dt));
      const c = Math.cos(turn), s = Math.sin(turn);
      const rx = bx * c + (ny * bz - nz * by) * s;
      const ry = by * c + (nz * bx - nx * bz) * s;
      const rz = bz * c + (nx * by - ny * bx) * s;
      bx = rx; by = ry; bz = rz;
    }
    b.x = bx; b.y = by; b.z = bz;
    // What is shown: the keel, rocked about the nose by as much as it is sinking.
    const rock = SINK_ROCK * (sinking / full) * Math.sin(2 * Math.PI * sunk / ROCK_EVERY);
    const c = Math.cos(rock), s = Math.sin(rock);
    back.x = bx * c + (ny * bz - nz * by) * s;
    back.y = by * c + (nz * bx - nx * bz) * s;
    back.z = bz * c + (nx * by - ny * bx) * s;
  }

  return {
    nose,
    back,

    // Held at the rod tip, at (x, z) level: the nose points up at the tip, with the tail
    // trailing behind however the tip is moving. A wave of the rod sways it, a still rod
    // lets it hang true. Once a frame. dt of 0 hangs it true at once, for the very start.
    sway(dt, x, z) {
      // Where the tail would hang with the tip still, and the tail chasing that.
      const tx = x, tz = z;
      if (!(dt > 0)) {
        tailX = lastTailX = tx;
        tailZ = lastTailZ = tz;
      } else {
        const keep = Math.exp(-SWAY_RATE * dt);
        const share = 1 - (1 - keep) / (SWAY_RATE * dt);
        tailX = lastTailX + (tailX - lastTailX) * keep + (tx - lastTailX) * share;
        tailZ = lastTailZ + (tailZ - lastTailZ) * keep + (tz - lastTailZ) * share;
        lastTailX = tx;
        lastTailZ = tz;
      }
      // The tilt that lag makes, eased into its most.
      const lagX = tx - tailX, lagZ = tz - tailZ;
      const lag = Math.hypot(lagX, lagZ);
      const tilt = SWAY_MOST * Math.tanh(Math.atan2(lag, SWAY_ARM) / SWAY_MOST);
      const lean = lag > 1e-9 ? Math.sin(tilt) / lag : 0;
      const k = dt > 0 ? 1 - Math.exp(-NOSE_RATE * dt) : 1;
      nose.x += (lagX * lean - nose.x) * k;
      nose.y += (Math.cos(tilt) - nose.y) * k;
      nose.z += (lagZ * lean - nose.z) * k;
      carryBack(dt, 0, 1);
    },

    /**
     * On a line: the nose turns toward the rod tip, which lies (tx, ty, tz) from the
     * lure. swimming: it is in the water, and lies flatter than the line. sinking, full:
     * how fast it is sinking under its own weight and the fastest it does, m/s: sinking,
     * the nose goes down first.
     */
    follow(dt, tx, ty, tz, swimming, sinking, full) {
      if (swimming) ty *= NOSE_LEVEL;
      let len = Math.hypot(tx, ty, tz) || 1;
      if (swimming && sinking > 0) {
        ty -= len * SINK_DIP * sinking / full;
        len = Math.hypot(tx, ty, tz) || 1;
      }
      const k = 1 - Math.exp(-NOSE_RATE * dt);
      nose.x += (tx / len - nose.x) * k;
      nose.y += (ty / len - nose.y) * k;
      nose.z += (tz / len - nose.z) * k;
      carryBack(dt, sinking, full);
    },

    // It has sunk this much further, m. The rock goes by distance sunk, not by time.
    sink(metres) {
      sunk += metres;
    },
  };
}
