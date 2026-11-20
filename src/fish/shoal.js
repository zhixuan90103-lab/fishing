/**
 * The shoal as an environment, not a controller. It carries the bias for this area of
 * water: a suggested heading, depth, and activity level. Each fish decides its own speed.
 * Position is rewritten every frame as the average of free fish.
 *
 * Refactored 2026-11-20: Removed shared tempo (mode/effort/speed). Fish now have
 * individual rhythms in behaviors.js habits().
 */

import { clamp, wrapPi, DEPTH_MIN, DEPTH_MAX } from './swim.js';

// Speed of a fish with pace 1 at swim-rate slider 1. Used for tail animation.
export const CRUISE_SPEED = 0.351;
// Clip time scale at that speed.
export const TAIL_RATE = 2.2;
// Where the shoal likes to be: this far in front of the camera.
const HOME_AHEAD = 24;
const START_DEPTH = -2.7;
// Activity: how likely fish are to sprint on their own. Fluctuates slowly.
const ACTIVITY_MIN = 0.3;
const ACTIVITY_MAX = 0.8;
const ACTIVITY_CHANGE = 0.08; // per second
// Occasional jump in activity (like a startle with no cause)
const ACTIVITY_JUMP = 0.4;
const JUMP_EVERY = [25, 45]; // seconds

export function createShoal() {
  return {
    // Camera position and view (read by advanceHeading for staying in frame)
    camX: 0,
    camZ: 2,
    camYaw: (100 * Math.PI) / 180,
    camFov: 55,
    camAspect: 390 / 844,
    // Current position (rewritten each frame as average of free fish)
    x: 0,
    z: 0,
    y: START_DEPTH,
    // Environmental bias: suggested heading for this area of water
    homeYaw: 0,
    yawRate: 0,
    wishYawRate: 0,
    wishT: 0.6,
    veerT: 18,
    // Environmental bias: suggested depth
    homeDepth: START_DEPTH,
    y0: START_DEPTH,
    y1: START_DEPTH,
    vert: 'level',
    vertT: 0,
    vertDur: 12,
    searchW: 0.8,
    pitch: 0,
    // Environmental bias: activity level (how likely fish are to sprint)
    activity: 0.5,
    activityTarget: 0.5,
    jumpIn: 30,
  };
}

// In front of the camera, crossing the view. +Z is the head.
export function startPose(tune) {
  const yaw = (tune.yaw * Math.PI) / 180;
  return {
    x: tune.x + Math.sin(yaw) * HOME_AHEAD,
    z: tune.z + Math.cos(yaw) * HOME_AHEAD,
    y: START_DEPTH,
    yaw: yaw + Math.PI / 2,
  };
}

export function resetShoal(shoal, start) {
  shoal.x = start.x;
  shoal.z = start.z;
  shoal.y = start.y;
  shoal.homeDepth = start.y;
  shoal.homeYaw = start.yaw;
  shoal.yawRate = 0;
  beginLevel(shoal);
  shoal.vertDur = 10;
  shoal.activity = 0.5;
  shoal.activityTarget = 0.5;
  shoal.jumpIn = JUMP_EVERY[0] + Math.random() * (JUMP_EVERY[1] - JUMP_EVERY[0]);
}

export function watchCamera(shoal, cam) {
  shoal.camX = cam.x;
  shoal.camZ = cam.z;
  shoal.camYaw = cam.yaw;
  shoal.camFov = cam.fov;
  shoal.camAspect = cam.aspect;
}

export function advanceShoal(shoal, dt) {
  advanceActivity(shoal, dt);
  advanceDepth(shoal, dt);
  advanceHeading(shoal, dt);
}

// Activity: how likely fish are to sprint on their own. Drifts slowly, jumps occasionally.
function advanceActivity(shoal, dt) {
  // Countdown to next jump
  shoal.jumpIn -= dt;
  if (shoal.jumpIn <= 0) {
    shoal.activityTarget = clamp(shoal.activity + ACTIVITY_JUMP, ACTIVITY_MIN, ACTIVITY_MAX);
    shoal.jumpIn = JUMP_EVERY[0] + Math.random() * (JUMP_EVERY[1] - JUMP_EVERY[0]);
  }
  // Otherwise drift slowly toward a random target
  else if (Math.abs(shoal.activity - shoal.activityTarget) < 0.05) {
    shoal.activityTarget = ACTIVITY_MIN + Math.random() * (ACTIVITY_MAX - ACTIVITY_MIN);
  }
  // Smooth approach to target
  const change = (shoal.activityTarget > shoal.activity ? 1 : -1) * ACTIVITY_CHANGE * dt;
  shoal.activity = clamp(shoal.activity + change, ACTIVITY_MIN, ACTIVITY_MAX);
}

// Level for a while, then either step to another layer or search up and down a little.
// Updates homeDepth (the bias) which fish read to decide their own depth.
function advanceDepth(shoal, dt) {
  shoal.vertT += dt;
  const yPrev = shoal.y;
  if (shoal.vert === 'level') {
    shoal.y = shoal.homeDepth;
    if (shoal.vertT >= shoal.vertDur) {
      if (Math.random() < 0.16) beginSearch(shoal);
      else beginStep(shoal);
    }
  } else if (shoal.vert === 'step') {
    const u = clamp(shoal.vertT / shoal.vertDur, 0, 1);
    const s = u * u * (3 - 2 * u);
    shoal.y = shoal.y0 + (shoal.y1 - shoal.y0) * s;
    if (u >= 1) beginLevel(shoal);
  } else {
    shoal.y = clamp(
      shoal.homeDepth + Math.sin(shoal.vertT * shoal.searchW) * shoal.y0,
      DEPTH_MIN,
      DEPTH_MAX,
    );
    if (shoal.vertT >= shoal.vertDur) beginLevel(shoal);
  }
  shoal.homeDepth = shoal.y;
  const vy = dt > 0 ? (shoal.y - yPrev) / dt : 0;
  // Pitch is for visual only (not used by fish anymore)
  const aim = -Math.atan2(vy, 0.3);
  shoal.pitch += (clamp(aim, -0.45, 0.45) - shoal.pitch) * (1 - Math.exp(-4 * dt));
}

function beginLevel(shoal) {
  shoal.vert = 'level';
  shoal.vertT = 0;
  shoal.vertDur = 8 + Math.random() * 17;
  shoal.homeDepth = clamp(shoal.y, DEPTH_MIN, DEPTH_MAX);
  shoal.y = shoal.homeDepth;
}

function beginStep(shoal) {
  const big = Math.random() < 0.22;
  const span = big ? 0.8 + Math.random() * 0.5 : 0.28 + Math.random() * 0.4;
  const sign = Math.random() < 0.5 ? -1 : 1;
  shoal.y0 = shoal.y;
  shoal.y1 = clamp(shoal.y + sign * span, DEPTH_MIN, DEPTH_MAX);
  if (Math.abs(shoal.y1 - shoal.y0) < 0.12) {
    shoal.y1 = clamp(shoal.y0 + (shoal.y0 > -2.7 ? -0.45 : 0.45), DEPTH_MIN, DEPTH_MAX);
  }
  shoal.homeDepth = shoal.y1;
  shoal.vert = 'step';
  shoal.vertT = 0;
  const dy = Math.abs(shoal.y1 - shoal.y0);
  shoal.vertDur = clamp(dy / 0.28, 1.6, 4.2);
}

function beginSearch(shoal) {
  shoal.vert = 'search';
  shoal.vertT = 0;
  shoal.vertDur = 9 + Math.random() * 6;
  const room = Math.min(shoal.y - DEPTH_MIN, DEPTH_MAX - shoal.y);
  shoal.homeDepth = shoal.y;
  shoal.y0 = Math.min(0.45 + Math.random() * 0.25, Math.max(0.12, room * 0.85));
  shoal.searchW = 0.7 + Math.random() * 0.35;
}

// A slow random wish to turn, a rare hard veer, and a pull back into the camera's view.
// Updates homeYaw (the bias) which fish read to decide their own heading.
function advanceHeading(shoal, dt) {
  // Occasional hard veer (now handled by activity jump, not here)
  shoal.veerT -= dt;
  if (shoal.veerT <= 0) {
    shoal.veerT = 20 + Math.random() * 30;
    shoal.wishYawRate = (Math.random() < 0.5 ? -1 : 1) * (0.75 + Math.random() * 0.5);
    shoal.wishT = 1.1 + Math.random() * 0.7;
  }
  shoal.wishT -= dt;
  if (shoal.wishT <= 0) {
    shoal.wishT = 1.4 + Math.random() * 1.8;
    shoal.wishYawRate = (Math.random() - 0.5) * 0.55;
  }
  // Where the shoal sits in the picture. Near an edge it turns back; outside, harder.
  const camYaw = shoal.camYaw;
  const fx = Math.sin(camYaw);
  const fz = Math.cos(camYaw);
  const rx = Math.cos(camYaw);
  const rz = -Math.sin(camYaw);
  const relX = shoal.x - shoal.camX;
  const relZ = shoal.z - shoal.camZ;
  const forward = relX * fx + relZ * fz;
  const side = relX * rx + relZ * rz;
  const halfH = Math.atan(Math.tan((shoal.camFov * Math.PI) / 360) * shoal.camAspect);
  const halfW = Math.max(0.6, forward) * Math.tan(halfH);
  const edge = Math.abs(side) / Math.max(halfW, 0.4);
  const outside = forward < HOME_AHEAD - 4 || forward > HOME_AHEAD + 5 || edge > 1;
  const nearEdge = edge > 0.6 || forward < HOME_AHEAD - 2 || forward > HOME_AHEAD + 3;
  const centerX = shoal.camX + fx * HOME_AHEAD;
  const centerZ = shoal.camZ + fz * HOME_AHEAD;
  const err = wrapPi(Math.atan2(centerX - shoal.x, centerZ - shoal.z) - shoal.homeYaw);
  const steer = err * (outside ? 2.4 : nearEdge ? 1.15 : 0.2);
  const wish = clamp((outside || nearEdge ? 0 : shoal.wishYawRate) + steer, -1.3, 1.3);
  shoal.yawRate += (wish - shoal.yawRate) * (1 - Math.exp(-1.6 * dt));
  shoal.homeYaw = wrapPi(shoal.homeYaw + shoal.yawRate * dt);
}
