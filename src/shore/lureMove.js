/**
 * How the lure's body moves: held at the tip, hanging from it, flying through the air,
 * towed through the water by the line.
 *
 * Owns: the lure's position, velocity and the way its nose points, and the ways it moves.
 * Does not own: the model (lure.js), the line or its length (line.js and whoever sets it),
 * which of the three applies, when a cast starts or ends, or any fishing rule.
 * No Three, no scene: it runs in Node. Design: docs/LURE.md.
 *
 * The caller picks one of hold / hang / fly / tow each frame and passes what the line is
 * doing. Each is exact for the frame it is given or runs on a fixed small step, so the
 * path does not depend on the frame rate. Unless it is held, point() then turns the nose
 * along the line.
 *
 * Units: metres, seconds, newtons. World +Y is up, the water surface is y = 0.
 */

const GRAVITY = 9.81;

// Hanging: fixed step, seconds.
const HANG_DT = 1 / 240;
// How fast a swinging lure loses speed in air and under water, 1/s. Higher settles sooner.
const AIR_LOSS = 1.2;
const WATER_LOSS = 7;

// Flying: the angle it leaves at, above level, radians. Higher lobs it, lower drives it.
const LAUNCH_ANGLE = 28 * Math.PI / 180;
// With the line stopped, how fast its forward speed dies, 1/s. It eases to a stop and
// drops, it does not hit a wall.
const BRAKE_RATE = 5;

// Towed: the pull it takes to move the lure through water, newtons per m/s. This is the
// tension a steady retrieve puts on the rod: speed times this.
const WATER_DRAG = 0.35;
// It sinks under its own weight: this fast when nothing is pulling it, m/s. A 10 g
// sinking minnow.
export const SINK_SPEED = 0.35;
// The deepest it goes, metres, and how far above that it starts to slow: it settles, it
// does not hit a floor.
export const SINK_FLOOR = -2.4;
const SINK_EASE = 0.5;
// Pulled along this fast, m/s, its lip holds it up and it stops sinking. Slower, it
// sinks at a share of SINK_SPEED.
const PLANE_SPEED = 0.9;
// Pulled, it comes up along the line, but its lip keeps it from breaking the surface: it
// runs no shallower than this, metres, and noses back down to it this fast, 1/s.
export const RUN_DEPTH = -0.4;
const RUN_RATE = 3;
// It sinks freely while further out than DEPTH_FAR from under the tip, and lets the
// line lift it freely inside DEPTH_NEAR, metres.
const DEPTH_NEAR = 1.5;
const DEPTH_FAR = 4;

// How fast the nose turns to follow the line, 1/s.
const NOSE_RATE = 10;
// In the water the nose lies nearer level than the line: this share of the line's slope.
const NOSE_LEVEL = 0.25;

function smooth(t) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t * t * (3 - 2 * t);
}

export function createLureMove() {
  const m = {
    x: 0, y: 0, z: 0,
    vx: 0, vy: 0, vz: 0,
    // Metres it has swum through the water, level distance. The model wiggles on this.
    swum: 0,
    // How fast it was going when it last hit the water, m/s.
    impact: 0,
    // Which way the nose points. Not kept to unit length: the model normalises it.
    nose: { x: 0, y: 1, z: 0 },

    // Put it somewhere, at rest.
    place(x, y, z) {
      m.x = x; m.y = y; m.z = z;
      m.vx = 0; m.vy = 0; m.vz = 0;
    },

    // Held at a point, nose up, going wherever that point goes. Not a weight on a line:
    // nothing sets it swinging.
    hold(x, y, z) {
      m.place(x, y, z);
      m.nose.x = 0; m.nose.y = 1; m.nose.z = 0;
    },

    // Turn the nose toward the tip, along the line. swimming: lie flatter than the line.
    point(dt, tip, swimming) {
      const tx = tip.x - m.x;
      let ty = tip.y - m.y;
      const tz = tip.z - m.z;
      if (swimming) ty *= NOSE_LEVEL;
      const len = Math.hypot(tx, ty, tz) || 1;
      const k = 1 - Math.exp(-NOSE_RATE * dt);
      m.nose.x += (tx / len - m.nose.x) * k;
      m.nose.y += (ty / len - m.nose.y) * k;
      m.nose.z += (tz / len - m.nose.z) * k;
    },

    // Straight-line distance to a point.
    gap(p) {
      return Math.hypot(p.x - m.x, p.y - m.y, p.z - m.z);
    },

    /**
     * A weight on `length` metres of line below the tip. The line only stops it getting
     * further away than that. tip moved evenly from lastTip through the frame.
     */
    hang(dt, tip, lastTip, length) {
      if (!(dt > 0)) return;
      const tvx = (tip.x - lastTip.x) / dt;
      const tvy = (tip.y - lastTip.y) / dt;
      const tvz = (tip.z - lastTip.z) / dt;
      let done = 0;
      while (done < dt - 1e-9) {
        const h = Math.min(HANG_DT, dt - done);
        done += h;
        const f = done / dt;
        const px = lastTip.x + (tip.x - lastTip.x) * f;
        const py = lastTip.y + (tip.y - lastTip.y) * f;
        const pz = lastTip.z + (tip.z - lastTip.z) * f;
        const keep = Math.exp(-(m.y < 0 ? WATER_LOSS : AIR_LOSS) * h);
        m.vy -= GRAVITY * h;
        m.vx *= keep; m.vy *= keep; m.vz *= keep;
        m.x += m.vx * h; m.y += m.vy * h; m.z += m.vz * h;
        const dx = m.x - px, dy = m.y - py, dz = m.z - pz;
        const d = Math.hypot(dx, dy, dz);
        if (d > length && d > 1e-9) {
          const nx = dx / d, ny = dy / d, nz = dz / d;
          m.x = px + nx * length; m.y = py + ny * length; m.z = pz + nz * length;
          // Take out the speed it had going away from the tip. The rest swings it.
          const away = (m.vx - tvx) * nx + (m.vy - tvy) * ny + (m.vz - tvz) * nz;
          if (away > 0) { m.vx -= nx * away; m.vy -= ny * away; m.vz -= nz * away; }
        }
      }
    },

    // Throw it from where it is so it comes down `reach` metres away along the level
    // direction (dirX, dirZ), a unit vector.
    launch(reach, dirX, dirZ) {
      const c = Math.cos(LAUNCH_ANGLE);
      const drop = Math.max(0, m.y);
      const speed = Math.sqrt((GRAVITY * reach * reach) / (2 * c * c * (reach * Math.tan(LAUNCH_ANGLE) + drop)));
      m.vx = speed * c * dirX;
      m.vy = speed * Math.sin(LAUNCH_ANGLE);
      m.vz = speed * c * dirZ;
    },

    /**
     * Through the air. braking: the line has been stopped, so the forward speed dies away
     * and it drops where it is. Returns true on the frame it reaches the water.
     */
    fly(dt, braking) {
      if (!(dt > 0)) return false;
      // If it reaches the water inside this frame, only fly up to that moment.
      let time = dt;
      const fall = m.vy * m.vy + 2 * GRAVITY * m.y;
      const lands = m.y + m.vy * dt - 0.5 * GRAVITY * dt * dt <= 0;
      if (lands) time = Math.max(0, (m.vy + Math.sqrt(Math.max(0, fall))) / GRAVITY);
      if (braking) {
        const keep = Math.exp(-BRAKE_RATE * time);
        const run = (1 - keep) / BRAKE_RATE;
        m.x += m.vx * run; m.z += m.vz * run;
        m.vx *= keep; m.vz *= keep;
      } else {
        m.x += m.vx * time; m.z += m.vz * time;
      }
      m.y += m.vy * time - 0.5 * GRAVITY * time * time;
      m.vy -= GRAVITY * time;
      if (!lands) return false;
      m.y = 0;
      m.impact = Math.hypot(m.vx, m.vy, m.vz);
      m.vx = 0; m.vy = 0; m.vz = 0;
      return true;
    },

    /**
     * In the water on a line. The lure only moves when the line is stretched: it is pulled
     * toward the tip as fast as the tension can drag it, tension = WATER_DRAG * speed. Left
     * alone it sinks.
     * length is the line out at the end of the frame, taken is how much of it was wound
     * in during the frame, stiffness is the line's, N/m. Exact for an even wind.
     */
    tow(dt, tip, length, taken, stiffness) {
      if (!(dt > 0)) return;
      const dx = tip.x - m.x, dy = tip.y - m.y, dz = tip.z - m.z;
      const d = Math.hypot(dx, dy, dz);
      const wind = taken / dt;
      // Stretch at the start of the frame. Below zero the line is loose.
      let stretch = d - (length + taken);
      let time = dt;
      if (stretch < 0) {
        // Loose until the wind takes up the slack.
        const until = wind > 1e-9 ? -stretch / wind : Infinity;
        if (until >= dt) time = 0;
        else { time = dt - until; stretch = 0; }
      }
      let pulled = 0;
      if (time > 0) {
        const rate = stiffness / WATER_DRAG;
        const steady = wind / rate;
        const after = steady + (stretch - steady) * Math.exp(-rate * time);
        pulled = Math.max(0, stretch + wind * time - after);
      }
      if (pulled > 0 && d > 1e-9) {
        const s = pulled / d;
        m.x += dx * s; m.y += dy * s; m.z += dz * s;
        m.swum += Math.hypot(dx, dz) * s;
      }
      m.vx = (dx / (d || 1)) * (pulled / dt);
      m.vy = (dy / (d || 1)) * (pulled / dt);
      m.vz = (dz / (d || 1)) * (pulled / dt);
      // It sinks under its own weight: all the way while it lies still, less the faster
      // it is pulled, and less and less as it comes in under the tip.
      const level = Math.hypot(tip.x - m.x, tip.z - m.z);
      const hold = smooth((level - DEPTH_NEAR) / (DEPTH_FAR - DEPTH_NEAR));
      const still = Math.max(0, 1 - pulled / dt / PLANE_SPEED);
      const room = smooth((m.y - SINK_FLOOR) / SINK_EASE);
      m.y -= SINK_SPEED * still * hold * room * dt;
      if (m.y > RUN_DEPTH) m.y += (RUN_DEPTH - m.y) * (1 - Math.exp(-RUN_RATE * hold * dt));
      if (m.y > 0) m.y = 0;
    },
  };
  return m;
}
