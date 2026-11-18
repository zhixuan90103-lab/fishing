/**
 * Where the phone aims, and how that is shared between the view and the rod.
 *
 * Owns: the one aim direction (a base plus how far the phone has turned), what the view
 * is chasing and how fast, and what is left over for the rod.
 * Does not own: reading the phone (phoneLook.js), placing the camera, deciding what holds
 * the view or what it should watch (startShore.js and the gameplay), turning the rod
 * (rodHold.js), or any fishing rule.
 * No Three, no scene: it runs in Node. Design: docs/PHONE-LOOK.md.
 *
 * aim = view + rod, always. The rod gets whatever of the aim the view has not taken, so
 * the rod points where the phone points whatever the view is doing.
 *
 * The view is always chasing one of three things:
 *   the aim       the usual case: the view follows the phone.
 *   nothing       it is held: the finger is down and the phone moves only the rod.
 *   a direction   it is watching something the gameplay pointed at.
 * Changing between them only swaps what is chased. Nothing is copied or re-based, so no
 * change can jump. Coming back to the aim after watching, the chase starts slow and picks
 * up: the aim may be far from where the view was looking, and at the usual rate that is
 * a lurch.
 *
 * Degrees throughout. Yaw is positive to the view's left, pitch positive upward.
 */

import { chaseAngle } from './phoneLook.js';

// Degrees the aim turns per degree the phone turns. 1 is "the phone is the rod". The view
// and the rod share it, so raising it makes both more sensitive.
export const AIM_YAW_GAIN = 1;
export const AIM_PITCH_GAIN = 1;
// How fast the view catches up with the aim, 1/s. In a steady turn the view trails by the
// turn rate divided by this, and the rod leads it on screen by the same amount.
export const LOOK_RATE = 10;
// The view's pitch stays inside this, degrees. The rod is not held to it.
export const PITCH_LIMIT = 70;
// How fast the view turns to what it is watching, 1/s. Lower is a slower, calmer turn.
export const WATCH_RATE = 3;
// While watching, the view looks no higher and no lower than this, degrees. The top keeps
// the water in frame. The bottom stops it staring at its own feet at something close in.
export const WATCH_PITCH_MAX = 6;
export const WATCH_PITCH_MIN = -40;
// After watching, the view does not snap back to the phone's aim. It starts back at this
// rate, 1/s, which is nearly standing still, and picks up to LOOK_RATE again as fast as
// RETURN_RECOVER, 1/s: it eases off, swings across and settles in about a second. A lower
// RETURN_RECOVER makes the hand-back slower and softer.
export const RETURN_RATE = 0.2;
export const RETURN_RECOVER = 1;

const DEG = 180 / Math.PI;

function clampPitch(deg) {
  return Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, deg));
}

// The same direction as `deg`, written as the angle nearest to `near`.
function nearest(deg, near) {
  return near + ((((deg - near) % 360) + 540) % 360) - 180;
}

/**
 * The direction from an eye to a point, both { x, y, z } in the world, written into
 * out.yaw and out.pitch in degrees: what step() takes as `watch`.
 */
export function directionTo(eye, point, out) {
  const dx = point.x - eye.x;
  const dy = point.y - eye.y;
  const dz = point.z - eye.z;
  out.yaw = Math.atan2(dx, dz) * DEG;
  out.pitch = Math.atan2(dy, Math.hypot(dx, dz)) * DEG;
  return out;
}

/** yaw, pitch: where the view looks with the phone at its zero, degrees. */
export function createAim(yaw, pitch) {
  let baseYaw = yaw;
  let basePitch = pitch;
  // The aim the chase saw last frame.
  let lastYaw = yaw;
  let lastPitch = pitch;
  // The watched direction the chase saw last frame, and whether there was one.
  let watching = false;
  let lastWatchYaw = 0;
  let lastWatchPitch = 0;
  // How fast the view is chasing the aim right now. LOOK_RATE, except for a while after
  // it has been watching something.
  let follow = LOOK_RATE;

  const aim = {
    // Where the view looks.
    viewYaw: yaw,
    viewPitch: pitch,
    // What the view has not taken, in the view's space: turn, lift, and the phone's lean
    // in its own plane about the view axis. Positive roll is counter-clockwise on screen.
    rodYaw: 0,
    rodPitch: 0,
    rodRoll: 0,

    // The phone at its zero now looks along yaw, pitch, and the view is already there.
    // The caller zeroes the phone in the same breath.
    reset(nextYaw, nextPitch) {
      baseYaw = aim.viewYaw = lastYaw = nextYaw;
      basePitch = aim.viewPitch = lastPitch = nextPitch;
      aim.rodYaw = 0;
      aim.rodPitch = 0;
      aim.rodRoll = 0;
      watching = false;
      follow = LOOK_RATE;
    },

    /**
     * Once a frame. turned is phoneLook's look(): degrees since the phone's zero.
     * held keeps the view where it is. watch, if given, is a direction { yaw, pitch } in
     * degrees for the view to turn to instead, and wins over held.
     */
    step(turned, held, dt, watch = null) {
      const aimYaw = baseYaw + turned.yaw * AIM_YAW_GAIN;
      const aimPitch = basePitch + turned.pitch * AIM_PITCH_GAIN;
      if (watch) turnTo(watch, dt);
      else if (!held) followAim(aimYaw, aimPitch, dt);
      watching = Boolean(watch);
      lastYaw = aimYaw;
      lastPitch = aimPitch;
      aim.rodYaw = aimYaw - aim.viewYaw;
      aim.rodPitch = aimPitch - aim.viewPitch;
      // Right edge of the phone down tips the rod to the right of the screen.
      aim.rodRoll = -turned.roll;
    },
  };

  // The view chases a direction it has been pointed at. Yaw goes the short way round.
  // A direction that stays put is approached from one side and never passed.
  function turnTo(watch, dt) {
    const toYaw = nearest(watch.yaw, aim.viewYaw);
    const toPitch = Math.max(WATCH_PITCH_MIN, Math.min(WATCH_PITCH_MAX, watch.pitch));
    if (!watching) {
      lastWatchYaw = toYaw;
      lastWatchPitch = toPitch;
    }
    aim.viewYaw = chaseAngle(aim.viewYaw, toYaw, nearest(lastWatchYaw, aim.viewYaw), WATCH_RATE, dt);
    aim.viewPitch = clampPitch(chaseAngle(aim.viewPitch, toPitch, lastWatchPitch, WATCH_RATE, dt));
    lastWatchYaw = toYaw;
    lastWatchPitch = toPitch;
    // Whenever the view is given back, it starts back gently.
    follow = RETURN_RATE;
  }

  // The view chases the aim, at the usual rate or on its way back up to it.
  function followAim(aimYaw, aimPitch, dt) {
    aim.viewYaw = chaseAngle(aim.viewYaw, aimYaw, lastYaw, follow, dt);
    aim.viewPitch = clampPitch(chaseAngle(aim.viewPitch, aimPitch, lastPitch, follow, dt));
    follow += (LOOK_RATE - follow) * (1 - Math.exp(-RETURN_RECOVER * dt));
  }

  return aim;
}
