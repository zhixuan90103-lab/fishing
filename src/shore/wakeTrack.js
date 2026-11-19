/**
 * Something cutting along the water's surface: how fast, which way, and the drops it throws.
 * No Three and no scene, so it runs in Node.
 *
 * Owns: reading the speed and heading of a point that is led along the surface, how
 * strong a wake that makes, and the drops of spray it throws up.
 * Does not own: drawing (wake.js), what the point is (a line where it goes into the water,
 * or a fish near the top), or any fishing rule.
 *
 * A wake has no say in when it is there. It is as strong as the thing is fast: below
 * QUIET there is none, and it comes on to its fullest by FULL. Stop the thing and it
 * dies away. Nobody turns it on.
 *
 * The speed is not a difference of two frames. A point chases the place, and how far it
 * trails is the speed: steady, and the same at any frame rate.
 *
 * Units: metres, seconds. The surface is y = 0, and x, z lie in it.
 */

// How closely the trailing point follows, 1/s. The speed read is about 1 / TRAIL s old.
const TRAIL = 9;
// Below this speed, m/s, nothing shows. At FULL and over, the wake is at its strongest.
const QUIET = 0.3;
const FULL = 2.4;
// How fast the wake comes up and dies away, 1/s.
const COMES = 7;
const DIES = 2.5;
// Spray: no drops below this speed, m/s. Over it, this many a metre travelled at the
// wake's strongest.
const SPRAY_ABOVE = 1.1;
const DROPS_A_METRE = 9;
// A drop is thrown up at between these, m/s, out to the side and back at up to this,
// and lasts this long, s.
const DROP_UP = [0.9, 2.1];
const DROP_OUT = 0.7;
const DROP_LIFE = 0.42;
const GRAVITY = 9.81;

/** drops: how many drops of spray it can have in the air at once. */
export function createWakeTrack(drops = 32, random = Math.random) {
  const trail = { x: 0, z: 0 };
  const last = { x: 0, z: 0 };
  let known = false;
  // Metres travelled since the last drop.
  let owed = 0;
  let next = 0;

  const track = {
    // Where it is, and the unit direction it is going.
    x: 0,
    z: 0,
    dirX: 0,
    dirZ: 1,
    // How fast it is going, m/s, and how strong its wake is, 0 to 1.
    speed: 0,
    strength: 0,
    // The drops: x, y, z and how much of its life each has left, 1 to 0. 0 is none.
    drops: Array.from({ length: drops }, () => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, left: 0 })),

    // Forget where it was: it is not on the surface. The wake dies away where it lay.
    lift(dt) {
      known = false;
      track.speed = 0;
      track.strength += (0 - track.strength) * (1 - Math.exp(-DIES * dt));
      age(dt);
    },

    /**
     * Once a frame while it is on the surface at (x, z). share: how much of a wake it can
     * make at all, 0 to 1: a fish deeper down makes less.
     */
    follow(dt, x, z, share = 1) {
      if (!(dt > 0)) return;
      if (!known) {
        trail.x = last.x = x;
        trail.z = last.z = z;
        known = true;
      }
      // Exact for a point that moves evenly through the frame.
      const keep = Math.exp(-TRAIL * dt);
      const part = 1 - (1 - keep) / (TRAIL * dt);
      const moved = Math.hypot(x - last.x, z - last.z);
      trail.x = last.x + (trail.x - last.x) * keep + (x - last.x) * part;
      trail.z = last.z + (trail.z - last.z) * keep + (z - last.z) * part;
      last.x = x;
      last.z = z;
      const lx = x - trail.x;
      const lz = z - trail.z;
      const lag = Math.hypot(lx, lz);
      track.x = x;
      track.z = z;
      track.speed = lag * TRAIL;
      if (lag > 1e-5) {
        track.dirX = lx / lag;
        track.dirZ = lz / lag;
      }
      const to = Math.min(1, Math.max(0, (track.speed - QUIET) / (FULL - QUIET))) * Math.min(1, Math.max(0, share));
      track.strength += (to - track.strength) * (1 - Math.exp(-(to > track.strength ? COMES : DIES) * dt));
      // Spray is thrown by the distance covered, not by the clock.
      if (track.speed > SPRAY_ABOVE) {
        owed += moved * DROPS_A_METRE * track.strength;
        while (owed >= 1) {
          owed -= 1;
          throwDrop();
        }
      }
      age(dt);
    },
  };

  function throwDrop() {
    const d = track.drops[next];
    next = (next + 1) % track.drops.length;
    const out = (random() * 2 - 1) * DROP_OUT;
    const back = random() * DROP_OUT;
    d.x = track.x;
    d.y = 0;
    d.z = track.z;
    // Out to the side, across the way it is going, and a little back.
    d.vx = -track.dirZ * out - track.dirX * back;
    d.vz = track.dirX * out - track.dirZ * back;
    d.vy = DROP_UP[0] + random() * (DROP_UP[1] - DROP_UP[0]);
    d.left = 1;
  }

  function age(dt) {
    for (const d of track.drops) {
      if (!(d.left > 0)) continue;
      d.left -= dt / DROP_LIFE;
      d.vy -= GRAVITY * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.z += d.vz * dt;
      if (d.y < 0 || d.left <= 0) d.left = 0;
    }
  }

  return track;
}
