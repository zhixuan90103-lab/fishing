/**
 * How the hand carries the rod. Three is used for its maths only: no scene, no model.
 *
 * Owns: where the rod sits in front of the view, how it trails the view when it turns,
 * and adding the phone's aim and the working hand's part (rodHand.js) to that.
 * Does not own: how the blank bends (rodFlex.js), the model (rod.js), or any fishing rule.
 *
 * The rod's root is a child of the view (the camera). Each frame this places the root in
 * the view's space, and reports where the grip is in the world for the bend to read.
 *
 * Two things are done to the view's turning before the rod sees it:
 *   1. Smoothing. A dragged view turns in uneven steps. Both the trail and the bend read
 *      the smoothed view, so the stutter reaches neither the screen nor the tip.
 *   2. Trail. The rod chases the smoothed view and turns about the hand by what it has
 *      not caught up yet: everything ahead of the handle hangs back, the hand stays put.
 *
 * The phone's aim comes in through setAim and is added on top of the trail, untouched:
 * aim.js works out how much of the phone's turn the view has not taken, and
 * startShore.js hands that in.
 *
 * A hand holding against a fish is not a clamp: it gives, shakes and lays the rod over.
 * What that comes to is rodHand.js. It is laid on last, about the hand like the rest, so
 * it reaches the blank as the grip moving and the blank shivers with it.
 */

import * as THREE from 'three/webgpu';
import { createRodHand } from './rodHand.js';

// How fast the rod catches up with the view, 1/s. In a steady turn it trails by the turn
// rate divided by this.
const FOLLOW_RATE = 16;
// Most it may trail, degrees. It eases into this, it does not hit it.
const FOLLOW_MAX = 5;
// Smoothing of the view, two stages at this rate, 1/s. About 45 ms of delay. Starts and
// stops still get through. Lower is steadier and duller, and it mutes the blank's fastest mode.
const SMOOTH_RATE = 45;

// Where the rod sits in the view's space, metres and degrees. aimUp rises off the view
// axis, aimSide yaws it, roll spins the reel around the blank.
export const ROD_POSE = {
  x: 0.1,
  y: -0.32,
  z: -0.42,
  aimUp: 30,
  aimSide: -4,
  roll: 0,
};

const IDENTITY = new THREE.Quaternion();

/**
 * root: the rod's root object. Its local +Y runs butt to tip, +Z is the underside.
 * handAt: where the hand holds it, metres up from the butt.
 */
export function createRodHold(root, handAt) {
  const pose = { ...ROD_POSE };

  // The mount: the root's pose in the view's space when nothing trails.
  const mountQ = new THREE.Quaternion();
  const mountP = new THREE.Vector3();
  const hand = new THREE.Vector3();
  // What the rod has not caught up yet, as a turn about the hand in the view's space.
  const trail = new THREE.Quaternion();

  const blankDir = new THREE.Vector3();
  const down = new THREE.Vector3();
  const side = new THREE.Vector3();
  const rollQ = new THREE.Quaternion();
  const basis = new THREE.Matrix4();
  function setMount() {
    const aimUp = pose.aimUp * Math.PI / 180;
    const aimSide = pose.aimSide * Math.PI / 180;
    blankDir.set(
      Math.sin(aimSide) * Math.cos(aimUp),
      Math.sin(aimUp),
      -Math.cos(aimSide) * Math.cos(aimUp),
    ).normalize();
    down.set(0, -1, 0).addScaledVector(blankDir, -down.dot(blankDir));
    if (down.lengthSq() < 1e-8) down.set(0, 0, 1);
    down.normalize();
    if (pose.roll) {
      rollQ.setFromAxisAngle(blankDir, pose.roll * Math.PI / 180);
      down.applyQuaternion(rollQ);
    }
    side.crossVectors(blankDir, down).normalize();
    mountQ.setFromRotationMatrix(basis.makeBasis(side, blankDir, down));
    mountP.set(pose.x, pose.y, pose.z);
    hand.set(0, handAt, 0).applyQuaternion(mountQ).add(mountP);
  }

  function placeRoot() {
    // View lag first, then the phone aim at full size. The 5° cap belongs to the view
    // lag only. The aim is where the phone points minus where the view points. The
    // working hand's give and shake go on last, about the hand like the rest.
    swing.multiplyQuaternions(trail, aimQ).premultiply(working.turn);
    root.quaternion.multiplyQuaternions(swing, mountQ);
    root.position.copy(mountP).sub(hand).applyQuaternion(swing).add(hand).add(working.shift);
  }

  // Move q toward target at the given rate. Exact for a target that turns evenly through
  // the frame, so the lag does not depend on the frame rate: close on where the target
  // was, then take a share of its turn. last is the target's previous value.
  const turn = new THREE.Quaternion();
  const part = new THREE.Quaternion();
  // q and -q are the same turn. Keep the one with a positive scalar so the angle stays short.
  function positiveHalf(q) {
    if (q.w < 0) q.set(-q.x, -q.y, -q.z, -q.w);
  }
  function chase(q, target, last, rate, dt) {
    const keep = Math.exp(-rate * dt);
    q.slerp(last, 1 - keep);
    const share = dt > 1e-6 ? 1 - (1 - keep) / (rate * dt) : 0;
    turn.copy(target).multiply(part.copy(last).invert());
    positiveHalf(turn);
    q.premultiply(part.identity().slerp(turn, share));
    last.copy(target);
  }

  // The chain, all world orientations: view -> ease -> eased -> held.
  // eased is the view with the stutter taken out. held chases eased. The trail is measured
  // against eased, not the raw view, or every uneven step would land on the screen.
  const viewQ = new THREE.Quaternion();
  const lastViewQ = new THREE.Quaternion();
  const easeQ = new THREE.Quaternion();
  const lastEaseQ = new THREE.Quaternion();
  const easedQ = new THREE.Quaternion();
  const lastEasedQ = new THREE.Quaternion();
  const heldQ = new THREE.Quaternion();
  let started = false;
  function followView(dt) {
    root.parent.getWorldQuaternion(viewQ);
    if (!started) {
      for (const q of [lastViewQ, easeQ, lastEaseQ, easedQ, lastEasedQ, heldQ]) q.copy(viewQ);
      started = true;
    }
    chase(easeQ, viewQ, lastViewQ, SMOOTH_RATE, dt);
    chase(easedQ, easeQ, lastEaseQ, SMOOTH_RATE, dt);
    chase(heldQ, easedQ, lastEasedQ, FOLLOW_RATE, dt);
    trail.copy(easedQ).invert().multiply(heldQ);
    positiveHalf(trail);
    const angle = 2 * Math.acos(Math.min(1, trail.w));
    const most = FOLLOW_MAX * Math.PI / 180;
    if (angle > 1e-6) trail.slerp(IDENTITY, 1 - (most * Math.tanh(angle / most)) / angle);
  }

  // Phone aim in the view's space, on top of the mount. Identity once the view has caught
  // up with the phone. Not chased and not capped here: phoneLook has already smoothed it,
  // and a fast lift has to reach the blank at full speed.
  const aimQ = new THREE.Quaternion();
  const aimEuler = new THREE.Euler(0, 0, 0, 'YXZ');
  const swing = new THREE.Quaternion();

  // The working hand: what it adds to the pose is rodHand.js's. This file only tells it
  // where the pull comes from, seen from the hand in the view's space, and where the
  // blank points before the hand's part is laid on.
  const working = createRodHand();
  let pulled = false;
  const pullAt = new THREE.Vector3();
  const want = new THREE.Vector3();
  const blankNow = new THREE.Vector3();
  const viewNowQ = new THREE.Quaternion();
  const viewNowP = new THREE.Vector3();
  function workHand(dt) {
    let from = null;
    if (pulled && root.parent) {
      root.parent.getWorldQuaternion(viewNowQ);
      root.parent.getWorldPosition(viewNowP);
      from = want.copy(pullAt).sub(viewNowP).applyQuaternion(viewNowQ.invert()).sub(hand);
    }
    blankNow.set(0, 1, 0).applyQuaternion(mountQ).applyQuaternion(aimQ).applyQuaternion(trail);
    working.step(dt, blankNow, from);
  }

  // The grip in the world, as the bend should see it: built on the smoothed view.
  const grip = {
    butt: new THREE.Vector3(),
    axis: new THREE.Vector3(),
    quaternion: new THREE.Quaternion(),
  };
  const viewP = new THREE.Vector3();
  const invViewQ = new THREE.Quaternion();
  const bendPoint = new THREE.Vector3();

  setMount();
  placeRoot();

  return {
    // World-space butt position, unit axis butt to tip, and orientation of the grip.
    // Valid after carry().
    grip,

    // Any of the ROD_POSE fields.
    setPose(next) {
      Object.assign(pose, next);
      setMount();
      placeRoot();
    },

    // Extra aim in the view's space, on top of ROD_POSE, degrees: lift about the view's X,
    // then turn about its Y, with the lean about the view axis applied first. Full size,
    // not limited by FOLLOW_MAX. All zero is no aim.
    setAim(pitch, yaw, roll) {
      aimEuler.set(pitch * Math.PI / 180, yaw * Math.PI / 180, roll * Math.PI / 180, 'YXZ');
      aimQ.setFromEuler(aimEuler);
    },

    // How hard the hand is working against a pull, 0 to 1. The caller eases it: it is laid
    // straight onto the pose, so a step in it is a step on screen.
    setStrain(value) {
      working.setStrain(value);
    },

    // Where that pull comes from, world space: the far end of the line, whenever the line
    // is tied to the tip, taut or not (rod.js). null when nothing is tied on. The last direction is kept, for the effort to ease off along.
    setPull(point) {
      pulled = !!point;
      if (point) pullAt.copy(point);
    },

    // The bend is integrated in the smoothed view's frame. A world point (the line's far
    // end) has to be brought into that same frame or the pull is measured to a different
    // tip than the one on screen. Rotating about the view keeps the distance to the drawn
    // tip: the drawn blank is this frame's curve, carried by the raw view.
    intoBend(world, out) {
      if (!root.parent || !started) {
        out.copy(world);
        return out;
      }
      invViewQ.copy(viewQ).invert();
      bendPoint.copy(world).sub(viewP).applyQuaternion(invViewQ).applyQuaternion(easedQ);
      out.copy(bendPoint).add(viewP);
      return out;
    },

    // A point of the bend's frame back in the world: the other way round from intoBend.
    outOfBend(bent, out) {
      if (!root.parent || !started) {
        out.copy(bent);
        return out;
      }
      invViewQ.copy(easedQ).invert();
      bendPoint.copy(bent).sub(viewP).applyQuaternion(invViewQ).applyQuaternion(viewQ);
      out.copy(bendPoint).add(viewP);
      return out;
    },
    // The same two turns for something that has a direction and no place: a speed.
    turnIntoBend(v) {
      if (root.parent && started) v.applyQuaternion(invViewQ.copy(viewQ).invert()).applyQuaternion(easedQ);
      return v;
    },
    turnOutOfBend(v) {
      if (root.parent && started) v.applyQuaternion(invViewQ.copy(easedQ).invert()).applyQuaternion(viewQ);
      return v;
    },

    // Place the root for this frame and refresh grip. Leaves the root's world matrix current.
    carry(dt) {
      if (root.parent) {
        followView(dt);
        workHand(dt);
        placeRoot();
      }
      root.updateMatrixWorld(true);
      if (root.parent) {
        root.parent.getWorldPosition(viewP);
        grip.quaternion.multiplyQuaternions(easedQ, root.quaternion);
        grip.butt.copy(root.position).applyQuaternion(easedQ).add(viewP);
      } else {
        root.getWorldQuaternion(grip.quaternion);
        root.getWorldPosition(grip.butt);
      }
      grip.axis.set(0, 1, 0).applyQuaternion(grip.quaternion);
    },
  };
}
