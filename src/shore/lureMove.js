/**
 * How the lure's body moves: held at the tip, hanging on the line as a weight, flying
 * through the air, towed through the water by the line.
 *
 * Owns: the lure's position and velocity, and the ways it moves.
 * Does not own: the model (lure.js), the line or its length (line.js and whoever sets it),
 * which of the three applies, when a cast starts or ends, or any fishing rule.
 * No Three, no scene: it runs in Node. Design: docs/LURE.md.
 *
 * The caller picks one of hold / fly / tow each frame and passes what the line is
 * doing. Each is exact for the frame it is given or runs on a fixed small step, so the
 * path does not depend on the frame rate. Unless it is held, point() then turns the nose
 * along the line.
 *
 * Out of the water it is none of those: it is a weight on the end of the line, and what
 * is on the hook with it. Then the caller gives it to the line to carry (line.carry),
 * and the rod moves it in its own small steps through advance(): the weight and the rod
 * tip pull on each other through the line, and have to be moved together.
 *
 * Which way it faces while it does so is lurePose.js: this file tells it where the tip
 * is and how fast the lure is sinking, and shows its nose and back as its own.
 *
 * Units: metres, seconds, newtons. World +Y is up, the water surface is y = 0.
 */

import { createLurePose } from './lurePose.js';

const GRAVITY = 9.81;

// How fast a weight swinging on the line loses speed in air and under water, 1/s. Higher
// settles sooner.
const AIR_LOSS = 1.2;
const WATER_LOSS = 7;
// A weight coming onto the line does not bounce on it like a ball on elastic: the line
// takes this share of the damping that would just stop it, from how fast it is being
// stretched.
const LINE_DAMPS = 0.5;
// What the lure itself weighs, kg, and the share of that it weighs under water.
export const LURE_KG = 0.01;
const LURE_SUNK = 0.3;

// Flying: the angle it leaves at, above level, radians, unless launch() is told another.
// Higher lobs it, lower drives it.
export const LAUNCH_ANGLE = 28 * Math.PI / 180;
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
// That is where it settles on a line that follows it down. With spare line on it nothing
// holds it there: it goes on sinking until the line has it again, this much deeper at the
// most, m (the bed is 4.8 m down at the shallowest: it keeps over a metre off it). Spare
// line under SPARE_COUNTS m hardly counts: a line just landed always has a little.
// Without this (until 2026-11-25) a lure lying at its deepest, jerked and let go, lay on
// 10 to 20 cm of spare line for good, and the line hung slack until it was wound.
export const SINKS_ON = 1.2;
const SPARE_COUNTS = 0.04;
// Taken hold of (a fish's mouth: play says where) it is drawn there, not put there: what it is short of the place closes
// at this rate, 1/s, so 10 cm is 2 cm after a tenth of a second. Put there at once (until
// 2026-11-25) the end of the line leapt a hand's breadth in a frame, and a line lying
// slack was straight in that same frame.
const DRAWN_IN = 16;
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

function smooth(t) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t * t * (3 - 2 * t);
}

export function createLureMove() {
  // Which way it faces is lurePose.js's. This file tells it what the body is doing.
  const pose = createLurePose();
  // As a weight on the line: how far it had the line stretched a step ago, and whether
  // the line was taut then.
  let stretched = 0;
  let taut = false;
  // Metres it has sunk under its own weight are counted there, for the rock.

  // Whether something has hold of it, and what it is still short of where that is, m.
  let held = false;
  let shortX = 0, shortY = 0, shortZ = 0;

  const m = {
    x: 0, y: 0, z: 0,
    vx: 0, vy: 0, vz: 0,
    // Metres it has swum through the water, level distance. The model wiggles on this.
    swum: 0,
    // How fast it was going when it last hit the water, m/s.
    impact: 0,
    // How fast it is sinking under its own weight right now, m/s.
    sinking: 0,
    // How much further from the tip the last tow() left it by sinking alone, m. Line
    // paid out by this much lets it sink straight down. Held to a fixed length, the
    // line swings it in toward the rod as it sinks.
    sank: 0,
    // Which way the nose points, not kept to unit length, and which way its back faces,
    // a unit vector square to the nose. Both are lurePose.js's, shown here.
    nose: pose.nose,
    back: pose.back,
    // What hangs on the line when it is out of the water: its weight, kg, the share of
    // that it weighs under water, and the heights of the hook, m, between which it comes
    // out. The lure alone, until weigh() says a fish is on the hook with it.
    kg: LURE_KG,
    sunk: LURE_SUNK,
    dryFrom: -0.05,
    dryBy: 0.05,

    // Put it somewhere, at rest.
    place(x, y, z) {
      m.x = x; m.y = y; m.z = z;
      m.vx = 0; m.vy = 0; m.vz = 0;
      held = false;
    },

    // Something has hold of it at (x, y, z) and it goes wherever that goes. Called every
    // frame it is held. The first time, it is wherever it was: it is drawn there over a
    // moment, and from then on it is there. What has hold of it is the caller's business.
    drawnTo(dt, x, y, z) {
      if (!held) {
        held = true;
        shortX = m.x - x; shortY = m.y - y; shortZ = m.z - z;
      }
      const left = Math.exp(-DRAWN_IN * Math.max(0, dt));
      shortX *= left; shortY *= left; shortZ *= left;
      m.x = x + shortX; m.y = y + shortY; m.z = z + shortZ;
      m.vx = 0; m.vy = 0; m.vz = 0;
    },

    // Held at a point, going wherever that point goes. Not a weight on a line: nothing
    // sets it swinging. Its nose is left as it is: upright() turns it.
    hold(x, y, z) {
      m.place(x, y, z);
      m.sinking = 0;
    },

    // Held at the tip, the nose points up at it, with the tail trailing behind however
    // the tip is moving: a wave of the rod sways it, a still rod lets it hang true. Call
    // once a frame after hold(). dt of 0 hangs it true at once, for the very start.
    upright(dt) {
      pose.sway(dt, m.x, m.z);
    },

    // Shaken by the line: its body beats as if it had swum this many metres more.
    flutter(metres) {
      m.swum += metres;
    },

    // Turn the nose toward the tip, along the line. swimming: lie flatter than the line.
    point(dt, tip, swimming) {
      pose.follow(dt, tip.x - m.x, tip.y - m.y, tip.z - m.z, swimming, m.sinking, SINK_SPEED);
    },

    // Straight-line distance to a point.
    gap(p) {
      return Math.hypot(p.x - m.x, p.y - m.y, p.z - m.z);
    },

    // What is on the hook now weighs this much: kg out of the water, `sunk` of that
    // under it, coming on as the hook rises from dryFrom to dryBy, m. No arguments: the
    // lure alone again.
    weigh(kg = LURE_KG, sunk = LURE_SUNK, dryFrom = -0.05, dryBy = 0.05) {
      m.kg = kg;
      m.sunk = sunk;
      m.dryFrom = dryFrom;
      m.dryBy = dryBy;
    },

    /**
     * One small step as a weight on the line, h seconds. The rod calls this from its own
     * steps (rodFlex.js). The tip is at (tx, ty, tz) now, there are `length` metres of
     * line and it pulls `stiffness` newtons for each metre it is stretched. The weight
     * falls, is slowed by the air or the water, and is pulled toward the tip by the line
     * when the line is taut. Nothing else holds it.
     */
    advance(h, tx, ty, tz, length, stiffness) {
      const out = smooth((m.y - m.dryFrom) / (m.dryBy - m.dryFrom));
      const heavy = m.sunk + (1 - m.sunk) * out;
      let ax = 0;
      let ay = -GRAVITY * heavy;
      let az = 0;
      const dx = tx - m.x;
      const dy = ty - m.y;
      const dz = tz - m.z;
      const far = Math.hypot(dx, dy, dz);
      if (far > length && far > 1e-9) {
        const nx = dx / far;
        const ny = dy / far;
        const nz = dz / far;
        // The pull the rod tip feels, the other way, and the line's own damping: by how
        // fast it is stretching, which is nothing while it is only being wound in.
        const stretch = far - length;
        const rate = taut ? (stretch - stretched) / h : 0;
        stretched = stretch;
        taut = true;
        const pull = Math.max(0, stiffness * stretch + 2 * LINE_DAMPS * Math.sqrt(stiffness * m.kg) * rate) / m.kg;
        ax += nx * pull;
        ay += ny * pull;
        az += nz * pull;
      } else taut = false;
      const keep = Math.exp(-(m.y < 0 ? WATER_LOSS : AIR_LOSS) * h);
      m.vx = (m.vx + ax * h) * keep;
      m.vy = (m.vy + ay * h) * keep;
      m.vz = (m.vz + az * h) * keep;
      m.x += m.vx * h;
      m.y += m.vy * h;
      m.z += m.vz * h;
    },

    // Throw it from where it is so it comes down `reach` metres away along the level
    // direction (dirX, dirZ), a unit vector, leaving at `angle` above level, radians.
    launch(reach, dirX, dirZ, angle = LAUNCH_ANGLE) {
      const c = Math.cos(angle);
      const drop = Math.max(0, m.y);
      const speed = Math.sqrt((GRAVITY * reach * reach) / (2 * c * c * (reach * Math.tan(angle) + drop)));
      m.vx = speed * c * dirX;
      m.vy = speed * Math.sin(angle);
      m.vz = speed * c * dirZ;
    },

    /**
     * Through the air. braking: the line has been stopped, so the forward speed dies away
     * and it drops where it is. Returns true on the frame it reaches the water.
     */
    fly(dt, braking) {
      held = false;
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
      m.sank = 0;
      m.sinking = 0;
      held = false;
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
      // On spare line it sinks on past where it settles.
      const spare = Math.max(0, length - Math.hypot(tip.x - m.x, tip.y - m.y, tip.z - m.z));
      const floor = SINK_FLOOR - SINKS_ON * smooth(spare / SPARE_COUNTS);
      const room = smooth((m.y - floor) / SINK_EASE);
      const before = Math.hypot(tip.x - m.x, tip.y - m.y, tip.z - m.z);
      m.sinking = SINK_SPEED * still * hold * room;
      m.y -= m.sinking * dt;
      pose.sink(m.sinking * dt);
      m.sank = Math.max(0, Math.hypot(tip.x - m.x, tip.y - m.y, tip.z - m.z) - before);
      if (m.y > RUN_DEPTH) m.y += (RUN_DEPTH - m.y) * (1 - Math.exp(-RUN_RATE * hold * dt));
      if (m.y > 0) m.y = 0;
    },
  };
  return m;
}
