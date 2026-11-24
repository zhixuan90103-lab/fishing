/**
 * How one fish gets where it wants to go.
 *
 * Owns: turning an aim into motion (swimFish), giving way to fish that are too close
 * (measureCrowd), steering round rocks, the body's bend, bank and tail effort, and the
 * depths the water has.
 * Does not own: what a fish wants (behaviors.js, or the brain of whoever took it), what
 * it can tell of its neighbours (neighbours.js), or a fish out of the water (hung.js).
 * No Three, no scene: it runs in Node. Design: docs/FISH-SCHOOL.md sections 2 and 5.
 *
 * Everything above this file only fills an aim: a heading, a speed and a depth.
 * swimFish turns that aim into motion. Rule that must hold for every caller:
 * in the horizontal plane a fish only moves along its own nose. Neighbours and rocks
 * change the aim. They do not move the fish, with one exception: a fish that has got
 * inside a rock all the same is pushed out to its face (pushOutOfRocks), and its nose is
 * swung onto the way it actually went.
 *
 * Head is +Z of the holder, yaw is about +Y, positive yaw turns toward +X (the fish's left).
 */

import { AWAY } from './states.js';

export const DEPTH_MIN = -3.75;
export const DEPTH_MAX = -1.75;

// Fish closer than this start to give way.
const CROWD_RANGE = 0.95;
// A turn rate for a fish holding its place in the school, and for one acting alone.
export const TURN_SCHOOL = 1.15;
export const TURN_ALONE = 4.2;
// How fast speed rises toward the aim. Slowing down is always the slow coast.
export const ACCEL_CRUISE = 0.7;
export const ACCEL_DART = 2.6;
export const COAST = 0.22;
// How fast a fish closes on the depth it wants, 1/s.
export const DEPTH_RATE = 0.45;
// How fast a haul on a hooked fish comes on and goes off, 1/s.
const TOW_RATE = 8;
// The tail effort of a fish said to be doing nothing (aim.effort 0) and working flat out
// (1). Cruising is 0.55, so a fish hanging on a line beats less than one in the school.
const DRIVE_IDLE = 0.12;
const DRIVE_FLAT_OUT = 1.3;
// Working flat out its tail beats at least as fast as it would swimming this fast, m/s,
// however slowly it is really going: a fish straining against a line that holds it.
const STROKE_FLAT_OUT = 1.4;
// Tail amplitude is meant to cap at high speed (research: ~0.2 BL at ~5 beats/s): below
// STROKE_LOW it follows effort, above STROKE_HIGH it is held to DRIVE_CAP, in between
// the cap slides. STROKE_LOW and STROKE_HIGH are in m/s, treating stroke as speed.
// As written this cap never binds, noted 2026-11-24 and left as it is: the branch it is
// on only sees a drive of 0.71 or less, and the cap is never below DRIVE_CAP. And the
// two thresholds in swimFish (want over 0.1, effort over 0.5) are steps in the target,
// not smooth: fish.drive eases over them in a fifth of a second.
const STROKE_LOW = 0.4;   // Below this, amplitude unlimited
const STROKE_HIGH = 2.0;  // Above this, amplitude capped
const DRIVE_CAP = 0.85;   // High-speed amplitude cap (less than DRIVE_FLAT_OUT)
// During acceleration, amplitude can exceed steady-state by this multiplier.
const ACCEL_BOOST = 1.15;

export function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

export function wrapPi(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function makeAim() {
  return {
    yaw: 0, speed: 0, y: 0, cruise: 0, turn: TURN_SCHOOL, accel: ACCEL_CRUISE,
    slow: COAST, rise: DEPTH_RATE, top: DEPTH_MAX, effort: null, towX: 0, towZ: 0,
  };
}

export function makeCrowd(count) {
  return { x: new Float64Array(count), y: new Float64Array(count), z: new Float64Array(count) };
}

// For every fish: how crowded it is, 0 to 1 per neighbour, pointing away from them.
// This is a wish to steer, not a shove.
export function measureCrowd(fishes, crowd) {
  const n = fishes.length;
  crowd.x.fill(0);
  crowd.y.fill(0);
  crowd.z.fill(0);
  for (let i = 0; i < n; i++) {
    const a = fishes[i];
    // A fish that is not in the water crowds nobody.
    if (a.state === AWAY) continue;
    for (let j = i + 1; j < n; j++) {
      const b = fishes[j];
      if (b.state === AWAY) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dz = b.z - a.z;
      const d = Math.hypot(dx, dy, dz);
      if (d >= CROWD_RANGE || d < 1e-4) continue;
      const push = (CROWD_RANGE - d) / CROWD_RANGE;
      const px = dx / d * push;
      const py = dy / d * push;
      const pz = dz / d * push;
      crowd.x[i] -= px;
      crowd.y[i] -= py;
      crowd.z[i] -= pz;
      crowd.x[j] += px;
      crowd.y[j] += py;
      crowd.z[j] += pz;
    }
  }
}

// How much a rock is in a fish's way, 0 to 1, by how high the fish is. A rock stands
// from the sea floor up to its `top`, world y, and a fish ROCK_CLEAR or more above that
// swims over it. A rock with no top given reaches the surface. Before 2026-11-24 every
// rock did: once the sea was deepened fish were turned aside by rocks three metres under
// them.
const ROCK_CLEAR = 0.4;
function inTheWay(rock, y) {
  if (rock.top === undefined) return 1;
  return clamp((rock.top + ROCK_CLEAR - y) / ROCK_CLEAR, 0, 1);
}

// Rocks are upright cylinders as high as their top. The heading is bent onto the tangent
// on the side the fish is already on: fully by 0.6 m from the skin, then leaning away
// from the rock.
function steerAroundRocks(x, y, z, yaw, rocks) {
  let out = yaw;
  for (let i = 0; i < rocks.length; i++) {
    const rock = rocks[i];
    const way = inTheWay(rock, y);
    if (way <= 0) continue;
    const dx = x - rock.x;
    const dz = z - rock.z;
    const d = Math.hypot(dx, dz) || 1e-4;
    const reach = rock.r + 1.5;
    if (d > reach) continue;
    const nx = dx / d;
    const nz = dz / d;
    const fx = Math.sin(out);
    const fz = Math.cos(out);
    const side = fx * nz - fz * nx;
    const s = side >= 0 ? 1 : -1;
    let tx = -nz * s;
    let tz = nx * s;
    if (tx * fx + tz * fz < 0) {
      tx = -tx;
      tz = -tz;
    }
    const w = clamp((reach - d) / 0.9, 0, 1) * way;
    const lean = clamp((rock.r + 0.75 - d) / 0.4, 0, 1) * 0.8;
    out = wrapPi(out + wrapPi(Math.atan2(tx + nx * lean, tz + nz * lean) - out) * w);
  }
  return out;
}

function pushOutOfRocks(fish, rocks) {
  let moved = false;
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < rocks.length; i++) {
      const rock = rocks[i];
      // Only a fish down among the rock, not one passing over it.
      if (rock.top !== undefined && fish.y > rock.top) continue;
      const dx = fish.x - rock.x;
      const dz = fish.z - rock.z;
      const d = Math.hypot(dx, dz) || 1e-4;
      const skin = rock.r + 0.32;
      if (d >= skin) continue;
      fish.x = rock.x + (dx / d) * skin;
      fish.z = rock.z + (dz / d) * skin;
      moved = true;
    }
  }
  return moved;
}

// Body state every fish carries. poseSpine reads drive and bend, the tail clip stroke.
export function restBody(fish) {
  fish.pitch = 0;
  fish.drive = 0.55;
  fish.bend = 0;
  fish.roll = 0;
  fish.yawRate = 0;
  fish.stroke = 0;
  fish.towX = 0;
  fish.towZ = 0;
}

export function writePose(fish) {
  fish.holder.position.set(fish.x, fish.y, fish.z);
  fish.holder.rotation.order = 'YXZ';
  fish.holder.rotation.y = fish.yaw;
  fish.holder.rotation.x = fish.pitch;
  fish.holder.rotation.z = fish.roll;
}

/**
 * aim: yaw, speed, y are where the fish wants to be heading. cruise is its unhurried
 * speed right now, the yardstick for effort. turn and accel are how sharply it may react.
 * slow is how fast it loses speed, rise how fast it changes depth, top the shallowest it
 * may go. Those three are the school's own unless whoever took the fish says otherwise:
 * a fish on a line is stopped by it, and comes up to a lure near the surface.
 * effort is how hard it is working whatever its speed, 0 to 1: its tail beats that wide,
 * and at least that fast, at top speed or held still alike. null, the school's, leaves
 * the tail to follow how hard it is trying to speed up.
 * crowdX/Y/Z is this fish's entry from measureCrowd.
 */
export function swimFish(fish, aim, crowdX, crowdY, crowdZ, rocks, dt) {
  const fx = Math.sin(fish.yaw);
  const fz = Math.cos(fish.yaw);

  // Crowding: the sideways part turns the fish away, the fore-aft part speeds it up or slows it.
  const crowdSide = crowdX * fz - crowdZ * fx;
  const crowdAhead = crowdX * fx + crowdZ * fz;
  const crowd = Math.min(1, Math.hypot(crowdX, crowdZ));
  aim.yaw += clamp(crowdSide * 1.8, -0.9, 0.9);
  aim.speed *= 1 + clamp(crowdAhead * 0.9, -0.5, 0.5);
  aim.y += clamp(crowdY * 0.5, -0.3, 0.3);
  aim.yaw = steerAroundRocks(fish.x, fish.y, fish.z, wrapPi(aim.yaw), rocks);

  // Tail effort follows how hard the fish is trying to speed up. Coasting is nearly stiff.
  // A fish whose effort is given beats by that alone: a run does not go slack in the tail
  // once it is up to speed, and a fish hanging spent on a line does not work to keep up.
  const want = (aim.speed - fish.speed) / Math.max(aim.cruise, 0.05);
  const baseDrive = aim.effort === null
    ? clamp(0.55 + want * 1.5, DRIVE_IDLE, DRIVE_FLAT_OUT)
    : DRIVE_IDLE + (DRIVE_FLAT_OUT - DRIVE_IDLE) * clamp(aim.effort, 0, 1);

  // Research: amplitude caps at high speed (~0.2 BL at ~5 beats/s), unlimited at low speed.
  // This is for CRUISING. When effort is given (e.g., a run), amplitude stays high regardless of speed.
  const effortGiven = aim.effort !== null && aim.effort > 0.5;

  let driveAim;
  if (effortGiven) {
    // Effort given (e.g., fish running): amplitude not limited by speed
    driveAim = baseDrive;
  } else {
    // Cruising: apply speed-based cap
    const speedFactor = clamp((fish.stroke - STROKE_LOW) / (STROKE_HIGH - STROKE_LOW), 0, 1);
    const driveCap = DRIVE_CAP + (DRIVE_FLAT_OUT - DRIVE_CAP) * (1 - speedFactor);

    // During acceleration, amplitude can exceed steady-state
    const accelerating = want > 0.1;
    driveAim = accelerating
      ? Math.min(baseDrive * ACCEL_BOOST, DRIVE_FLAT_OUT)
      : Math.min(baseDrive, driveCap);
  }

  fish.drive += (driveAim - fish.drive) * (1 - Math.exp(-5 * dt));
  const k = aim.speed > fish.speed ? aim.accel : aim.slow;
  fish.speed += (aim.speed - fish.speed) * (1 - Math.exp(-k * dt));
  // What its tail beats in step with: the water it covers, or its effort if that is more.
  fish.stroke = Math.max(fish.speed, (aim.effort || 0) * STROKE_FLAT_OUT);

  const yawErr = wrapPi(aim.yaw - fish.yaw);
  const yawK = aim.turn + crowd * 4;
  const yawStep = clamp(yawErr, -1.2, 1.2) * (1 - Math.exp(-yawK * dt));
  fish.yaw = wrapPi(fish.yaw + yawStep);
  // The body curves into the turn and banks with it.
  const turn = dt > 0 ? yawStep / dt : 0;
  fish.yawRate += (turn - fish.yawRate) * (1 - Math.exp(-6 * dt));
  fish.bend = clamp(fish.yawRate * 0.55, -0.6, 0.6);
  fish.roll += (clamp(-fish.yawRate * 0.3, -0.3, 0.3) - fish.roll) * (1 - Math.exp(-3 * dt));

  // Its own horizontal motion is along the nose and nothing else. A fish someone has on
  // a line may be hauled bodily as well, whichever way it faces: that is the line's doing
  // (aim.towX, aim.towZ, m/s), and it comes on and goes off over a moment, never at once.
  const faceX = Math.sin(fish.yaw);
  const faceZ = Math.cos(fish.yaw);
  const x0 = fish.x;
  const z0 = fish.z;
  const towK = 1 - Math.exp(-TOW_RATE * dt);
  fish.towX = (fish.towX || 0) + (aim.towX - (fish.towX || 0)) * towK;
  fish.towZ = (fish.towZ || 0) + (aim.towZ - (fish.towZ || 0)) * towK;
  fish.x += (faceX * fish.speed + fish.towX) * dt;
  fish.z += (faceZ * fish.speed + fish.towZ) * dt;
  // Last resort when steering was not enough. The rock slides the fish along its face,
  // so the nose is swung onto the path it actually took.
  if (pushOutOfRocks(fish, rocks)) {
    const mx = fish.x - x0;
    const mz = fish.z - z0;
    if (mx * mx + mz * mz > 1e-10) {
      const slip = wrapPi(Math.atan2(mx, mz) - fish.yaw);
      fish.yaw = wrapPi(fish.yaw + slip * (1 - Math.exp(-8 * dt)));
    }
  }

  const yBefore = fish.y;
  // A fish handed back above the school's water is not dropped into it: it swims down.
  const top = Math.max(aim.top, yBefore);
  fish.y = clamp(fish.y + (aim.y - fish.y) * (1 - Math.exp(-aim.rise * dt)), DEPTH_MIN, top);
  const vy = dt > 0 ? (fish.y - yBefore) / dt : 0;
  const pitchAim = -Math.atan2(vy, Math.max(fish.speed, 0.04));
  fish.pitch += (clamp(pitchAim, -0.4, 0.4) - fish.pitch) * (1 - Math.exp(-1.2 * dt));
  writePose(fish);
}
