/**
 * One cast, from the lure held at the rod tip to the line wound back in.
 *
 * Owns: which stage the cast is in, what the finger means in each, and telling the
 * materials: the line its far end and length, the lure where it is, the reel how much
 * was wound, the splash where the lure lands. It also says where the view should look.
 * Does not own: how hard a swing is (swing.js), how fast line comes in (retrieve.js), how
 * much line is out (lineOut.js), how the lure moves (lureMove.js), the rod, line, reel
 * and lure themselves, or the phone. Bites and the fight are not here yet.
 * No Three: it only joins the layers above to the materials' openings.
 * Rules: docs/FISHING-REQUIREMENTS.md sections 5 to 7. Design: docs/PLAY.md.
 *
 * Stages:
 *   ready   line wound right in, lure held at the tip and riding with it: it does not
 *           swing. Finger down fixes the view, the swing is measured. Released in a
 *           forward swing, the lure flies. Released otherwise, nothing happens.
 *   flight  the lure is in the air and line follows it. Finger down stops the line and
 *           the lure drops where it is.
 *   water   the lure is in the water and the line comes straight. Finger down winds line
 *           in, once the finger has been up since landing. Finger up, the lure stays.
 *           With all the line back in, the cast is over and the stage is ready again.
 */

import { createLureMove } from '../shore/lureMove.js';
import { STOW_LENGTH, createLineOut } from './lineOut.js';
import { createRetrieve } from './retrieve.js';
import { SWING_FULL, SWING_MIN, castReach, createSwing } from './swing.js';

// Once the lure is this close to under the tip, level metres, the line lifts it out of
// the water and it hangs.
const LIFT_WITHIN = 1.6;
// A lure hitting the water this fast makes the biggest splash, m/s. A stopped cast that
// just drops in makes a smaller one.
const SPLASH_FULL = 14;
// Desktop stand-in only, no motion sensor: holding this long counts as a full swing, s.
const DESK_FULL_HOLD = 1;

/**
 * rod, line, lure, splash: the materials.
 * Call begin() once after the line's first update. Then every frame: update() first of
 * all, and follow() after the line's update.
 */
export function createFishing({ rod, line, lure, splash }) {
  const move = createLureMove();
  const out = createLineOut();
  const retrieve = createRetrieve();
  const swing = createSwing();
  const lastTip = { x: 0, y: 0, z: 0 };
  // Where the view should look while the lure is out: the water where it lands.
  const spot = { x: 0, y: 0, z: 0 };

  let stage = 'ready';
  // ready: the finger has been up since the stage began, it is down now, and for how long.
  let fresh = true;
  let down = false;
  let heldFor = 0;
  // ready: how fast the aim is tipping forward now, and at the last release, °/s.
  let swung = 0;
  let released = 0;
  // flight: the line has been stopped.
  let stopped = false;
  // water: the finger has been up since landing, and the lure has left the water.
  let armed = false;
  let lifted = false;

  function toReady() {
    stage = 'ready';
    out.stow();
    fresh = false;
    down = false;
    heldFor = 0;
    swing.reset();
    retrieve.reset();
    line.setTied(false);
  }

  function toFlight(reach, forwardX, forwardZ) {
    stage = 'flight';
    stopped = false;
    // The view goes straight to where the lure is going to land and stays there. It does
    // not follow the lure up and over.
    spot.x = move.x + forwardX * reach;
    spot.y = 0;
    spot.z = move.z + forwardZ * reach;
    move.launch(reach, forwardX, forwardZ);
  }

  // The line comes straight by itself from here, quickly but not in one frame. A press
  // carried over from the flight is not a retrieve.
  function toWater(input, tip) {
    stage = 'water';
    // Where it really came down: the same place, unless the line was stopped short.
    spot.x = move.x;
    spot.z = move.z;
    splash.burst(move.x, move.z, move.impact / SPLASH_FULL);
    out.land(move.gap(tip));
    armed = !input.finger;
    lifted = false;
    retrieve.reset();
    line.setTied(true);
  }

  function ready(dt, input, tip) {
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
        toFlight(reach, Math.sin(input.viewYaw), Math.cos(input.viewYaw));
        return;
      }
    }
    // Held at the tip, not hanging from it: a swing must not set it swinging. This is the
    // tip of last frame, good enough to launch from. follow() puts it on this frame's.
    move.hold(tip.x, tip.y - STOW_LENGTH, tip.z);
  }

  function flight(dt, input, tip) {
    if (input.finger) stopped = true;
    const landed = move.fly(dt, stopped);
    out.fly(move.gap(tip));
    if (landed) toWater(input, tip);
  }

  function water(dt, input, tip) {
    if (!input.finger) armed = true;
    const taken = Math.min(retrieve.step(dt, input.finger && armed), out.room);
    rod.reel.wind(taken);
    const pulled = out.wind(dt, taken, move.gap(tip));
    if (!lifted) {
      move.tow(dt, tip, out.length, pulled, line.stiffness);
      const level = Math.hypot(tip.x - move.x, tip.z - move.z);
      if (level < LIFT_WITHIN || out.stowed) {
        // From here it is a weight on the line again.
        lifted = true;
        out.ease(move.gap(tip));
        line.setTied(false);
      }
    } else {
      move.hang(dt, tip, lastTip, out.length);
    }
    if (out.stowed) toReady();
  }

  // Tell the line and the lure where things are now.
  function show(dt, tip) {
    if (stage === 'ready') {
      // The line carries its end with the tip. follow() puts the lure there.
      line.stow(STOW_LENGTH);
      return;
    }
    line.setEnd(move.x, move.y, move.z);
    line.setLength(out.length);
    move.point(dt, tip, stage === 'water' && !lifted);
    lure.place(move.x, move.y, move.z, move.nose.x, move.nose.y, move.nose.z, move.swum);
  }

  // With the line wound in, the lure goes exactly where this frame's tip is, so it never
  // trails the rod.
  function follow() {
    if (stage !== 'ready') return;
    const end = line.end;
    move.hold(end.x, end.y, end.z);
    lure.place(end.x, end.y, end.z, move.nose.x, move.nose.y, move.nose.z, move.swum);
  }

  return {
    // 'ready', 'flight' or 'water'.
    get stage() {
      return stage;
    },
    // Line out past the tip, metres.
    get lineOut() {
      return out.length;
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
    // Where the view should look: the water where the lure lands, from the moment it
    // leaves the tip until the line lifts it out again. A fixed point, not the lure: the
    // view turns there once and rests. null the rest of the time, when the view is the
    // phone's. An object with x, y, z, world space.
    get watch() {
      return stage === 'flight' || (stage === 'water' && !lifted) ? spot : null;
    },

    // Once, after the line's first update: the lure at the tip, line in.
    begin() {
      const tip = line.tip;
      move.hold(tip.x, tip.y - STOW_LENGTH, tip.z);
      lastTip.x = tip.x; lastTip.y = tip.y; lastTip.z = tip.z;
      toReady();
      fresh = true;
      show(0, tip);
      follow();
    },

    /**
     * Once a frame, before the phone and the rod are moved, so the view starts turning to
     * the landing spot on the very frame the lure leaves. The tip is the one the line drew last frame.
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

    // Once a frame, after the line's update.
    follow,
  };
}
