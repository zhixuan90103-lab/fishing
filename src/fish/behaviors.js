/**
 * What one fish wants, as an aim for swimFish.
 *
 * Each fish has a state. A state is a function (fish, aim, env, dt) that writes
 * aim.yaw, aim.speed and aim.y, and may switch fish.state. It never touches the
 * fish's position. Two states live here. Fishing states are written elsewhere and
 * plugged in through school.take(fish, brain).
 *
 * env: { shoal, fishes, cx, cz }. cx, cz is the centre of the fish that are in the school.
 *
 * Refactored 2026-11-20: school and stray are merged into one state with continuous
 * flocking weight. Roamers have lower weight that fluctuates, not a discrete state switch.
 */

import { clamp, wrapPi, TURN_ALONE, ACCEL_DART } from './swim.js';

export const FREE = 'free';
export const HELD = 'held';
// Out of the water on someone's line. It does not swim.
export const HUNG = 'hung';

// Past this distance from the centre a fish heads back in.
const HOME_RANGE = 2.4;
// Flocking weight: how much a fish follows others vs its own habits.
// Non-roamers: high and stable. Roamers: lower and fluctuates.
const FLOCK_CORE = 0.95;      // Non-roamers: nearly always flocking
const FLOCK_ROAM_BASE = 0.4;  // Roamers: base weight
const FLOCK_ROAM_AMP = 0.35;  // Roamers: amplitude of fluctuation
const FLOCK_ROAM_PERIOD = [18, 32]; // Roamers: period in seconds

// ---------------- states

// Free fish: flocking weight blends following the fish ahead with own heading bias.
// Roamers have lower weight that fluctuates, so they drift off and return naturally.
function flock(fish, aim, env, dt) {
  const { shoal, fishes } = env;

  // Update flocking weight for roamers (fluctuates over time)
  if (fish.roamer) {
    fish.flockPhase += dt / fish.flockPeriod;
    const wave = Math.sin(fish.flockPhase * Math.PI * 2);
    fish.flockWeight = FLOCK_ROAM_BASE + FLOCK_ROAM_AMP * wave;
    // Clamp to prevent going too low or too high
    fish.flockWeight = clamp(fish.flockWeight, 0.15, 0.85);
  }

  const weight = fish.flockWeight;

  // Find the fish ahead to follow (same logic as old followSchool)
  const fx = Math.sin(fish.yaw);
  const fz = Math.cos(fish.yaw);
  let nearest = 1e9;
  let aheadSpeed = fish.speed;
  let aheadYaw = shoal.homeYaw;
  let aheadY = shoal.homeDepth + fish.followY;

  for (let j = 0; j < fishes.length; j++) {
    const other = fishes[j];
    if (other === fish || other.state !== FREE) continue;
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

  // Compute following aim (high weight) vs own bias (low weight)
  let followYaw = shoal.homeYaw;
  let followSpeed = aim.cruise;
  let followY = shoal.homeDepth + fish.followY;

  if (nearest < 3.2) {
    followYaw = aheadYaw;
    followY = aheadY + fish.followY * 0.35;
    if (nearest < 0.85) followSpeed = Math.min(aim.cruise, aheadSpeed);
    else if (nearest > 1.6) followSpeed = aim.cruise * (1 + Math.min(0.45, (nearest - 1.6) * 0.22));
    else followSpeed = aim.cruise;
  }

  // Own bias: slight deviation from shoal heading
  const ownYaw = wrapPi(shoal.homeYaw + fish.headingBias);
  const ownSpeed = aim.cruise * fish.pace;
  const ownY = shoal.homeDepth + fish.followY;

  // Blend based on flocking weight
  aim.yaw = wrapPi(followYaw + wrapPi(ownYaw - followYaw) * (1 - weight));
  aim.speed = followSpeed * weight + ownSpeed * (1 - weight);
  aim.y = followY * weight + ownY * (1 - weight);
}

export const STATES = { [FREE]: flock };

// Initialize flocking weight for a fish. Roamers have lower, fluctuating weight;
// core members have high, stable weight.
export function seedFlocking(fish) {
  fish.state = FREE;
  if (fish.roamer) {
    fish.flockWeight = FLOCK_ROAM_BASE;
    fish.flockPhase = Math.random(); // Start at random phase
    fish.flockPeriod = FLOCK_ROAM_PERIOD[0] + Math.random() * (FLOCK_ROAM_PERIOD[1] - FLOCK_ROAM_PERIOD[0]);
  } else {
    fish.flockWeight = FLOCK_CORE;
    fish.flockPhase = 0;
    fish.flockPeriod = 1; // Unused for core members
  }
  // Small heading bias: roamers drift more
  fish.headingBias = fish.roamer
    ? (Math.random() < 0.5 ? -1 : 1) * (0.1 + Math.random() * 0.15)
    : (Math.random() - 0.5) * 0.05;
}

// Hand a fish back from outside. It rejoins the flock naturally.
export function sendHome(fish) {
  fish.state = FREE;
  // Temporarily boost flocking weight to help it rejoin faster
  if (fish.roamer) fish.flockWeight = 0.75;
}

// ---------------- habits

// Things every free fish does on top of its state, each on its own clock.
export function seedHabits(fish) {
  // Wander: slow drift
  fish.wanderT = Math.random() * 100;
  fish.wanderW1 = 0.23 + Math.random() * 0.22;
  fish.wanderW2 = 0.61 + Math.random() * 0.5;
  fish.wanderW3 = 0.17 + Math.random() * 0.2;
  fish.wanderYaw = 0.05 + Math.random() * 0.08;
  fish.wanderDepth = 0.05 + Math.random() * 0.13;
  // Dart: short kick (original behavior, kept)
  fish.darting = false;
  fish.dartT = 2 + Math.random() * 18;
  fish.dartGain = 1;
  fish.dartYaw = 0;
  // Tempo: each fish has its own sprint/glide rhythm (moved from shoal)
  fish.tempo = 'cruise';
  fish.tempoT = Math.random() * 10;
  fish.tempoGain = 1;
}

export function habits(fish, aim, env, dt) {
  // Wander: a slow drift off the shared heading and depth.
  fish.wanderT += dt;
  const wt = fish.wanderT;
  aim.yaw += (Math.sin(wt * fish.wanderW1) * 0.6 + Math.sin(wt * fish.wanderW2 + 1.7) * 0.4) * fish.wanderYaw;
  aim.y += Math.sin(wt * fish.wanderW3 + 0.6) * fish.wanderDepth;

  // Tempo: each fish has its own sprint/glide rhythm influenced by shoal activity.
  fish.tempoT += dt;
  if (fish.tempo === 'cruise' && fish.tempoT > 7 + Math.random() * 14) {
    // Chance to sprint increases with shoal activity
    if (Math.random() < env.shoal.activity) {
      fish.tempo = 'sprint';
      fish.tempoT = 0;
      fish.tempoGain = 2.0 + Math.random() * 1.5;
    }
  } else if (fish.tempo === 'sprint' && fish.tempoT > 1.0 + Math.random() * 1.5) {
    fish.tempo = 'glide';
    fish.tempoT = 0;
    fish.tempoGain = 0.2;
  } else if (fish.tempo === 'glide' && fish.tempoT > 3 + Math.random() * 6) {
    fish.tempo = 'cruise';
    fish.tempoT = 0;
    fish.tempoGain = 1;
  }
  aim.speed *= fish.tempoGain;

  // Dart: a short kick on top of tempo. The slow coast in swimFish turns it into a glide.
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

// Wander and darts add up, so a fish that has drifted too far out heads back in.
// The pull is stronger for fish farther out or with lower flocking weight.
export function regroup(fish, aim, env) {
  if (fish.state !== FREE) return;
  const hx = env.cx - fish.x;
  const hz = env.cz - fish.z;
  const out = Math.hypot(hx, hz);
  if (out <= HOME_RANGE) return;

  // Pull strength increases with distance and decreases with flocking weight
  // (low weight fish have already drifted by choice, need less correction)
  const distFactor = clamp((out - HOME_RANGE) / 2.5, 0, 0.85);
  const weightFactor = 0.4 + fish.flockWeight * 0.6; // 0.4-1.0
  const w = distFactor * weightFactor;

  aim.yaw += wrapPi(Math.atan2(hx, hz) - aim.yaw) * w;
  if (hx * Math.sin(fish.yaw) + hz * Math.cos(fish.yaw) > 0) {
    aim.speed *= 1 + w * 0.4;
  }

  // Fish far out turn faster
  if (out > HOME_RANGE * 1.5) aim.turn = TURN_ALONE;
}
