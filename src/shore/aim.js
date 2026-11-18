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
 * Watching, the view can be told where the rod tip is, and then it keeps the tip in the
 * picture. The tip has a window: a part of the picture it may be anywhere in. While it
 * is well inside, the view takes no notice of it and turns to what it is watching. As
 * the tip nears an edge of the window the view is pushed along, just enough to keep it
 * there. So the rod is never lost, what is watched may slide off the picture, and the
 * holder brings it back by working the rod. The tip is steadied first: a tip nodding at
 * the edge of its window must not nudge the view with every nod.
 *
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
// The rod tip's window: how far from the centre of the picture the tip may be, degrees,
// to the left, to the right, up and down. The view eases into these, it does not hit
// them. The portrait picture reaches about 13.5 to either side and 27.5 up and down.
// The rod is in the right hand and comes up out of the bottom right corner: with its tip
// off to the left it lies across the whole picture, with its tip off to the right most
// of it has left by the right edge. So the window is wide to the left and narrow to the
// right. It runs from the middle of the picture to near the top.
export const TIP_LEFT = 11.5;
export const TIP_RIGHT = 6.5;
export const TIP_UP = 24.5;
export const TIP_DOWN = 0;
// How fast the tip's direction is steadied before the window reads it, 1/s. It takes out
// the hand's shake and the nod of a fish's head, which are faster than this.
export const TIP_STEADY = 12;
// Keeping the tip in its window, the view hurries when it is far from where it should
// be: up to this rate, 1/s, once it is KEEP_HURRY_BY degrees off. A quick heave on the
// rod would otherwise leave it out of the picture until the view caught up.
export const KEEP_RATE = 8;
export const KEEP_HURRY_BY = 10;
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
  // The rod tip's direction, steadied, the raw one it saw last frame, and whether it has
  // one at all.
  let tipKnown = false;
  let tipYaw = 0;
  let tipPitch = 0;
  let lastTipYaw = 0;
  let lastTipPitch = 0;

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
     * degrees for the view to turn to instead, and wins over held. tip, if given while
     * watching, is the direction from the eye to the rod tip, { yaw, pitch } in degrees:
     * the view then keeps the tip inside its window.
     */
    step(turned, held, dt, watch = null, tip = null) {
      const aimYaw = baseYaw + turned.yaw * AIM_YAW_GAIN;
      const aimPitch = basePitch + turned.pitch * AIM_PITCH_GAIN;
      if (watch) turnTo(watch, dt, tip);
      else if (!held) followAim(aimYaw, aimPitch, dt);
      // The steadied tip is only good while it is being fed.
      if (!watch || !tip) tipKnown = false;
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
  // A value kept between lo and hi, eased into both: left alone in the middle, pressed
  // back more and more toward an edge.
  function within(value, lo, hi) {
    const mid = (lo + hi) / 2;
    const half = (hi - lo) / 2;
    return mid + half * Math.tanh((value - mid) / half);
  }

  function turnTo(watch, dt, tip) {
    let toYaw = nearest(watch.yaw, aim.viewYaw);
    // What is watched is looked at no higher and no lower than the limits. The rod tip,
    // below, may still push the view past them: the rod comes before the water.
    let toPitch = Math.max(WATCH_PITCH_MIN, Math.min(WATCH_PITCH_MAX, watch.pitch));
    let rate = WATCH_RATE;
    if (tip) {
      // The tip, steadied. The first time it is taken as it is.
      const rawYaw = nearest(tip.yaw, aim.viewYaw);
      if (!tipKnown) {
        tipYaw = lastTipYaw = rawYaw;
        tipPitch = lastTipPitch = tip.pitch;
        tipKnown = true;
      }
      tipYaw = chaseAngle(nearest(tipYaw, aim.viewYaw), rawYaw, nearest(lastTipYaw, aim.viewYaw), TIP_STEADY, dt);
      tipPitch = chaseAngle(tipPitch, tip.pitch, lastTipPitch, TIP_STEADY, dt);
      lastTipYaw = rawYaw;
      lastTipPitch = tip.pitch;
      // The tip is in its window while the view looks between these. Yaw is positive to
      // the left, so a tip to the left of centre has the view to its right.
      toYaw = within(toYaw, tipYaw - TIP_LEFT, tipYaw + TIP_RIGHT);
      toPitch = within(toPitch, tipPitch - TIP_UP, tipPitch + TIP_DOWN);
      const behind = Math.hypot(toYaw - aim.viewYaw, toPitch - aim.viewPitch);
      rate += (KEEP_RATE - WATCH_RATE) * Math.min(1, behind / KEEP_HURRY_BY);
    }
    if (!watching) {
      lastWatchYaw = toYaw;
      lastWatchPitch = toPitch;
    }
    aim.viewYaw = chaseAngle(aim.viewYaw, toYaw, nearest(lastWatchYaw, aim.viewYaw), rate, dt);
    aim.viewPitch = clampPitch(chaseAngle(aim.viewPitch, toPitch, lastWatchPitch, rate, dt));
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
