/**
 * A hand working against a pull: what it does to the rod it holds. Three is used for its
 * maths only: no scene, no model.
 *
 * Owns: how far a working hand is drawn toward the pull, how the rod tips that way, how
 * it shakes, and how it rolls over when it is carried to one side of the pull.
 * Does not own: how hard the hand is working (gameplay says, and eases it:
 * src/play/strain.js), where the pull comes from or where the rod sits (rodHold.js hands
 * both in and lays what this returns on the pose), or how the blank bends (rodFlex.js).
 * Design: docs/ROD.md section 3.
 *
 * Everything here is one turn about the hand and one small shift of the hand, in the
 * view's space. Three things make up the turn, each scaled by the effort:
 *   the give    the rod is drawn round toward the side the pull is on. The pull turns
 *               the rod about the hand by as much as it is off to one side of the blank,
 *               and the wrist holds against it: the harder the pull, the more of the way
 *               round the rod goes. So against a fish pulling hard the rod cannot be swung
 *               far from it, and the same swing takes it nearly all the way once the fish
 *               eases. It comes on over a moment, so a quick twitch still gets through.
 *               Only round, never down: how high the rod is held stays the holder's, and
 *               that height is what the line bends the blank against.
 *   the shake   it trembles about two axes square to the blank.
 *   the lean    carried to one side of the pull, it is not swept there square. The wrist
 *               lays it over: it rolls about its own length toward the side it is
 *               carried to, and the reel swings out the other way.
 * With no effort there is nothing: the rod sits square and still.
 */

import * as THREE from 'three/webgpu';

// A hand working as hard as it can is drawn this far toward the pull, metres.
const GIVE_REACH = 0.045;
// The give. How strong the pull's turning of the rod is against the wrist holding it, at
// full effort: at 1 they are a match and the rod goes half way round to the pull's side.
// Larger and a pulling fish holds the rod nearer to its own side.
const GIVE_MOST = 3;
// A rod held nearer to straight up than this, as the level part of its unit direction,
// has less and less of a side to be drawn to.
const GIVE_UPRIGHT = 0.2;
// How fast the give follows, 1/s. Slower, and more of a quick movement of the rod gets
// through before it is drawn back.
const GIVE_RATE = 4;
// And it shakes: the rod turns about the hand by up to this much, degrees, at full
// effort. Small: at the tip it is a couple of centimetres. The shake is a few slow beats
// laid over each other, Hz, so it never repeats on a count.
const SHAKE = 0.42;
const SHAKE_HZ = [6.3, 8.9, 11.4];
const SHAKE_HZ_SIDE = [5.7, 9.6, 12.1];
// How fast the direction the hand gives in follows where the pull comes from, 1/s.
const PULL_RATE = 6;
// The lean: with the pull off to one side of the rod, the rod rolls about its own length
// toward the other side, the side it is being carried to. Up to LEAN_MOST degrees, most
// of it by the time the pull is LEAN_BY degrees to the side, and all of it once the hand
// is working at LEAN_EFFORT. A pull dead ahead, or an idle hand, and it sits square.
const LEAN_MOST = 28;
const LEAN_BY = 25;
const LEAN_EFFORT = 0.5;

// A few beats laid over each other, -1 to 1.
function beats(hz, t) {
  return (Math.sin(2 * Math.PI * hz[0] * t) + 0.7 * Math.sin(2 * Math.PI * hz[1] * t + 1.3) + 0.45 * Math.sin(2 * Math.PI * hz[2] * t + 2.1)) / 2.15;
}

export function createRodHand() {
  let effort = 0;
  let clock = 0;
  // The unit direction from the hand to where the pull comes from, eased. Kept when the
  // pull goes, for the effort to ease off along.
  const toward = new THREE.Vector3(0, -0.3, -1).normalize();
  const turn = new THREE.Quaternion();
  const shift = new THREE.Vector3();
  const axis = new THREE.Vector3();
  const up = new THREE.Vector3();
  const sideways = new THREE.Vector3();
  const part = new THREE.Quaternion();
  // The give as it stands, and where it is heading.
  const given = new THREE.Quaternion();
  const giveTo = new THREE.Quaternion();

  // The give: drawn round toward the side the pull is on, a turn about the view's upright.
  // Seen from above, the pull turns the rod by the sine of the angle it is off to the
  // side of it (nothing for a pull the rod points along), the wrist holds it back in
  // proportion to how far it has gone, and this is where the two settle. It never
  // carries the rod past the pull.
  // Drawn down toward the pull as well, the rod lost the angle the line bends it across:
  // run and rest came to within a degree of each other in the bend.
  function give(blank, dt) {
    const level = Math.hypot(blank.x, blank.z);
    const pullLevel = Math.hypot(toward.x, toward.z);
    const off = level > 1e-6 && pullLevel > 1e-6 ? (blank.z * toward.x - blank.x * toward.z) / (level * pullLevel) : 0;
    const strength = GIVE_MOST * effort;
    giveTo.setFromAxisAngle(up.set(0, 1, 0), off * Math.min(1, level / GIVE_UPRIGHT) * strength / (1 + strength));
    given.slerp(giveTo, 1 - Math.exp(-GIVE_RATE * dt));
    turn.copy(given);
  }

  // The shake, about two axes square to the blank.
  function shake(blank) {
    sideways.crossVectors(blank, up.set(0, 1, 0));
    if (sideways.lengthSq() < 1e-6) sideways.crossVectors(blank, up.set(1, 0, 0));
    sideways.normalize();
    const size = SHAKE * effort * Math.PI / 180;
    part.setFromAxisAngle(sideways, size * beats(SHAKE_HZ, clock));
    turn.premultiply(part);
    axis.crossVectors(blank, sideways).normalize();
    part.setFromAxisAngle(axis, size * beats(SHAKE_HZ_SIDE, clock));
    turn.premultiply(part);
  }

  // The lean. How far to the right of the rod the pull is, as a level angle in the view's
  // space, where right is +X and ahead is -Z. Pull to the right, rod carried to the left:
  // it rolls to the left, which about an axis pointing away is a negative turn.
  function lean(blank) {
    let off = Math.atan2(toward.x, -toward.z) - Math.atan2(blank.x, -blank.z);
    if (off > Math.PI) off -= 2 * Math.PI;
    else if (off < -Math.PI) off += 2 * Math.PI;
    const angle = LEAN_MOST * Math.tanh(off / (LEAN_BY * Math.PI / 180)) * Math.min(1, effort / LEAN_EFFORT);
    part.setFromAxisAngle(blank, -angle * Math.PI / 180);
    turn.multiply(part);
  }

  return {
    // What the hand adds to the rod's pose, in the view's space: a turn about the hand,
    // and a shift of the hand. Valid after step().
    turn,
    shift,

    // How hard the hand is working, 0 to 1. The caller eases it: it is laid straight
    // onto the pose, so a step in it is a step on screen.
    setStrain(value) {
      effort = Math.min(1, Math.max(0, value));
    },

    /**
     * Once a frame. blank: the unit direction the blank points before the hand's part,
     * in the view's space. from: the direction from the hand to where the pull comes
     * from, same space, any length, or null when nothing pulls. It is changed.
     */
    step(dt, blank, from) {
      clock += dt;
      if (from && from.lengthSq() > 1e-8) {
        from.normalize();
        toward.lerp(from, 1 - Math.exp(-PULL_RATE * dt));
        if (toward.lengthSq() > 1e-8) toward.normalize();
        else toward.copy(from);
      }
      give(blank, dt);
      // An idle hand whose give has gone: the rod sits square and still.
      if (!(effort > 0) && 1 - Math.abs(given.w) < 1e-12) {
        given.identity();
        turn.identity();
        shift.set(0, 0, 0);
        return;
      }
      shake(blank);
      shift.copy(toward).multiplyScalar(GIVE_REACH * effort);
      lean(blank);
    },
  };
}
