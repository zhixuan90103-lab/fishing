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

function clampPitch(deg) {
  return Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, deg));
}

/** yaw, pitch: where the view looks with the phone at its zero, degrees. */
export function createAim(yaw, pitch) {
  let baseYaw = yaw;
  let basePitch = pitch;
  // The aim the chase saw last frame.
  let lastYaw = yaw;
  let lastPitch = pitch;

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
    },

    // Once a frame. turned is phoneLook's look(): degrees since the phone's zero.
    // held keeps the view where it is. The rod still follows the phone.
    step(turned, held, dt) {
      const aimYaw = baseYaw + turned.yaw * AIM_YAW_GAIN;
      const aimPitch = basePitch + turned.pitch * AIM_PITCH_GAIN;
      if (!held) {
        aim.viewYaw = chaseAngle(aim.viewYaw, aimYaw, lastYaw, LOOK_RATE, dt);
        aim.viewPitch = clampPitch(chaseAngle(aim.viewPitch, aimPitch, lastPitch, LOOK_RATE, dt));
      }
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
