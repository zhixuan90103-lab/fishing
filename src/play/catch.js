/**
 * The fish's half of a cast: one comes to the lure, takes it, is fought, lifted out and
 * netted.
 *
 * Owns: which fish comes and when, when it is hooked, what a fight does to the line each
 * frame, when it counts as landed, the lift, calling the net, and telling the materials:
 * the school which fish is taken, hung and kept, the reel what was wound, the rod what
 * hangs on its tip, the net where it is, the splash and the haptics.
 * Does not own: the stage of the cast or what the finger means before a fish is on
 * (fishing.js), the lure's own motion and the line's length (it is handed both), or any
 * of the sums: how a fish comes (visit.js), pulls (fight.js) and kicks (kick.js), how
 * line comes in and runs out (haul.js), the reel's clicks (reelClick.js), the weight on
 * the tip (tipWeight.js), the net's path (scoop.js).
 * No Three: like fishing.js it only joins those to the materials' openings.
 * Rules: docs/FISHING-REQUIREMENTS.md sections 8 to 13. Design: docs/PLAY.md.
 *
 * Stand-in: every fish that reaches the lure is hooked at once. The kinds of bite and
 * the strike are not made yet, and neither are the line breaking or running right out.
 *
 * fishing.js drives it: arm() when the lure lands, then one of come(), fight() or land()
 * each frame, by stage. Each returns true on the frame its part is over.
 */

import { createFight } from './fight.js';
import { RUN_OUT_AT, createHaul } from './haul.js';
import { createKick } from './kick.js';
import { STOW_LENGTH } from './lineOut.js';
import { createReelClick } from './reelClick.js';
import { createScoop } from './scoop.js';
import { createTipWeight, dryness } from './tipWeight.js';
import { steerToLure, touching } from './visit.js';

// A fish sets off for the lure between these many seconds after it lands.
const COME_AFTER = [1.5, 4];
// The most line a fish can take, m. With this much out the reel gives no more.
const SPOOL = 70;
// A fresh fish bolting near the top boils the water: a splash where it is, this strong at
// full stamina, and none once its stamina is below BOIL_ABOVE or it is deeper than
// BOIL_WITHIN, m.
const BOIL_SPLASH = 0.7;
const BOIL_ABOVE = 0.2;
const BOIL_WITHIN = -1;
// While a fish is on, the point the view watches follows it at this rate, 1/s. Low, so
// the view drifts after the fish and does not swing with every turn it makes.
const WATCH_FOLLOW = 1.2;
// A hooked fish this close to under the tip, level metres, is landed.
const LAND_WITHIN = 2.2;
// Once landed the fish stops pulling. How fast the stretch it had put in the line goes, 1/s:
// the rod eases straight, it does not spring.
const SLACKEN_RATE = 4;
const SLACKEN_DONE = 0.002;
// A landed fish is lifted until this much line is left, m, and hangs there this long, s,
// before the net is called in.
const SHOW_LENGTH = 0.6;
const SHOW_FOR = 0.6;
// The lift is wound as slowly as line against this much tension, N.
const LIFT_AS = 3.2;
// The splash it makes breaking the surface, 0 to 1.
const BREAK_SPLASH = 0.45;
// The net comes from the angler's free side: this far back toward the angler for every
// metre to the left.
const NET_NEARER = 0.45;

/**
 * rod, line, splash: the materials. school: the fish, with fishes, take, giveBack, mouth,
 * hang and keep. Without one no fish ever comes. net: the landing net, with place and
 * hide, optional. haptics: impact, notification and playTransient, optional.
 * random: 0 to 1, for the times that are drawn.
 * move: the lure's motion. out: the line out. Both are fishing.js's, shared: while a
 * fish is on, this file says where the lure is and how long the line.
 */
export function createCatch({ rod, line, splash, school, net, haptics, random, move, out }) {
  const haul = createHaul();
  const fight = createFight(random);
  const scoop = createScoop();
  const click = createReelClick();
  const weight = createTipWeight();
  const kick = createKick(random);

  // The level direction the cast went, for keeping a hooked fish in front.
  let homeX = 0;
  let homeZ = 1;
  // Seconds until a fish sets off, the fish on its way, and the fish on the line. Never
  // both of the last two.
  let comeIn = 0;
  let visitor = null;
  let hooked = null;
  // The hooked fish hangs on the line, out of the fight.
  let hung = false;
  // The mouth of that fish this frame, and for its brain, which runs at another time.
  const mouth = { x: 0, y: 0, z: 0 };
  const brainMouth = { x: 0, y: 0, z: 0 };
  // Fighting: the line's pull, N, as the line reported it this frame, and how much
  // further the hook is from the tip than there is line out, m.
  let tension = 0;
  let stretch = 0;
  // Fighting: how fast line is running out, m/s, the line wound in last frame, for the
  // fish's stamina, and whether it was in a run.
  let running = 0;
  let wound = 0;
  let bolting = false;
  // Lifting: seconds the fish has still to hang before the net comes, and what is left
  // of the stretch the fight had put in the line, m.
  let showLeft = 0;
  let strain = 0;
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

  // The fish that came has the hook. Stand-in: always, and without a strike. It runs at
  // once and the weight comes onto the rod. A finger already down is winding against it.
  function hook() {
    hooked = visitor;
    visitor = null;
    hung = false;
    tension = 0;
    stretch = 0;
    running = 0;
    wound = 0;
    bolting = false;
    click.reset();
    fight.begin();
    haul.reset();
    school.take(hooked, fightBrain);
    haptics?.impact('heavy');
  }

  // Brought in close. From here the fish is a weight on the lure, and the lure a weight
  // on the line: it hangs, and winding lifts it out of the water.
  function bringIn(tip) {
    hung = true;
    landed += 1;
    tension = 0;
    running = 0;
    showLeft = SHOW_FOR;
    kick.reset();
    haul.reset();
    // Its weight is on the rod tip from here, not on the line. The stretch the line has
    // now is let go over the next moments.
    strain = Math.max(0, stretch);
    out.ease(move.gap(tip));
    haptics?.notification('success');
  }

  // The net has carried the fish out of the picture. It goes back to the school unseen.
  function giveUp() {
    school.keep(hooked);
    hooked = null;
    hung = false;
    net?.hide();
    strain = 0;
    weight.off();
  }

  // The fish is still on the hook: half out of the water it kicks, and once it has hung
  // under the tip a moment the net comes in under it.
  function onHook(dt, input, tip, room) {
    const dry = dryness(move.y);
    weight.hang(dry);
    // Half out of the water: it feels the air and kicks, and the water breaks round it.
    if (kick.rise(dry)) {
      splash.burst(move.x, move.z, BREAK_SPLASH);
      haptics?.impact('medium');
    }
    // Its mouth is on the lure, its body hangs from there along the line.
    school.hang(hooked, move.x, move.y, move.z, tip.x, tip.y, tip.z, dt, kick.vigor);
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
      if (scoop.dropped) weight.off();
    }
    net?.place(scoop.x, scoop.y, scoop.z, scoop.handleX, scoop.handleZ, scoop.stretch, scoop.rock);
  }

  // Off the hook: the fish falls into the net, lies there kicking, and goes where the
  // net goes. The lure stays on the line. Returns true when the net has gone.
  function inNet(dt) {
    const gone = scoop.step(dt, move.x, move.y, move.z);
    weight.off();
    if (scoop.landing) {
      kick.land();
      haptics?.impact('medium');
    } else if (scoop.caught && kick.lie(dt)) {
      haptics?.playTransient(0.4, 0.2);
    }
    // Head up in the bag, as it fell.
    school.hang(hooked, scoop.fishX, scoop.fishY, scoop.fishZ, scoop.fishX, scoop.fishY + 1, scoop.fishZ, dt, kick.vigor);
    net?.place(scoop.x, scoop.y, scoop.z, scoop.handleX, scoop.handleZ, scoop.stretch, scoop.rock);
    return gone;
  }

  return {
    // 'none', 'coming' while one swims to the lure, 'on' while one is hooked, 'landed'
    // while it hangs on the line or lies in the net.
    get fish() {
      return hooked ? (hung ? 'landed' : 'on') : visitor ? 'coming' : 'none';
    },
    // 'run' while a hooked fish is bolting, 'rest' while it sulks, '' otherwise.
    get mood() {
      return hooked && !hung ? (fight.running ? 'run' : 'rest') : '';
    },
    // The line's pull while a fish is being fought, and how hard the fish itself is
    // pulling, N.
    get tension() {
      return tension;
    },
    get pull() {
      return hooked ? fight.force : 0;
    },
    // How fast line is running out to the fish, m/s, and how fresh the fish is, 1 to 0.
    get running() {
      return hooked && !hung ? running : 0;
    },
    get stamina() {
      return hooked ? fight.stamina : 0;
    },
    // Fish landed since the start.
    get landed() {
      return landed;
    },
    // While the fish is being lifted: how much shorter than the line out the line still
    // holds it, m. What is left of the fight's stretch.
    get strain() {
      return strain;
    },

    // The lure has landed, having gone the level direction (dirX, dirZ). A fish will set
    // off for it after a while.
    arm(dirX, dirZ) {
      homeX = dirX;
      homeZ = dirZ;
      comeIn = COME_AFTER[0] + random() * (COME_AFTER[1] - COME_AFTER[0]);
    },

    // The lure is out of the water: a fish still on its way goes home.
    sendAway() {
      if (!visitor) return;
      school.giveBack(visitor);
      visitor = null;
    },

    // Once a frame with the lure in the water and no fish on. After a while the nearest
    // fish sets off for the lure. Returns true on the frame its mouth is on the hook.
    come(dt) {
      if (!school) return false;
      if (!visitor) {
        comeIn -= dt;
        if (comeIn > 0) return false;
        visitor = nearestFish();
        if (!visitor) return false;
        school.take(visitor, comeBrain);
      }
      school.mouth(visitor, mouth);
      if (!touching(mouth, move)) return false;
      hook();
      return true;
    },

    /**
     * Once a frame with a fish on. The lure rides in its mouth, line comes in or runs
     * out, and spot, the point the view watches, drifts after it.
     * Returns true on the frame it is landed: in close and no longer taking line.
     */
    fight(dt, input, tip, spot) {
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
      // The reel in the hand.
      const tick = click.step(given, taken, Math.min(1, tension / RUN_OUT_AT));
      if (tick) haptics?.playTransient(tick.intensity, tick.sharpness);
      // The view drifts after it, along the water.
      const k = 1 - Math.exp(-WATCH_FOLLOW * dt);
      spot.x += (mouth.x - spot.x) * k;
      spot.z += (mouth.z - spot.z) * k;
      if (!(fight.force < RUN_OUT_AT && Math.hypot(tip.x - mouth.x, tip.z - mouth.z) < LAND_WITHIN)) return false;
      bringIn(tip);
      return true;
    },

    /**
     * Once a frame with the fish landed. It hangs on the lure and winding lifts it to
     * just under the tip. Then the net comes in under it, it drops in, and the net
     * carries it away. Returns true on the frame the net has gone, the fish with it.
     */
    land(dt, input, tip, lastTip) {
      kick.fade(dt);
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
      if (!scoop.dropped) {
        onHook(dt, input, tip, room);
        return false;
      }
      if (!inNet(dt)) return false;
      giveUp();
      return true;
    },

    // The line's length to draw while the fish is being lifted: what is out, less what
    // is left of the fight's stretch.
    liftLength() {
      return Math.max(STOW_LENGTH, out.length - strain);
    },

    // Once a frame, whatever the stage: the weight on the rod tip follows.
    carry(dt) {
      const kg = weight.step(dt);
      if (kg !== null) rod.setTipLoad(kg);
    },
  };
}
