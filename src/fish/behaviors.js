/**
 * What one fish wants, as an aim for swimFish.
 *
 * Each fish has a state. A state is a function (fish, aim, env, dt) that writes
 * aim.yaw, aim.speed and aim.y, and may switch fish.state. It never touches the
 * fish's position. Two states live here. Fishing states are written elsewhere and
 * plugged in through school.take(fish, brain).
 *
 * env: { shoal, fishes, cx, cz }. cx, cz is the centre of the fish that are in the school.
 */

import { clamp, wrapPi, TURN_ALONE, ACCEL_DART } from './swim.js';

export const SCHOOL = 'school';
export const STRAY = 'stray';
export const HELD = 'held';
// Out of the water on someone's line. It does not swim.
export const HUNG = 'hung';

// Past this distance from the centre a schooling fish heads back in.
const HOME_RANGE = 2.4;

// ---------------- states

// In the school: the fish ahead sets the heading and depth. Own pace is the trend,
// and closing or opening a gap is gradual.
function followSchool(fish, aim, env, dt) {
  const { shoal, fishes } = env;
  if (fish.roamer) {
    fish.boutT += dt;
    if (fish.boutT > fish.boutDur) beginStray(fish);
  }
  const fx = Math.sin(fish.yaw);
  const fz = Math.cos(fish.yaw);
  let nearest = 1e9;
  let aheadSpeed = fish.speed;
  let aheadYaw = shoal.yaw;
  let aheadY = shoal.y + fish.followY;
  for (let j = 0; j < fishes.length; j++) {
    const other = fishes[j];
    if (other === fish || other.state !== SCHOOL) continue;
    const dx = other.x - fish.x;
    const dz = other.z - fish.z;
    const forward = dx * fx + dz * fz;
    if (forward < 0.12) continue;
    const side = Math.abs(-dz * fx + dx * fz);
    if (side > 0.95) continue;
    const d = Math.hypot(dx, dz);
    if (d < nearest && d < 3.2) {
      nearest = forward;
      aheadSpeed = other.speed;
      aheadYaw = other.yaw;
      aheadY = other.y;
    }
  }
  if (nearest < 3.2) {
    aim.yaw = aheadYaw;
    aim.y = aheadY + fish.followY * 0.35;
    if (nearest < 0.85) aim.speed = Math.min(aim.cruise, aheadSpeed);
    else if (nearest > 1.6) aim.speed = aim.cruise * (1 + Math.min(0.45, (nearest - 1.6) * 0.22));
    else aim.speed = aim.cruise;
  }
}

// Out of the school for a few seconds: same heading as the shoal with a small bias
// to one side. Too far, too wide or out of time, and it turns back.
function stray(fish, aim, env, dt) {
  const { shoal, cx, cz } = env;
  fish.boutT += dt;
  const dist = Math.hypot(cx - fish.x, cz - fish.z);
  const sfx = Math.sin(shoal.yaw);
  const sfz = Math.cos(shoal.yaw);
  const side = (fish.x - cx) * -sfz + (fish.z - cz) * sfx;
  if (dist > 1.8 || Math.abs(side) > 1.15 || fish.boutT > fish.boutDur) fish.returning = true;
  aim.yaw = wrapPi(shoal.yaw + (fish.returning ? 0 : fish.leaveBias));
  if (fish.returning && dist < 1.15) rejoin(fish);
}

export const STATES = { [SCHOOL]: followSchool, [STRAY]: stray };

function beginStray(fish) {
  fish.state = STRAY;
  fish.returning = false;
  fish.boutT = 0;
  fish.boutDur = 3.5 + Math.random() * 3;
  fish.leaveBias = (Math.random() < 0.5 ? -1 : 1) * (0.16 + Math.random() * 0.14);
}

function rejoin(fish) {
  fish.state = SCHOOL;
  fish.returning = false;
  fish.boutT = 0;
  fish.boutDur = 14 + Math.random() * 16;
}

// Hand a fish back from outside. It swims home as a returning stray, then merges.
export function sendHome(fish) {
  fish.state = STRAY;
  fish.returning = true;
  fish.boutT = 0;
  fish.boutDur = 0;
  fish.leaveBias = 0;
}

export function seedStraying(fish) {
  fish.state = SCHOOL;
  fish.returning = false;
  fish.boutT = fish.roamer ? Math.random() * 10 : 0;
  fish.boutDur = fish.roamer ? 12 + Math.random() * 14 : 0;
  fish.leaveBias = 0;
}

// ---------------- habits

// Things every free fish does on top of its state, each on its own clock.
export function seedHabits(fish) {
  fish.wanderT = Math.random() * 100;
  fish.wanderW1 = 0.23 + Math.random() * 0.22;
  fish.wanderW2 = 0.61 + Math.random() * 0.5;
  fish.wanderW3 = 0.17 + Math.random() * 0.2;
  fish.wanderYaw = 0.05 + Math.random() * 0.08;
  fish.wanderDepth = 0.05 + Math.random() * 0.13;
  fish.darting = false;
  fish.dartT = 2 + Math.random() * 18;
  fish.dartGain = 1;
  fish.dartYaw = 0;
}

export function habits(fish, aim, dt) {
  // Wander: a slow drift off the shared heading and depth.
  fish.wanderT += dt;
  const wt = fish.wanderT;
  aim.yaw += (Math.sin(wt * fish.wanderW1) * 0.6 + Math.sin(wt * fish.wanderW2 + 1.7) * 0.4) * fish.wanderYaw;
  aim.y += Math.sin(wt * fish.wanderW3 + 0.6) * fish.wanderDepth;
  // Dart: a short kick. The slow coast in swimFish turns the rest into a glide.
  fish.dartT -= dt;
  if (fish.dartT <= 0) {
    fish.darting = !fish.darting;
    if (fish.darting) {
      fish.dartT = 0.4 + Math.random() * 0.5;
      fish.dartGain = 1.6 + Math.random() * 0.9;
      fish.dartYaw = (Math.random() - 0.5) * 0.3;
    } else {
      fish.dartT = 5 + Math.random() * 17;
    }
  }
  if (fish.darting) {
    aim.speed *= fish.dartGain;
    aim.yaw += fish.dartYaw;
    aim.accel = ACCEL_DART;
  }
}

// ---------------- staying together

// Wander and darts add up, so a schooling fish that has slid too far out heads back in.
// A returning stray does the same thing harder. Both turn and swim. Neither is dragged.
export function regroup(fish, aim, env) {
  const hx = env.cx - fish.x;
  const hz = env.cz - fish.z;
  if (fish.state === SCHOOL) {
    const out = Math.hypot(hx, hz);
    if (out <= HOME_RANGE) return;
    const w = clamp((out - HOME_RANGE) / 2.5, 0, 0.85);
    aim.yaw += wrapPi(Math.atan2(hx, hz) - aim.yaw) * w;
    if (hx * Math.sin(fish.yaw) + hz * Math.cos(fish.yaw) > 0) aim.speed *= 1 + w * 0.4;
  } else if (fish.state === STRAY) {
    aim.turn = TURN_ALONE;
    if (!fish.returning) return;
    aim.yaw += wrapPi(Math.atan2(hx, hz) - aim.yaw) * 0.75;
    aim.speed *= 1.3;
  }
}
