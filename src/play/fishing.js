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
 *           in, once the finger has been up since landing. Finger up, the lure sinks
 *           straight down and line follows it.
 *           With all the line back in, the cast is over and the stage is ready again.
 *           Meanwhile a fish may come: when it takes the hook the stage is fight.
 *   fight   a fish is on. All of it is catch.js. When the fish is landed the stage is
 *           landed. When the line breaks, or the fish takes all of it, the stage is water
 *           again with a bare line: no lure on it, no fish comes to it, and winding it
 *           all back in ends the cast.
 *   landed  the fish is lifted and netted. All of it is catch.js. When the net has gone
 *           the stage is water again with the lure out of the water, and the rest of the
 *           line winds itself in.
 */

import { createLureMove } from '../shore/lureMove.js';
import { FISH_READOUT, createCatch } from './catch.js';
import { STOW_LENGTH, createLineOut } from './lineOut.js';
import { createLooseLine } from './looseLine.js';
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
  // The line while nothing winds it: what it gives to a jerk, how it follows a sinking
  // lure, how slack it lies.
  const loose = createLooseLine();
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
  // water: the line is bare. The fish broke it or took all of it, and the lure went too.
  let bare = false;
  // How the last fish was lost in this cast: '', 'broke' or 'spooled'.
  let lost = '';
  // The fish's half of the cast. It is handed the lure's motion and the line out.
  const fish = createCatch({ rod, line, splash, school, net, haptics, random, move, out });

  function toReady() {
    stage = 'ready';
    winding = false;
    // A new lure is tied on for the next cast.
    bare = false;
    lost = '';
    lure.show(true);
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

  // The fish is gone and the lure with it. What is out is bare line, lying where the fish
  // was, and the cast is not over until the angler has wound it all back in. A finger
  // that was down when it went is not a retrieve.
  function toBare(why, input, tip) {
    stage = 'water';
    bare = true;
    lost = why;
    lifted = false;
    armed = !input.finger;
    winding = false;
    retrieve.reset();
    out.ease(move.gap(tip));
    line.setTied(false);
    lure.show(false);
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
    move.upright(dt);
  }

  function flight(dt, input, tip) {
    if (input.finger) stopped = true;
    const landed = move.fly(dt, stopped);
    out.fly(move.gap(tip));
    if (landed) toWater(input, tip);
  }

  function water(dt, input, tip) {
    if (!input.finger) armed = true;
    const reeling = winding || (input.finger && armed);
    const taken = Math.min(retrieve.step(dt, reeling), out.room);
    rod.reel.wind(taken);
    const pulled = out.wind(dt, taken, move.gap(tip));
    if (!lifted) {
      // Finger up, the bail is open and the line is loose: only winding would bring the
      // lure in. A jerk of the rod is taken up by the line, and what reaches the lure is
      // a dart and a shiver. Then line follows the lure down and it sinks where it is.
      // Finger down, the line is held: a jerk hauls the lure, and sinking swings it in.
      if (reeling) loose.takenUp(dt);
      else move.flutter(loose.drawn(dt, move.gap(tip) - out.length));
      move.tow(dt, tip, out.length + loose.give, pulled, line.stiffness);
      if (!reeling) out.pay(loose.follows(move.gap(tip) - out.length, move.sank));
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
    if (!lifted && !bare && fish.come(dt)) toFight();
  }

  // Tell the line and the lure where things are now.
  function show(dt, tip) {
    if (stage === 'ready') {
      // The line carries its end with the tip. follow() puts the lure there.
      line.stow(STOW_LENGTH);
      return;
    }
    // Only a lure in the water with nothing on it has a loose line. A fish, or the lure
    // leaving the water, takes it up.
    if (stage !== 'water' || lifted) loose.takenUp(dt);
    line.setEnd(move.x, move.y, move.z);
    // In a fight a shake of the fish's head snatches the line: it is that much shorter
    // for the moment, and the rod tip nods to it.
    // In the water with the finger up, a rod drawn away finds the line giving: it lies
    // that much longer for the moment.
    line.setLength(stage === 'landed' ? fish.liftLength()
      : stage === 'fight' ? out.length - fish.snatch
        : stage === 'water' ? out.length + loose.give : out.length);
    move.point(dt, tip, stage === 'water' && !lifted);
    lure.place(move.x, move.y, move.z, move.nose.x, move.nose.y, move.nose.z, move.swum, move.back.x, move.back.y, move.back.z);
  }

  // With the line wound in, the lure goes exactly where this frame's tip is, so it never
  // trails the rod.
  function follow() {
    if (stage !== 'ready') return;
    const end = line.end;
    move.hold(end.x, end.y, end.z);
    lure.place(end.x, end.y, end.z, move.nose.x, move.nose.y, move.nose.z, move.swum, move.back.x, move.back.y, move.back.z);
  }

  const cast = {
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
    // Whether the view should keep the rod in the picture while it watches. With a fish
    // on, the rod is what the hand is working: lose sight of it and the phone and the
    // picture no longer agree. After a cast the phone may be anywhere, and the view
    // goes to the water wherever the rod is.
    get watchRod() {
      return stage === 'fight';
    },
    // How this cast lost its fish, until the line is back in: '' not at all, 'broke' the
    // line parted, 'spooled' the fish took all of it.
    get lost() {
      return lost;
    },

    // Once, after the line's first update: the lure at the tip, line in.
    begin() {
      const tip = line.tip;
      move.hold(tip.x, tip.y - STOW_LENGTH, tip.z);
      move.upright(0);
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
        const ended = fish.fight(dt, input, tip, spot);
        if (ended === 'landed') stage = 'landed';
        else if (ended) toBare(ended, input, tip);
      } else if (fish.land(dt, input, tip, lastTip)) toNetted(tip);
      fish.carry(dt);
      show(dt, tip);
      lastTip.x = tip.x; lastTip.y = tip.y; lastTip.z = tip.z;
    },

    // Once a frame, after the line's update.
    follow,
  };
  // The fish, exactly as catch.js reports it: fish, mood, size, big, tension, pull, press,
  // effort, running, stamina and landed. Their meanings are written there, once.
  for (const name of FISH_READOUT) Object.defineProperty(cast, name, { get: () => fish[name], enumerable: true });
  return cast;
}
