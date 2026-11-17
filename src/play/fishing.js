/**
 * One cast, from the lure hanging at the rod tip to the line wound back in.
 *
 * Owns: which stage the cast is in, what the finger means in each, how much line is out,
 * where the line's far end is, and when the view is locked.
 * Does not own: how the lure moves (lureMove.js), how fast line comes in (retrieve.js),
 * how a swing becomes a distance (swing.js), the rod, line, reel and lure themselves, or
 * the phone. Bites and the fight are not here yet.
 * No Three: it only wires the layers above to the materials' openings.
 * Rules: docs/FISHING-REQUIREMENTS.md sections 5 to 7. Design: docs/PLAY.md.
 *
 * Stages:
 *   ready   line wound right in, lure held at the tip and riding with it: it does not
 *           swing. Finger down fixes the view, the swing is measured. Released in a
 *           forward swing, the lure flies. Released otherwise, nothing happens.
 *   flight  the lure is in the air and line follows it. Finger down stops the line and
 *           the lure drops where it is.
 *   water   the lure is in the water on a straight line. Finger down winds line in, once
 *           the finger has been up since landing. Finger up, the lure stays. With all the
 *           line back in, the cast is over and the stage is ready again.
 */

import { createLureMove } from '../shore/lureMove.js';
import { createRetrieve } from './retrieve.js';
import { SWING_FULL, SWING_MIN, castReach, createSwing } from './swing.js';

// Line past the tip with the lure wound in, metres: the lure's nose sits just under the
// tip ring. The cast ends when the line is back to this.
const STOW_LENGTH = 0.025;
// Extra line in the air during the flight, as a share of the gap, so it bellies a little.
const FLIGHT_SPARE = 0.04;
// After the lure lands, how fast that belly is drawn out of the line, 1/s. The line
// straightens over about half a second instead of snapping straight.
const SETTLE_RATE = 5;
// Belly smaller than this is gone, metres.
const SETTLE_DONE = 0.002;
// Once the lure is this close to under the tip, level metres, the line lifts it out of
// the water and it hangs.
const LIFT_WITHIN = 1.6;
// How fast the lure's nose turns to follow the line, 1/s.
const NOSE_RATE = 10;
// In the water the nose lies nearer level than the line: this share of the line's slope.
const NOSE_LEVEL = 0.25;
// Desktop stand-in only, no motion sensor: holding this long counts as a full swing, s.
const DESK_FULL_HOLD = 1;

/**
 * rod, line, lure: the materials. lockLook(bool): hold the view still.
 * Call begin() once after the line's first update. Then every frame: update() first of
 * all, and follow() after the line's update.
 */
export function createFishing({ rod, line, lure, lockLook }) {
  const move = createLureMove();
  const retrieve = createRetrieve();
  const swing = createSwing();
  const lastTip = { x: 0, y: 0, z: 0 };
  const nose = { x: 0, y: 1, z: 0 };

  let stage = 'ready';
  let out = STOW_LENGTH;
  // ready: the finger has been up since the stage began, and is it down now.
  let fresh = true;
  let down = false;
  let heldFor = 0;
  // ready: how hard the rod is being swung now, and how hard at the last release, °/s.
  let swung = 0;
  let released = 0;
  // flight: the line has been stopped.
  let stopped = false;
  // water: the finger has been up since landing; the lure has left the water; how much
  // of the flight's belly is still in the line, metres.
  let armed = false;
  let lifted = false;
  let belly = 0;

  function toReady() {
    stage = 'ready';
    out = STOW_LENGTH;
    fresh = false;
    down = false;
    heldFor = 0;
    swing.reset();
    retrieve.reset();
    line.setTied(false);
    lockLook(false);
  }

  function ready(dt, input, tip) {
    const forwardX = Math.sin(input.viewYaw);
    const forwardZ = Math.cos(input.viewYaw);
    // Only what is swung with the finger down counts toward the cast.
    if (fresh && input.finger && !down) swing.reset();
    swung = swing.step(dt, input.aimPitch);
    if (!fresh) {
      if (!input.finger) fresh = true;
    } else if (input.finger) {
      down = true;
      heldFor += dt;
    } else if (down) {
      // Released. With a sensor the swing decides. Without one the hold time stands in.
      released = input.sensor
        ? swung
        : SWING_MIN + (SWING_FULL - SWING_MIN) * Math.min(1, heldFor / DESK_FULL_HOLD);
      const reach = castReach(released);
      down = false;
      heldFor = 0;
      if (reach > 0) {
        move.launch(reach, forwardX, forwardZ);
        stage = 'flight';
        stopped = false;
        lockLook(true);
        return;
      }
    }
    // Held at the tip, not hanging from it: a swing must not set it swinging.
    move.place(tip.x, tip.y - STOW_LENGTH, tip.z);
  }

  function flight(dt, input, tip) {
    if (input.finger) stopped = true;
    const landed = move.fly(dt, stopped);
    out = move.gap(tip) * (1 + FLIGHT_SPARE);
    if (!landed) return;
    // In the water the line comes straight by itself, quickly but not in one frame: the
    // belly it flew with is kept and drawn out in water(). This press, if any, is not a
    // retrieve.
    stage = 'water';
    belly = out - move.gap(tip);
    armed = !input.finger;
    lifted = false;
    retrieve.reset();
    line.setTied(true);
  }

  function water(dt, input, tip) {
    if (!input.finger) armed = true;
    const taken = Math.min(retrieve.step(dt, input.finger && armed), out - STOW_LENGTH);
    rod.reel.wind(taken);
    if (belly > 0) {
      // Still straightening. Winding takes belly out too, before it moves the lure.
      belly = belly * Math.exp(-SETTLE_RATE * dt) - taken;
      if (belly < SETTLE_DONE) belly = 0;
      out = Math.max(STOW_LENGTH, move.gap(tip) + belly);
    } else {
      out -= taken;
    }
    if (!lifted) {
      // While it straightens, the wind is spent on the belly and does not reach the lure.
      move.tow(dt, tip, out, belly > 0 ? 0 : taken, line.stiffness);
      const level = Math.hypot(tip.x - move.x, tip.z - move.z);
      if (level < LIFT_WITHIN || out <= STOW_LENGTH + 1e-6) {
        // From here it is a weight on the line again. Give back any stretch so it does
        // not snap inward.
        lifted = true;
        out = Math.max(out, move.gap(tip));
        line.setTied(false);
      }
    } else {
      move.hang(dt, tip, lastTip, out);
    }
    if (out <= STOW_LENGTH + 1e-6) toReady();
  }

  function show(dt, tip) {
    if (stage === 'ready') {
      // The line carries the end with the tip. follow() puts the lure there.
      line.stow(STOW_LENGTH);
      return;
    }
    line.setEnd(move.x, move.y, move.z);
    line.setLength(out);
    // The nose follows the line toward the tip, flatter while it swims.
    let tx = tip.x - move.x;
    let ty = tip.y - move.y;
    let tz = tip.z - move.z;
    if (stage === 'water' && !lifted) ty *= NOSE_LEVEL;
    const len = Math.hypot(tx, ty, tz) || 1;
    const k = 1 - Math.exp(-NOSE_RATE * dt);
    nose.x += (tx / len - nose.x) * k;
    nose.y += (ty / len - nose.y) * k;
    nose.z += (tz / len - nose.z) * k;
    lure.place(move.x, move.y, move.z, nose.x, nose.y, nose.z, move.swum);
  }

  return {
    // 'ready', 'flight' or 'water'.
    get stage() {
      return stage;
    },
    // Line out past the tip, metres.
    get lineOut() {
      return out;
    },
    // How fast the aim is tipping forward right now, and what the last release was read
    // at, degrees per second. For tuning the cast against a real hand.
    get swing() {
      return swung;
    },
    get lastRelease() {
      return released;
    },
    // Where the lure is and how it is moving. Read only.
    lure: move,

    // Once, after the line's first update: hang the lure under the tip.
    begin() {
      const tip = line.tip;
      move.place(tip.x, tip.y - STOW_LENGTH, tip.z);
      lastTip.x = tip.x; lastTip.y = tip.y; lastTip.z = tip.z;
      toReady();
      fresh = true;
      show(0, tip);
      this.follow();
    },

    // Once a frame, after the line's update. With the line wound in, the lure goes
    // exactly where this frame's tip is, nose up, so it never trails the rod.
    follow() {
      if (stage !== 'ready') return;
      const end = line.end;
      move.place(end.x, end.y, end.z);
      nose.x = 0; nose.y = 1; nose.z = 0;
      lure.place(end.x, end.y, end.z, 0, 1, 0, move.swum);
    },

    /**
     * Once a frame, before the phone and the rod are moved, so a view lock set here holds
     * from this very frame. The tip is the one the line drew last frame.
     * input.finger: the finger is down. input.sensor: the phone's motion is being read.
     * input.viewYaw: where the view looks, radians, positive to the left.
     * input.aimPitch: how high the phone aims the rod, degrees, positive upward.
     */
    update(dt, input) {
      if (!(dt > 0)) return;
      const tip = line.tip;
      if (stage === 'ready') ready(dt, input, tip);
      else if (stage === 'flight') flight(dt, input, tip);
      else water(dt, input, tip);
      show(dt, tip);
      lastTip.x = tip.x; lastTip.y = tip.y; lastTip.z = tip.z;
    },
  };
}
