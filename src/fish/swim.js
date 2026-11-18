/**
 * How one fish gets where it wants to go.
 *
 * Everything above this file only fills an aim: a heading, a speed and a depth.
 * swimFish turns that aim into motion. Rule that must hold for every caller:
 * in the horizontal plane a fish only moves along its own nose. Neighbours, rocks
 * and the school can change the aim. They never move the fish.
 *
 * Head is +Z of the holder, yaw is about +Y, positive yaw turns toward +X (the fish's left).
 */

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
    slow: COAST, rise: DEPTH_RATE, top: DEPTH_MAX,
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
    for (let j = i + 1; j < n; j++) {
      const b = fishes[j];
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

// Rocks are upright cylinders. The heading is bent onto the tangent on the side the
// fish is already on: fully by 0.6 m from the skin, then leaning away from the rock.
function steerAroundRocks(x, z, yaw, rocks) {
  let out = yaw;
  for (let i = 0; i < rocks.length; i++) {
    const rock = rocks[i];
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
    const w = clamp((reach - d) / 0.9, 0, 1);
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

// Body state every fish carries. poseSpine reads drive and bend.
export function restBody(fish) {
  fish.pitch = 0;
  fish.drive = 0.55;
  fish.bend = 0;
  fish.roll = 0;
  fish.yawRate = 0;
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
  aim.yaw = steerAroundRocks(fish.x, fish.z, wrapPi(aim.yaw), rocks);

  // Tail effort follows how hard the fish is trying to speed up. Coasting is nearly stiff.
  const want = (aim.speed - fish.speed) / Math.max(aim.cruise, 0.05);
  const driveAim = clamp(0.55 + want * 1.5, 0.12, 1.3);
  fish.drive += (driveAim - fish.drive) * (1 - Math.exp(-5 * dt));
  const k = aim.speed > fish.speed ? aim.accel : aim.slow;
  fish.speed += (aim.speed - fish.speed) * (1 - Math.exp(-k * dt));

  const yawErr = wrapPi(aim.yaw - fish.yaw);
  const yawK = aim.turn + crowd * 4;
  const yawStep = clamp(yawErr, -1.2, 1.2) * (1 - Math.exp(-yawK * dt));
  fish.yaw = wrapPi(fish.yaw + yawStep);
  // The body curves into the turn and banks with it.
  const turn = dt > 0 ? yawStep / dt : 0;
  fish.yawRate += (turn - fish.yawRate) * (1 - Math.exp(-6 * dt));
  fish.bend = clamp(fish.yawRate * 0.55, -0.6, 0.6);
  fish.roll += (clamp(-fish.yawRate * 0.3, -0.3, 0.3) - fish.roll) * (1 - Math.exp(-3 * dt));

  // The only horizontal motion is along the nose.
  const faceX = Math.sin(fish.yaw);
  const faceZ = Math.cos(fish.yaw);
  const x0 = fish.x;
  const z0 = fish.z;
  fish.x += faceX * fish.speed * dt;
  fish.z += faceZ * fish.speed * dt;
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
