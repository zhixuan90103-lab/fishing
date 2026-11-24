/**
 * What one free fish wants, as an aim for swimFish.
 *
 * Owns: the nature each fish is given once (how much it keeps to others, how often it
 * takes a notion to go somewhere), and each frame its aim: a heading, a speed and a depth.
 * Does not own: moving the fish (swim.js), what it can tell of its neighbours
 * (neighbours.js), where the water it keeps to is (homeWater.js), or a fish someone has
 * taken (their brain writes its aim).
 * No Three, no scene: it runs in Node. Design: docs/FISH-SCHOOL.md section 4.
 *
 * Nobody runs the school. Each fish makes up its own mind from five things, added up as
 * directions and weighed:
 *   itself      carry on the way it is going, meandering a little
 *   neighbours  head the way the near ones head, and close on the ones too far off
 *   a notion    now and then, a place it wants to go and look at
 *   the water   turn back toward the middle when it has come too near the edge
 *   crowding    give way to a fish that is too close (swim.js adds this one)
 * Turning together, splitting and joining, changing depth, one fish going off alone:
 * none of that is written down anywhere. It comes of fish that differ doing this.
 *
 * Most fish have no notions and simply keep with their neighbours. A few have them
 * often, and those few take the rest along without anyone knowing who leads (Couzin et
 * al. 2005, in docs/FISH-SWIM-RESEARCH.md).
 *
 * Nothing here runs on a shared clock. Things that happen now and then happen at a rate,
 * by chance, fish by fish; a bolt has a cause.
 *
 * Units: metres, seconds, radians.
 */

import { clamp, wrapPi, ACCEL_DART, DEPTH_MIN, DEPTH_MAX } from './swim.js';
import { FREE } from './states.js';

// An unhurried fish covers this many of its own body lengths a second, before its own
// pace. Measured for this fish only in small tanks, where it stays under 0.5; fish in
// open water usually keep to 0.5 to 1 (docs/FISH-SWIM-RESEARCH.md). With PACE that is
// 0.62 to 0.94.
export const CRUISE_LENGTHS = 0.78;
// Each fish is a little slower or faster than that, for good.
const PACE = [0.8, 1.2];

// How much each thing weighs in where it heads. Itself is 1.
const ALIGN = 0.8;
const COHERE = 1.6;
// With this much company near it (neighbours.js counts a fish at arm's length as nearly
// 1 and one at the edge of near sight as 0) a fish does not try to get closer to anyone.
const COMPANY = 1.6;
const NOTION = 1.6;
const HOME = 2.6;
// Past the edge of its water a fish does not get more and more frantic: this is the most
// the edge weighs, in units of unease.
const HOME_MOST = 2.5;

// How much a fish keeps to others, 0 to 1: a fish of body scale 1 is SOCIAL_AT_ONE, each
// 1 of scale bigger takes off SOCIAL_BY_SIZE, and each fish is this much either way of
// that. Big fish of this kind are more often alone (FishEthoBase dossier).
const SOCIAL_AT_ONE = 0.74;
const SOCIAL_BY_SIZE = 0.75;
const SOCIAL_VARIES = 0.15;
const SOCIAL_LEAST = 0.22;

// Its meander: the most it leans off its own heading, rad, and how fast that drifts.
const MEANDER = [0.3, 0.65];
// It likes a depth of its own, and drifts about it by this much, m.
const LEVEL_DRIFT = [0.05, 0.18];
// How much of the way to its neighbours' depth a wholly social fish goes.
const LEVEL_WITH_OTHERS = 0.75;

// Notions. A bold fish takes one about every BOLD_EVERY seconds, the rest every
// MEEK_EVERY, and this share are bold. It gives up after about GIVES_UP seconds if it
// has not got there, and it has got there within ARRIVED metres.
const BOLD_SHARE = 0.2;
const BOLD_EVERY = 15;
const MEEK_EVERY = 160;
const GIVES_UP = 28;
const ARRIVED = 1.4;

// Speed. It takes this much of its neighbours' speed, if wholly social.
const MATCH_SPEED = 0.5;
// The others ahead of it, it speeds up by up to this share; behind it, slows by this.
const CATCH_UP = 0.6;
const WAIT_UP = 0.3;
// Uneasy at the edge and heading back in, it hurries by up to this share.
const HURRY_HOME = 0.5;
// It swims in kicks and glides: it beats until it is this much over the speed it wants,
// then lets itself glide down to this much under, and beats again. While it beats it
// aims this much high, while it glides this much low.
const KICK_TO = 1.08;
const GLIDE_TO = 0.9;
const KICK_AIM = 1.3;
const GLIDE_AIM = 0.6;

// Bolting: a short hard kick. What sets it off, as a rate per second:
//   squeezed   packed in tighter than SQUEEZED, per unit of crowding over that
//   alarm      for each fish bolting right beside it
//   alone      able to see the others and with none near
const SQUEEZED = 0.55;
const BOLT_SQUEEZED = 0.5;
const BOLT_ALARM = 0.9;
const BOLT_ALONE = 0.12;
// How long a bolt lasts, s, how much faster it goes, and how far it swerves, rad.
const BOLT_FOR = [0.4, 0.9];
const BOLT_GAIN = [1.6, 2.5];
const BOLT_SWERVE = 0.35;
// Having bolted it will not again for this long, s: it has to get its breath back.
const BOLT_SPENT = [3, 7];

const between = (random, range) => range[0] + random() * (range[1] - range[0]);
// True about once every `every` seconds, whatever the frame rate.
const happens = (random, every, dt) => random() < 1 - Math.exp(-dt / every);

const back = { x: 0, z: 0 };
const place = { x: 0, z: 0 };

/** What a fish is for good, drawn once. Needs fish.size. random: 0 to 1. */
export function seedNature(fish, random) {
  fish.pace = between(random, PACE);
  fish.social = clamp(SOCIAL_AT_ONE - SOCIAL_BY_SIZE * (fish.size - 1) + (random() * 2 - 1) * SOCIAL_VARIES, SOCIAL_LEAST, 1);
  fish.bold = random() < BOLD_SHARE;
  // Meander: three slow waves of its own, never in step with another fish's.
  fish.wanderT = random() * 100;
  fish.wanderW1 = 0.23 + random() * 0.22;
  fish.wanderW2 = 0.61 + random() * 0.5;
  fish.wanderW3 = 0.17 + random() * 0.2;
  fish.wanderYaw = between(random, MEANDER);
  fish.wanderDepth = between(random, LEVEL_DRIFT);
  // Kick and glide: each fish's band is a little its own.
  fish.kickTo = KICK_TO + (random() - 0.5) * 0.06;
  fish.glideTo = GLIDE_TO + (random() - 0.5) * 0.06;
}

/** It is its own master, as of now: at the start, or handed back. */
export function setFree(fish) {
  fish.state = FREE;
  fish.brain = null;
  fish.level = clamp(fish.y, DEPTH_MIN + 0.2, DEPTH_MAX - 0.2);
  fish.notion = false;
  fish.goalX = 0;
  fish.goalY = 0;
  fish.goalZ = 0;
  fish.kicking = true;
  fish.darting = false;
  fish.dartT = 0;
  fish.dartGain = 1;
  fish.dartYaw = 0;
  fish.spent = 0;
}

/**
 * Write the aim of free fish number i. aim.cruise is its unhurried speed already.
 * env: { sense, water, random }. crowd: how hard it is being squeezed, 0 up.
 */
export function free(fish, i, aim, env, crowd, dt) {
  const { sense, water, random } = env;
  const social = fish.social;
  const near = sense.near[i];
  const fx = Math.sin(fish.yaw);
  const fz = Math.cos(fish.yaw);

  // Itself: on the way it is going, leaning a little to one side and then the other.
  fish.wanderT += dt;
  const wt = fish.wanderT;
  const lean = (Math.sin(wt * fish.wanderW1) * 0.6 + Math.sin(wt * fish.wanderW2 + 1.7) * 0.4) * fish.wanderYaw;
  let vx = Math.sin(fish.yaw + lean);
  let vz = Math.cos(fish.yaw + lean);

  // Its neighbours: the way they head, and toward the ones too far off. With company
  // enough about it, it feels no need to close in.
  const wants = social * COHERE * Math.max(0, 1 - near / COMPANY);
  vx += sense.alignX[i] * social * ALIGN + sense.toX[i] * wants;
  vz += sense.alignZ[i] * social * ALIGN + sense.toZ[i] * wants;

  // A notion: somewhere to go and look. Got there or given up, it is over, and the depth
  // it went to is the depth it likes now.
  if (fish.notion) {
    const gx = fish.goalX - fish.x;
    const gz = fish.goalZ - fish.z;
    const gd = Math.hypot(gx, gz);
    if (gd < ARRIVED || happens(random, GIVES_UP, dt)) {
      fish.notion = false;
      if (gd < ARRIVED) fish.level = fish.goalY;
    } else {
      vx += (gx / gd) * NOTION;
      vz += (gz / gd) * NOTION;
    }
  } else if (happens(random, fish.bold ? BOLD_EVERY : MEEK_EVERY, dt)) {
    water.pick(random, place);
    fish.notion = true;
    fish.goalX = place.x;
    fish.goalZ = place.z;
    fish.goalY = DEPTH_MIN + 0.2 + random() * (DEPTH_MAX - DEPTH_MIN - 0.4);
  }

  // The water: near the edge it would sooner turn back, and more so outside.
  const uneasy = Math.min(water.unease(fish.x, fish.z, back), HOME_MOST);
  vx += back.x * uneasy * HOME;
  vz += back.z * uneasy * HOME;

  aim.yaw = Math.atan2(vx, vz);

  // Depth: its own, drifting, and its neighbours' as far as it keeps to them. On a
  // notion it goes to that depth.
  let y = fish.level + Math.sin(wt * fish.wanderW3 + 0.6) * fish.wanderDepth;
  if (fish.notion) y = fish.goalY;
  else if (near > 0) y += (sense.y[i] - y) * social * LEVEL_WITH_OTHERS * Math.min(1, near);
  aim.y = clamp(y, DEPTH_MIN, DEPTH_MAX);

  // Speed: its own, some of its neighbours', faster to close on fish ahead and slower to
  // let fish behind come up, and hurrying when it is heading back into its water.
  let speed = aim.cruise;
  if (near > 0) speed += (sense.speed[i] - speed) * social * MATCH_SPEED * Math.min(1, near);
  const ahead = sense.toX[i] * fx + sense.toZ[i] * fz;
  speed *= 1 + (wants / COHERE) * (ahead > 0 ? CATCH_UP : WAIT_UP) * ahead;
  const inward = back.x * fx + back.z * fz;
  if (inward > 0) speed *= 1 + HURRY_HOME * Math.min(1, uneasy) * inward;

  // Kick and glide about that speed: nobody times it, the fish's own speed does.
  if (fish.kicking) {
    if (fish.speed >= speed * fish.kickTo) fish.kicking = false;
  } else if (fish.speed <= speed * fish.glideTo) fish.kicking = true;
  aim.speed = speed * (fish.kicking ? KICK_AIM : GLIDE_AIM);

  // Bolting. It has a cause: squeezed, a neighbour bolting, or finding itself alone.
  if (fish.darting) {
    fish.dartT -= dt;
    if (fish.dartT <= 0) {
      fish.darting = false;
      fish.spent = between(random, BOLT_SPENT);
    }
  } else if (fish.spent > 0) {
    fish.spent -= dt;
  } else {
    const rate = BOLT_SQUEEZED * Math.max(0, crowd - SQUEEZED)
      + BOLT_ALARM * sense.alarm[i]
      + (near === 0 && sense.seen[i] ? BOLT_ALONE : 0);
    if (rate > 0 && random() < 1 - Math.exp(-rate * dt)) {
      fish.darting = true;
      fish.dartT = between(random, BOLT_FOR);
      fish.dartGain = between(random, BOLT_GAIN);
      fish.dartYaw = (random() - 0.5) * 2 * BOLT_SWERVE;
    }
  }
  if (fish.darting) {
    aim.speed = speed * fish.dartGain;
    aim.yaw += fish.dartYaw;
    aim.accel = ACCEL_DART;
  }
}
