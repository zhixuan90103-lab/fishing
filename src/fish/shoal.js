/**
 * The shoal is the school as one body. It is not drawn. It carries the shared heading,
 * depth and tempo that fish in the school aim at. Its position is rewritten every frame
 * as the average of its members, so the fish move the shoal, not the other way round.
 */

import { clamp, wrapPi, DEPTH_MIN, DEPTH_MAX } from './swim.js';

// Speed of a fish with pace 1 while the shoal cruises and the swim-rate slider is 1.
export const CRUISE_SPEED = 0.351;
// Clip time scale at that speed.
export const TAIL_RATE = 2.2;
// Where the shoal likes to be: this far in front of the camera.
const HOME_AHEAD = 13;
const START_DEPTH = -2.7;

export function createShoal() {
  return {
    camX: 0,
    camZ: 2,
    camYaw: (100 * Math.PI) / 180,
    camFov: 55,
    camAspect: 390 / 844,
    x: 0,
    z: 0,
    y: START_DEPTH,
    yaw: 0,
    yawRate: 0,
    wishYawRate: 0,
    wishT: 0.6,
    veerT: 18,
    depth: START_DEPTH,
    y0: START_DEPTH,
    y1: START_DEPTH,
    vert: 'level',
    vertT: 0,
    vertDur: 12,
    searchW: 0.8,
    cruiseFor: 14,
    sprintFor: 2.6,
    glideFor: 9,
    sprintTarget: 4.2,
    effort: 1,
    mode: 'cruise',
    stageT: 0,
    pitch: 0,
    speed: CRUISE_SPEED,
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
  shoal.depth = start.y;
  shoal.yaw = start.yaw;
  shoal.yawRate = 0;
  beginLevel(shoal);
  shoal.vertDur = 10;
}

export function watchCamera(shoal, cam) {
  shoal.camX = cam.x;
  shoal.camZ = cam.z;
  shoal.camYaw = cam.yaw;
  shoal.camFov = cam.fov;
  shoal.camAspect = cam.aspect;
}

export function advanceShoal(shoal, dt, rate) {
  advanceTempo(shoal, dt, rate);
  advanceDepth(shoal, dt);
  advanceHeading(shoal, dt);
}

// Cruise, sprint, glide. Each stage draws its own length, so the rhythm never repeats.
// Speeding up is quick, slowing down coasts.
function advanceTempo(shoal, dt, rate) {
  shoal.stageT += dt;
  let target = 1;
  if (shoal.mode === 'cruise' && shoal.stageT > shoal.cruiseFor) {
    shoal.mode = 'sprint';
    shoal.stageT = 0;
    shoal.sprintFor = 1.2 + Math.random() * 1.8;
    shoal.sprintTarget = 2.4 + Math.random() * 1.8;
  }
  if (shoal.mode === 'sprint') {
    target = shoal.sprintTarget;
    if (shoal.stageT > shoal.sprintFor) {
      shoal.mode = 'glide';
      shoal.stageT = 0;
      shoal.glideFor = 4 + Math.random() * 7;
    }
  } else if (shoal.mode === 'glide') {
    target = 0.18;
    if (shoal.stageT > shoal.glideFor) {
      shoal.mode = 'cruise';
      shoal.stageT = 0;
      shoal.cruiseFor = 7 + Math.random() * 14;
    }
  }
  const k = target > shoal.effort ? 1.1 : 0.22;
  shoal.effort += (target - shoal.effort) * (1 - Math.exp(-k * dt));
  shoal.speed = CRUISE_SPEED * rate * shoal.effort;
}

// Level for a while, then either step to another layer or search up and down a little.
function advanceDepth(shoal, dt) {
  shoal.vertT += dt;
  const yPrev = shoal.y;
  if (shoal.vert === 'level') {
    shoal.y = shoal.depth;
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
      shoal.depth + Math.sin(shoal.vertT * shoal.searchW) * shoal.y0,
      DEPTH_MIN,
      DEPTH_MAX,
    );
    if (shoal.vertT >= shoal.vertDur) beginLevel(shoal);
  }
  const vy = dt > 0 ? (shoal.y - yPrev) / dt : 0;
  const aim = -Math.atan2(vy, Math.max(shoal.speed, 0.04));
  shoal.pitch += (clamp(aim, -0.45, 0.45) - shoal.pitch) * (1 - Math.exp(-4 * dt));
}

function beginLevel(shoal) {
  shoal.vert = 'level';
  shoal.vertT = 0;
  shoal.vertDur = 8 + Math.random() * 17;
  shoal.depth = clamp(shoal.y, DEPTH_MIN, DEPTH_MAX);
  shoal.y = shoal.depth;
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
  shoal.depth = shoal.y1;
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
  shoal.depth = shoal.y;
  shoal.y0 = Math.min(0.45 + Math.random() * 0.25, Math.max(0.12, room * 0.85));
  shoal.searchW = 0.7 + Math.random() * 0.35;
}

// A slow random wish to turn, a rare hard veer, and a pull back into the camera's view.
function advanceHeading(shoal, dt) {
  // Now and then the whole school veers hard and kicks, like a startle with no cause.
  shoal.veerT -= dt;
  if (shoal.veerT <= 0) {
    shoal.veerT = 20 + Math.random() * 30;
    shoal.wishYawRate = (Math.random() < 0.5 ? -1 : 1) * (0.75 + Math.random() * 0.5);
    shoal.wishT = 1.1 + Math.random() * 0.7;
    if (shoal.mode !== 'sprint') {
      shoal.mode = 'sprint';
      shoal.stageT = 0;
      shoal.sprintFor = 0.9 + Math.random() * 0.9;
      shoal.sprintTarget = 2.2 + Math.random() * 1.2;
    }
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
  const outside = forward < 9 || forward > 18 || edge > 1;
  const nearEdge = edge > 0.6 || forward < 11 || forward > 16;
  const centerX = shoal.camX + fx * HOME_AHEAD;
  const centerZ = shoal.camZ + fz * HOME_AHEAD;
  const err = wrapPi(Math.atan2(centerX - shoal.x, centerZ - shoal.z) - shoal.yaw);
  const steer = err * (outside ? 2.4 : nearEdge ? 1.15 : 0.2);
  const wish = clamp((outside || nearEdge ? 0 : shoal.wishYawRate) + steer, -1.3, 1.3);
  shoal.yawRate += (wish - shoal.yawRate) * (1 - Math.exp(-1.6 * dt));
  shoal.yaw = wrapPi(shoal.yaw + shoal.yawRate * dt);
}
