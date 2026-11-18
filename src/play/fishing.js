/**
 * One cast, from the lure held at the rod tip to the line wound back in or a fish landed.
 *
 * Owns: which stage the cast is in, what the finger means in each, and telling the
 * materials: the line its far end and length, the lure where it is, the reel how much
 * was wound, the splash where the lure lands, the school which fish is taken and given
 * back. It also says where the view should look.
 * Does not own: how hard a swing is (swing.js), how fast line comes in (retrieve.js,
 * haul.js), how much line is out (lineOut.js), how the lure moves (lureMove.js), how a
 * fish comes to the lure (visit.js) or pulls once hooked (fight.js), the rod, line, reel,
 * lure and fish themselves, or the phone.
 * No Three: it only joins the layers above to the materials' openings.
 * Rules: docs/FISHING-REQUIREMENTS.md. Design: docs/PLAY.md.
 *
 * Stand-in: every fish that reaches the lure is hooked at once. The kinds of bite and
 * the strike are not made yet, and neither are the line breaking or running right out.
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
 *           After a while a fish leaves the school and swims to the lure. When its mouth
 *           reaches the hook it is on.
 *   fight   a fish is on. It runs and rests by itself, the lure rides in its mouth and
 *           the line ends there. A run that pulls harder than the reel holds takes line,
 *           finger down or not. Finger down winds line in when it can. Brought in close
 *           and no longer taking line, it is landed.
 *   landed  the fish hangs on the lure, out of the water, kicking. Finger down lifts it
 *           to just under the rod tip. There the landing net comes in under it, the fish
 *           comes off the hook and drops into the net, thrashes there a moment, and is
 *           carried out of the picture. That ends the cast: the rest of the line winds
 *           itself in and the stage is ready again.
 */

import { createLureMove } from '../shore/lureMove.js';
import { createFight } from './fight.js';
import { RUN_OUT_AT, createHaul } from './haul.js';
import { STOW_LENGTH, createLineOut } from './lineOut.js';
import { createRetrieve } from './retrieve.js';
import { createScoop } from './scoop.js';
import { SWING_FULL, SWING_MIN, castReach, createSwing } from './swing.js';
import { steerToLure, touching } from './visit.js';

// Once the lure is this close to under the tip, level metres, the line lifts it out of
// the water and it hangs.
const LIFT_WITHIN = 1.6;
// A lure hitting the water this fast makes the biggest splash, m/s. A stopped cast that
// just drops in makes a smaller one.
const SPLASH_FULL = 14;
// Desktop stand-in only, no motion sensor: holding this long counts as a full swing, s.
const DESK_FULL_HOLD = 1;
// A fish sets off for the lure between these many seconds after it lands.
const COME_AFTER = [1.5, 4];
// A hooked fish this close to under the tip, level metres, is landed.
const LAND_WITHIN = 2.2;
// A landed fish is lifted until this much line is left, m, and hangs there this long, s,
// before the net is called in.
const SHOW_LENGTH = 0.6;
const SHOW_FOR = 0.6;
// A hung fish kicks harder for a moment when something sets it off. How much harder as
// it breaks the surface and as it lands in the net, on top of 1, and how fast that
// dies away, 1/s.
const KICK_SURFACE = 1.3;
const KICK_NET = 2.2;
const KICK_FADE = 1.6;
// In the net it goes on kicking in fits: another one this often, s, each this strong.
const FIT_EVERY = [0.35, 0.8];
const FIT_KICK = 1.4;
// The splash it makes breaking the surface, 0 to 1.
const BREAK_SPLASH = 0.45;
// The net comes from the angler's free side: this far back toward the angler for every
// metre to the left.
const NET_NEARER = 0.45;
// What a landed fish weighs on the rod tip once it is out of the water, kg. Not its real
// weight: the blank is light, and this much already bends it deep.
const FISH_LOAD = 0.05;
// Still in the water it weighs this share of that. The weight comes on as the hook rises
// from DRY_FROM to DRY_BY, metres: the fish has some length and leaves the water bit by bit.
const SUNK_SHARE = 0.25;
const DRY_FROM = -0.3;
const DRY_BY = 0.25;
// How fast the weight on the tip follows, 1/s, and the step it is given to the rod in, kg.
const LOAD_RATE = 6;
const LOAD_STEP = 0.001;
// The lift is wound as slowly as line against this much tension, N.
const LIFT_AS = 3.2;
// Once landed the fish stops pulling. How fast the stretch it had put in the line goes, 1/s:
// the rod eases straight, it does not spring.
const SLACKEN_RATE = 4;
const SLACKEN_DONE = 0.002;
// The most line a fish can take, m. With this much out the reel gives no more.
const SPOOL = 70;
// A fresh fish bolting near the top boils the water: a splash where it is, this strong at
// full stamina, and none once its stamina is below BOIL_ABOVE or it is deeper than
// BOIL_WITHIN, m.
const BOIL_SPLASH = 0.7;
const BOIL_ABOVE = 0.2;
const BOIL_WITHIN = -1;
// The reel clicks in the hand: once for every this much line a fish takes, and for every
// this much wound in against one, m.
const CLICK_OUT = 0.09;
const CLICK_IN = 0.3;
// While a fish is on, the point the view watches follows it at this rate, 1/s. Low, so
// the view drifts after the fish and does not swing with every turn it makes.
const WATCH_FOLLOW = 1.2;

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
  const haul = createHaul();
  const fight = createFight(random);
  const scoop = createScoop();
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
  // The level direction the cast went, for keeping a hooked fish in front.
  let homeX = 0;
  let homeZ = 1;
  // water: seconds until a fish sets off, and the fish on its way. fight: the fish on the
  // line. Never both.
  let comeIn = 0;
  let visitor = null;
  let hooked = null;
  // The mouth of that fish this frame, and for its brain, which runs at another time.
  const mouth = { x: 0, y: 0, z: 0 };
  const brainMouth = { x: 0, y: 0, z: 0 };
  // fight: the line's pull, N, as the line reported it this frame, and how much further
  // the hook is from the tip than there is line out, m.
  let tension = 0;
  let stretch = 0;
  // fight: how fast line is running out, m/s, and line taken and wound since the last click.
  let running = 0;
  let clickOut = 0;
  let clickIn = 0;
  // fight: line wound in last frame, for the fish's stamina, and whether it was in a run.
  let wound = 0;
  let bolting = false;
  // landed: seconds the fish has still to hang before the net comes.
  let showLeft = 0;
  // landed: how much harder than usual the fish is kicking, whether it has broken the
  // surface yet, and seconds until its next fit in the net.
  let kick = 0;
  let broke = false;
  let fitIn = 0;
  // water: the cast is over and the line winds itself in.
  let winding = false;
  // landed: what is left of the stretch the fight had put in the line, m.
  let strain = 0;
  // The weight riding on the rod tip, kg: what it should be, what it is, and what the rod
  // was last told.
  let loadAim = 0;
  let loadNow = 0;
  let loadTold = 0;

  // The rod is told the weight in small steps, as it comes on and goes off.
  function carry(dt) {
    loadNow += (loadAim - loadNow) * (1 - Math.exp(-LOAD_RATE * dt));
    const step = Math.round(loadNow / LOAD_STEP) * LOAD_STEP;
    if (step === loadTold) return;
    loadTold = step;
    rod.setTipLoad(step);
  }
  // Fish landed since the start.
  let landed = 0;

  // The fish on its way reads the lure, the hooked one the line. Both only write an aim.
  const comeBrain = (fish, aim) => {
    school.mouth(fish, brainMouth);
    steerToLure(fish, aim, brainMouth, move, Math.hypot(move.vx, move.vz));
  };
  const fightBrain = (fish, aim) => {
    fight.steer(fish, aim, line.tip, stretch, line.stiffness, haul.speed, RUN_OUT_AT, homeX, homeZ);
  };

  // The fish in the school nearest the lure. Fish someone has taken are left alone.
  function nearestFish() {
    let best = null;
    let bestGap = Infinity;
    for (const fish of school.fishes) {
      if (fish.state !== 'school' && fish.state !== 'stray') continue;
      const gap = Math.hypot(fish.x - move.x, fish.z - move.z);
      if (gap < bestGap) {
        best = fish;
        bestGap = gap;
      }
    }
    return best;
  }

  // The fish that was coming goes home.
  function sendAway() {
    if (!visitor) return;
    school.giveBack(visitor);
    visitor = null;
  }

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
    comeIn = COME_AFTER[0] + random() * (COME_AFTER[1] - COME_AFTER[0]);
    retrieve.reset();
    line.setTied(true);
  }

  // The fish that came has the hook. Stand-in: always, and without a strike. It runs at
  // once and the weight comes onto the rod. A finger already down is winding against it.
  function toFight() {
    stage = 'fight';
    hooked = visitor;
    visitor = null;
    tension = 0;
    stretch = 0;
    running = 0;
    clickOut = 0;
    clickIn = 0;
    wound = 0;
    bolting = false;
    fight.begin();
    haul.reset();
    retrieve.reset();
    school.take(hooked, fightBrain);
    haptics?.impact('heavy');
  }

  // Brought in close. From here the fish is a weight on the lure, and the lure a weight
  // on the line: it hangs, and winding lifts it out of the water.
  function toLanded(tip) {
    stage = 'landed';
    landed += 1;
    tension = 0;
    running = 0;
    showLeft = SHOW_FOR;
    kick = 0;
    broke = false;
    haul.reset();
    // Its weight is on the rod tip from here, not on the line. The stretch the line has
    // now is let go over the next moments.
    strain = Math.max(0, stretch);
    out.ease(move.gap(tip));
    haptics?.notification('success');
  }

  // The net has carried the fish out of the picture, and that is the cast. The fish goes
  // back to the school unseen. The lure is left on the line, which winds itself in.
  function toNetted(tip) {
    stage = 'water';
    school.keep(hooked);
    hooked = null;
    net?.hide();
    strain = 0;
    loadAim = 0;
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
        sendAway();
      }
    } else {
      move.hang(dt, tip, lastTip, out.length);
    }
    if (out.stowed) {
      toReady();
      return;
    }
    if (!lifted && school) comeToLure(dt);
  }

  // After a while the nearest fish sets off for the lure. When its mouth is on the hook,
  // it is on.
  function comeToLure(dt) {
    if (!visitor) {
      comeIn -= dt;
      if (comeIn > 0) return;
      visitor = nearestFish();
      if (!visitor) return;
      school.take(visitor, comeBrain);
    }
    school.mouth(visitor, mouth);
    if (touching(mouth, move)) toFight();
  }

  function fighting(dt, input, tip) {
    fight.step(dt, wound);
    school.mouth(hooked, mouth);
    // It bolts: the water boils where it was lying.
    if (fight.running && !bolting && fight.stamina > BOIL_ABOVE && mouth.y > BOIL_WITHIN) {
      splash.burst(mouth.x, mouth.z, BOIL_SPLASH * fight.stamina);
    }
    bolting = fight.running;
    tension = line.tension;
    const taken = Math.min(haul.step(dt, input.finger, tension), out.room);
    rod.reel.wind(taken);
    wound = taken;
    // The lure rides in its mouth, and the line ends there.
    move.place(mouth.x, mouth.y, mouth.z);
    const gap = move.gap(tip);
    out.wind(dt, taken, gap);
    // Pulling harder than the reel holds, it takes line, finger down or not.
    const given = Math.min(haul.slip(gap - out.length, line.stiffness), Math.max(0, SPOOL - out.length));
    out.pay(given);
    running = given / dt;
    stretch = gap - out.length;
    click(given, taken);
    // The view drifts after it, along the water.
    const k = 1 - Math.exp(-WATCH_FOLLOW * dt);
    spot.x += (mouth.x - spot.x) * k;
    spot.z += (mouth.z - spot.z) * k;
    // In close and no longer strong enough to take line: landed.
    if (fight.force < RUN_OUT_AT && Math.hypot(tip.x - mouth.x, tip.z - mouth.z) < LAND_WITHIN) toLanded(tip);
  }

  // The reel in the hand: a sharp click for every bit of line the fish takes, a duller
  // one for every bit wound in against it, harder the tighter the line.
  function click(given, taken) {
    if (!haptics) return;
    clickOut += given;
    clickIn += taken;
    const load = Math.min(1, tension / RUN_OUT_AT);
    if (clickOut >= CLICK_OUT) {
      clickOut %= CLICK_OUT;
      clickIn = 0;
      haptics.playTransient(0.75, 0.9);
    } else if (clickIn >= CLICK_IN) {
      clickIn %= CLICK_IN;
      haptics.playTransient(0.25 + 0.5 * load, 0.3);
    }
  }

  // The fish hangs on the lure. Winding lifts it to just under the tip. Then the net
  // comes in under it, it drops in, and the net carries it away.
  function landedStage(dt, input, tip) {
    kick *= Math.exp(-KICK_FADE * dt);
    const room = Math.max(0, out.length - SHOW_LENGTH);
    const taken = scoop.dropped ? 0 : Math.min(haul.step(dt, input.finger, LIFT_AS), room);
    rod.reel.wind(taken);
    out.wind(dt, taken, move.gap(tip));
    move.hang(dt, tip, lastTip, out.length);
    if (strain > 0) {
      strain *= Math.exp(-SLACKEN_RATE * dt);
      if (strain < SLACKEN_DONE) {
        strain = 0;
        line.setTied(false);
      }
    }
    if (scoop.dropped) {
      inNet(dt, tip);
      return;
    }
    const dry = Math.min(1, Math.max(0, (move.y - DRY_FROM) / (DRY_BY - DRY_FROM)));
    loadAim = FISH_LOAD * (SUNK_SHARE + (1 - SUNK_SHARE) * dry * dry * (3 - 2 * dry));
    // Half out of the water: it feels the air and kicks, and the water breaks round it.
    if (!broke && dry > 0.5) {
      broke = true;
      kick = KICK_SURFACE;
      splash.burst(move.x, move.z, BREAK_SPLASH);
      haptics?.impact('medium');
    }
    // Its mouth is on the lure, its body hangs from there along the line.
    school.hang(hooked, move.x, move.y, move.z, tip.x, tip.y, tip.z, dt, 1 + kick);
    if (scoop.phase === 'away') {
      if (room > 1e-3) return;
      showLeft -= dt;
      if (showLeft > 0) return;
      // From the left of the view and a little nearer: the hand that is not on the rod.
      // Yaw is positive to the left, so left of (sin, cos) is (cos, -sin).
      const leftX = Math.cos(input.viewYaw) - Math.sin(input.viewYaw) * NET_NEARER;
      const leftZ = -Math.sin(input.viewYaw) - Math.cos(input.viewYaw) * NET_NEARER;
      const far = Math.hypot(leftX, leftZ);
      scoop.begin(move.x, move.y, move.z, leftX / far, leftZ / far);
    } else {
      scoop.step(dt, move.x, move.y, move.z);
      // Off the hook this frame: the lure is a bare weight on the line again.
      if (scoop.dropped) loadAim = 0;
    }
    net?.place(scoop.x, scoop.y, scoop.z, scoop.handleX, scoop.handleZ, scoop.stretch, scoop.rock);
  }

  // Off the hook: the fish falls into the net, lies there kicking, and goes where the
  // net goes. The lure stays on the line.
  function inNet(dt, tip) {
    const gone = scoop.step(dt, move.x, move.y, move.z);
    loadAim = 0;
    if (scoop.landing) {
      kick = KICK_NET;
      fitIn = FIT_EVERY[0] + random() * (FIT_EVERY[1] - FIT_EVERY[0]);
      haptics?.impact('medium');
    } else if (scoop.caught) {
      fitIn -= dt;
      if (fitIn <= 0) {
        kick = Math.max(kick, FIT_KICK);
        fitIn = FIT_EVERY[0] + random() * (FIT_EVERY[1] - FIT_EVERY[0]);
        haptics?.playTransient(0.4, 0.2);
      }
    }
    // Head up in the bag, as it fell.
    school.hang(hooked, scoop.fishX, scoop.fishY, scoop.fishZ, scoop.fishX, scoop.fishY + 1, scoop.fishZ, dt, 1 + kick);
    net?.place(scoop.x, scoop.y, scoop.z, scoop.handleX, scoop.handleZ, scoop.stretch, scoop.rock);
    if (gone) toNetted(tip);
  }

  // Tell the line and the lure where things are now.
  function show(dt, tip) {
    if (stage === 'ready') {
      // The line carries its end with the tip. follow() puts the lure there.
      line.stow(STOW_LENGTH);
      return;
    }
    line.setEnd(move.x, move.y, move.z);
    line.setLength(stage === 'landed' ? Math.max(STOW_LENGTH, out.length - strain) : out.length);
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
    // 'none', 'coming' while one swims to the lure, 'on' while one is hooked, 'landed'
    // while it hangs on the line.
    get fish() {
      return hooked ? (stage === 'landed' ? 'landed' : 'on') : visitor ? 'coming' : 'none';
    },
    // How fast line is running out to the fish, m/s, and how fresh the fish is, 1 to 0.
    get running() {
      return stage === 'fight' ? running : 0;
    },
    get stamina() {
      return hooked ? fight.stamina : 0;
    },
    // 'run' while a hooked fish is bolting, 'rest' while it sulks, '' with none on.
    get mood() {
      return stage === 'fight' ? (fight.running ? 'run' : 'rest') : '';
    },
    // The line's pull while a fish is on, and how hard the fish itself is pulling, N.
    get tension() {
      return tension;
    },
    get pull() {
      return hooked ? fight.force : 0;
    },
    // Fish landed since the start.
    get landed() {
      return landed;
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
      else if (stage === 'fight') fighting(dt, input, tip);
      else landedStage(dt, input, tip);
      carry(dt);
      show(dt, tip);
      lastTip.x = tip.x; lastTip.y = tip.y; lastTip.z = tip.z;
    },

    // Once a frame, after the line's update.
    follow,
  };
}
