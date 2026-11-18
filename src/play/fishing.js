/**
 * One cast, from the lure held at the rod tip to the line wound back in or a fish netted.
 *
 * Owns: which stage the cast is in, what the finger means with no fish on, and telling
 * the materials: the line its far end and length, the lure where it is, the reel how
 * much was wound, the splash where the lure lands. It also says where the view should
 * look.
 * Does not own: anything a fish does. From the fish setting off to the net leaving is
 * catch.js, which this file drives and whose answer moves the stage on. Nor the sums:
 * how hard a swing is (swing.js), how fast line comes in (retrieve.js), how much line is
 * out (lineOut.js), how the lure moves (lureMove.js). Nor the rod, line, reel and lure
 * themselves, or the phone.
 * No Three: it only joins the layers above to the materials' openings.
 * Rules: docs/FISHING-REQUIREMENTS.md. Design: docs/PLAY.md.
 *
 * Stages:
 *   ready   line wound right in, lure held at the tip and riding with it: it does not
 *           swing. Finger down fixes the view, the swing is measured. Released in a
 *           forward swing, the lure flies. Released otherwise, nothing happens.
 *   flight  the lure is in the air and line follows it. Finger down stops the line and
 *           the lure drops where it is.
 *   water   the lure is in the water and the line comes straight. Finger down winds line
 *           in, once the finger has been up since landing. Finger up, the lure sinks.
 *           With all the line back in, the cast is over and the stage is ready again.
 *           Meanwhile a fish may come: when it takes the hook the stage is fight.
 *   fight   a fish is on. All of it is catch.js. When the fish is landed the stage is
 *           landed.
 *   landed  the fish is lifted and netted. All of it is catch.js. When the net has gone
 *           the stage is water again with the lure out of the water, and the rest of the
 *           line winds itself in.
 */

import { createLureMove } from '../shore/lureMove.js';
import { createCatch } from './catch.js';
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
 * rod, line, lure, splash: the materials. school: the fish, with fishes, take, giveBack,
 * mouth, hang and keep. Without one no fish ever comes. net: the landing net, with place
 * and hide, optional. haptics: impact, notification and playTransient, optional.
 * random: 0 to 1, for the times that are drawn.
 * Call begin() once after the line's first update. Then every frame, after the school has
 * moved: update() before the phone and the rod, and follow() after the line's update.
 */
export function createFishing({ rod, line, lure, splash, school = null, net = null, haptics = null, random = Math.random }) {
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
  // The level direction the cast went. A hooked fish is kept in front of it.
  let homeX = 0;
  let homeZ = 1;
  // water: the cast is over and the line winds itself in.
  let winding = false;
  // The fish's half of the cast. It is handed the lure's motion and the line out.
  const fish = createCatch({ rod, line, splash, school, net, haptics, random, move, out });

  function toReady() {
    stage = 'ready';
    winding = false;
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
    homeX = forwardX;
    homeZ = forwardZ;
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
    winding = false;
    fish.arm(homeX, homeZ);
    retrieve.reset();
    line.setTied(true);
  }

  // A fish has the hook. The empty retrieve stops: from here winding is against the fish.
  function toFight() {
    stage = 'fight';
    retrieve.reset();
  }

  // The net has carried the fish out of the picture, and that is the cast. The lure is
  // left on the line, which winds itself in.
  function toNetted(tip) {
    stage = 'water';
    lifted = true;
    armed = true;
    winding = true;
    retrieve.reset();
    out.ease(move.gap(tip));
    line.setTied(false);
    haptics?.impact('light');
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
    const taken = Math.min(retrieve.step(dt, winding || (input.finger && armed)), out.room);
    rod.reel.wind(taken);
    const pulled = out.wind(dt, taken, move.gap(tip));
    if (!lifted) {
      move.tow(dt, tip, out.length, pulled, line.stiffness);
      const level = Math.hypot(tip.x - move.x, tip.z - move.z);
      if (level < LIFT_WITHIN || out.stowed) {
        // From here it is a weight on the line again. A fish still on its way has
        // nothing left to come to.
        lifted = true;
        out.ease(move.gap(tip));
        line.setTied(false);
        fish.sendAway();
      }
    } else {
      move.hang(dt, tip, lastTip, out.length);
    }
    if (out.stowed) {
      toReady();
      return;
    }
    if (!lifted && fish.come(dt)) toFight();
  }

  // Tell the line and the lure where things are now.
  function show(dt, tip) {
    if (stage === 'ready') {
      // The line carries its end with the tip. follow() puts the lure there.
      line.stow(STOW_LENGTH);
      return;
    }
    line.setEnd(move.x, move.y, move.z);
    line.setLength(stage === 'landed' ? fish.liftLength() : out.length);
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
    // 'ready', 'flight', 'water', 'fight' or 'landed'.
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
      return stage === 'flight' || stage === 'fight' || (stage === 'water' && !lifted) ? spot : null;
    },
    // The fish, as catch.js reports it. fish: 'none', 'coming', 'on' or 'landed'. mood:
    // 'run' or 'rest' while it is being fought. tension and pull: the line's pull and the
    // fish's own, N. running: how fast line is going out, m/s. stamina: 1 fresh to 0.
    // landed: how many since the start.
    get fish() {
      return fish.fish;
    },
    get mood() {
      return fish.mood;
    },
    get tension() {
      return fish.tension;
    },
    get pull() {
      return fish.pull;
    },
    get running() {
      return fish.running;
    },
    get stamina() {
      return fish.stamina;
    },
    get landed() {
      return fish.landed;
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
     * Once a frame, after the school has moved and before the phone and the rod are, so
     * the view starts turning to the landing spot on the very frame the lure leaves, and a
     * lure in a fish's mouth is where the mouth is this frame. The tip is the one the line
     * drew last frame.
     * input.finger: the finger is down. input.sensor: the phone's motion is being read.
     * input.viewYaw: where the view looks, radians, positive to the left.
     * input.aimPitch: how high the phone aims the rod, degrees, positive upward.
     */
    update(dt, input) {
      if (!(dt > 0)) return;
      const tip = line.tip;
      if (stage === 'ready') ready(dt, input, tip);
      else if (stage === 'flight') flight(dt, input, tip);
      else if (stage === 'water') water(dt, input, tip);
      else if (stage === 'fight') {
        if (fish.fight(dt, input, tip, spot)) stage = 'landed';
      } else if (fish.land(dt, input, tip, lastTip)) toNetted(tip);
      fish.carry(dt);
      show(dt, tip);
      lastTip.x = tip.x; lastTip.y = tip.y; lastTip.z = tip.z;
    },

    // Once a frame, after the line's update.
    follow,
  };
}
