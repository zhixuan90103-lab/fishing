/**
 * Where the phone aims, and how that is shared between the view and the rod.
 *
 * Owns: the one aim direction (a base plus how far the phone has turned), the view's chase
 * of it, and what is left over for the rod.
 * Does not own: reading the phone (phoneLook.js), placing the camera or deciding what
 * holds the view (startShore.js), turning the rod (rodHold.js), or any fishing rule.
 * No Three, no scene: it runs in Node. Design: docs/PHONE-LOOK.md.
 *
 * aim = view + rod, always. The view chases the aim unless it is held, and the rod gets
 * the rest, so the rod points where the phone points whether or not the view follows.
 * Nothing is copied or re-based on press or release, so neither can jump.
 *
 * The view can also be given something to watch. Then it turns to that direction instead
 * of the aim, and the rod still gets aim minus view: the rod keeps pointing where the
 * phone points while the view looks elsewhere. When the watching ends the view goes back
 * to chasing the aim, slowly at first: the aim may be far from where it was looking, and
 * at the usual rate that is a lurch. Each change only swaps what the view is chasing, so
 * none can jump.
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
// After watching, the view does not snap back to the phone's aim. It starts back at this
// rate, 1/s, which is nearly standing still, and picks up to LOOK_RATE again as fast as
// RETURN_RECOVER, 1/s: it eases off, swings across and settles in about a second. A lower
// RETURN_RECOVER makes the hand-back slower and softer.
export const RETURN_RATE = 0.2;
export const RETURN_RECOVER = 1;
// While watching, the view looks no higher and no lower than this, degrees. The top keeps
// the water in frame. The bottom stops it staring at its own feet at something close in.
export const WATCH_PITCH_MAX = 6;
export const WATCH_PITCH_MIN = -40;

function clampPitch(deg) {
  return Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, deg));
}

// The same direction as `deg`, written as the angle nearest to `near`.
function nearest(deg, near) {
  return near + ((((deg - near) % 360) + 540) % 360) - 180;
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

    // Once a frame. turned is phoneLook's look(): degrees since the phone's zero.
    // held keeps the view where it is. watch, if given, is a direction { yaw, pitch } in
    // degrees for the view to turn to instead, and wins over held. In every case the rod
    // still follows the phone.
    step(turned, held, dt, watch = null) {
      const aimYaw = baseYaw + turned.yaw * AIM_YAW_GAIN;
      const aimPitch = basePitch + turned.pitch * AIM_PITCH_GAIN;
      if (watch) {
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
      } else if (!held) {
        aim.viewYaw = chaseAngle(aim.viewYaw, aimYaw, lastYaw, follow, dt);
        aim.viewPitch = clampPitch(chaseAngle(aim.viewPitch, aimPitch, lastPitch, follow, dt));
        follow += (LOOK_RATE - follow) * (1 - Math.exp(-RETURN_RECOVER * dt));
      }
      watching = Boolean(watch);
      lastYaw = aimYaw;
      lastPitch = aimPitch;
      aim.rodYaw = aimYaw - aim.viewYaw;
      aim.rodPitch = aimPitch - aim.viewPitch;
      // Right edge of the phone down tips the rod to the right of the screen.
      aim.rodRoll = -turned.roll;
    },
  };
  return aim;
}
