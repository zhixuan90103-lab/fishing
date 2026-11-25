/**
 * The fish's half of a cast: one comes to the lure, takes it, is fought, lifted out and
 * netted.
 *
 * Owns: reading the strike, hooking the fish the bite gives it, what a fight does to
 * the line each frame, when it counts as landed or lost, the lift, calling the net, and
 * telling the
 * materials: the school which fish is taken, hung and kept, the reel what was wound, the
 * lure what hangs on the hook with it, the rod how hard the hand is working, the net
 * where it is, the splash and the haptics.
 * Does not own: the stage of the cast or what the finger means before a fish is on
 * (fishing.js), the lure's own motion and the line's length (it is handed both), the
 * fish round the lure before one is hooked: which notice it, come, bite and bolt
 * (suitors.js, which hands this file the fish that is hooked), or any
 * of the sums: what a fish of a kind and size is like (fishKind.js), whether the hand
 * struck (strike.js), whether slack line lets it throw the hook (shed.js), how it
 * pulls (fight.js), which way its runs head (course.js), how it shakes its
 * head (thump.js) and kicks (kick.js), how line comes in
 * and runs out (haul.js), how hard a held finger leans on a run (lean.js), the reel's clicks (reelClick.js),
 * the hand's effort (strain.js), the weight on the tip (tipWeight.js), the net's path
 * (scoop.js).
 * No Three: like fishing.js it only joins those to the materials' openings.
 * Rules: docs/FISHING-REQUIREMENTS.md sections 8 to 13. Design: docs/PLAY.md.
 *
 * fishing.js drives it: arm() when the lure lands, then one of come(), fight() or land()
 * each frame, by stage. come() says when a bite begins and when the fish is hooked,
 * fight() says how it ended, land() returns true on the frame the net has gone.
 */

import { createCourse } from './course.js';
import { createFight } from './fight.js';
import { createOnLine } from './onLine.js';
import { drawNature, fishOf } from './fishKind.js';
import { RUN_OUT_AT, createHaul } from './haul.js';
import { createKick } from './kick.js';
import { toward } from './maths.js';
import { createReelClick } from './reelClick.js';
import { createScoop } from './scoop.js';
import { createShed } from './shed.js';
import { createSideStrain } from './sideStrain.js';
import { createStrike } from './strike.js';
import { createSuitors } from './suitors.js';
import { createLean } from './lean.js';
import { createLowRod } from './lowRod.js';
import { createStrain } from './strain.js';
import { createThump } from './thump.js';
import { LURE_KG } from '../shore/lureMove.js';
import { DRY_BY, DRY_FROM, LIMP_SHARE, dryness } from './tipWeight.js';

// What this file reports about the fish, for tuning against a real hand: the names of
// the read-only values on the object createCatch returns. fishing.js passes them on.
export const FISH_READOUT = ['fish', 'braked', 'lowered', 'around', 'bite', 'hookIn', 'hunger', 'interest', 'fright', 'hookLoose', 'mood', 'size', 'big', 'tension', 'pull', 'press', 'effort', 'running', 'stamina', 'landed'];
// The one species in the water. Its numbers by size are in fishKind.js.
const SPECIES = 'dorade';

// After this many casts in a row with nothing landed, the next cast's fish are hungry ones.
const DRY_CASTS = 3;
// The line the reel holds, m, unless told otherwise. With this much out it gives no more.
const SPOOL = 70;
// A fish pulling near the top churns the water where it is: all of what its speed makes
// at CHURN_TOP, m, and none of it deeper than CHURN_DEEP, and of that the share of its
// freshest pull it is putting out now: it is the beating tail that throws water, and a
// fish towed in limp throws next to none. There is no splash for the start of a run:
// a fish that bolts near the top is fast and pulling, and that is the churn.
// Tried without the share of its pull: a resting fish drawn in near the top showed as
// much as a running one.
// What it looks like is the wake's (src/shore/wakeTrack.js). churn: that wake's track.
const CHURN_TOP = -0.5;
const CHURN_DEEP = -2;
// While a fish is on, the point the view watches follows it at this rate, 1/s. Lower and
// the view drifts after the fish and swings less with every turn it makes; too low and a
// fish crossing at speed is out of the picture before the view has come round.
const WATCH_FOLLOW = 2.5;
// A hooked fish this close to under the tip, level metres, is landed.
const LAND_WITHIN = 2.2;
// A landed fish is lifted until this much line is left, m, and hangs there this long, s,
// before the net is called in.
const SHOW_LENGTH = 0.6;
const SHOW_FOR = 0.6;
// The lift is wound as slowly as line against this much tension, N.
const LIFT_AS = 3.2;
// Coming off the hook its weight leaves the line over a moment, at this rate, 1/s, not
// in an instant: it tears free. All at once, the rod springs straight and flings the
// bare lure up past its own tip.
const COMES_OFF = 8;
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
export function createCatch({ rod, line, splash, churn = null, school, net, haptics, random, move, out, spool = SPOOL }) {
  const haul = createHaul();
  const fight = createFight(random);
  const onLine = createOnLine(fight);
  const course = createCourse(random);
  const thump = createThump(random);
  const lean = createLean();
  const lowRod = createLowRod();
  const strain = createStrain();
  const scoop = createScoop();
  const click = createReelClick();
  const kick = createKick(random);
  const strike = createStrike();
  const shed = createShed(random);
  const sideStrain = createSideStrain();
  // The fish round the lure before one is hooked. Without a school there are none.
  const suitors = school ? createSuitors({ school, line, move, out, haptics, random, species: SPECIES }) : null;
  // What the fish on the line is like: fishOf() in fishKind.js. null with none on. And
  // whether it is one that can take line: fresh, it pulls harder than the reel holds.
  let kind = null;
  let takesLine = false;
  // The effort the rod was last told.
  let toldEffort = 0;

  // Each fish's own nature, drawn the first time it is hooked and its own from then on.
  const natures = new WeakMap();
  // The level direction the cast went, for keeping a hooked fish in front.
  let homeX = 0;
  let homeZ = 1;
  // The fish on the line.
  let hooked = null;
  // Casts in a row with nothing landed, and the count landed when the last one began.
  let dry = 0;
  let landedBefore = 0;
  let cast = false;
  // The hooked fish hangs on the line, out of the fight.
  let hung = false;
  // The mouth of that fish this frame.
  const mouth = { x: 0, y: 0, z: 0 };
  // Fighting: the line's pull, N, as the line reported it this frame, and how much
  // further the hook is from the tip than there is line out, m.
  let tension = 0;
  let stretch = 0;
  // Fighting: how fast line is running out, m/s.
  let running = 0;
  // Fighting, as its brain last saw it: where it is from the rod tip.
  const bearing = { x: 0, z: 1, far: 0 };
  // How far to the left of the cast's direction the fish's head points, -1 to 1.
  let head = 0;
  // Lifting: seconds the fish has still to hang before the net comes, and the frame's
  // length and the kick it is hung with, for follow().
  let showLeft = 0;
  let hangDt = 0;
  // What is left of the fish's weight on the hook as it comes off, kg.
  let tearing = 0;
  // Fish landed since the start.
  let landed = 0;

  // The hooked fish's aim is put together from two answers: how its pull sets it against
  // the line (fight.js), and where this run means to go (course.js). The rod has its say
  // only through the line: where its tip is, and which way that has brought its head.
  const fightBrain = (fish, aim, env, dt) => {
    onLine.bearing(fish, line.tip, homeX, homeZ, bearing);
    course.stands(Math.atan2(homeX * bearing.z - homeZ * bearing.x, homeX * bearing.x + homeZ * bearing.z));
    // How far to the left of the cast's direction its head points, -1 to 1.
    head = Math.cos(fish.yaw) * homeX - Math.sin(fish.yaw) * homeZ;
    const wants = course.across(fight.running, fight.stamina, kind.dash, bearing.far);
    // A rod carried against the way this run heads takes some of that off.
    const own = wants * sideStrain.step(dt, line.tip, bearing, wants);
    onLine.steer(fish, aim, bearing, stretch, line.stiffness, haul.speed, RUN_OUT_AT, own, dt);
  };

  // The fish that came has the hook: struck while it was in its mouth, or scraped home
  // in a dead bite. It runs at once and the weight comes onto the rod. A finger already
  // down is winding against it.
  function hook(fish) {
    hooked = fish;
    shed.begin();
    sideStrain.reset();
    hung = false;
    tension = 0;
    stretch = 0;
    running = 0;
    if (!natures.has(hooked)) natures.set(hooked, drawNature(random));
    kind = fishOf(SPECIES, hooked.size, natures.get(hooked));
    takesLine = kind.runFresh > RUN_OUT_AT;
    click.reset();
    fight.begin(kind);
    // Its first run sets off the way its head points too: it came at the lure from somewhere.
    head = Math.cos(hooked.yaw) * homeX - Math.sin(hooked.yaw) * homeZ;
    course.hooked();
    course.begin(head, kind.bold);
    thump.begin(kind);
    lean.begin();
    lowRod.begin();
    haul.reset();
    school.take(hooked, fightBrain);
    // A fish that can take line lands on the rod harder than one that cannot.
    haptics?.impact(takesLine ? 'heavy' : 'medium');
  }

  // The hooked fish has shaken the hook out on a slack line. It bolts for good; the lure
  // is left in the water where its mouth was, and another fish may come to it.
  function throwHook() {
    const fish = hooked;
    hooked = null;
    kind = null;
    hung = false;
    tension = 0;
    running = 0;
    thump.end();
    haul.reset();
    strike.reset();
    suitors.loose(fish, true);
    haptics?.impact('light');
  }

  // The fish has taken all the line. It swims off, the lure with it. What is left is bare line, and fishing.js has it wound back in.
  function lose() {
    suitors.loose(hooked, false);
    hooked = null;
    kind = null;
    hung = false;
    tension = 0;
    running = 0;
    thump.end();
    haul.reset();
    haptics?.notification('warning');
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
    thump.end();
    // From here it is a weight on the hook: under water a share of what it weighs, all
    // of it once it is clear. The line carries it, and brings it onto the rod tip. It
    // does not swim again: lowered back into the water it sinks on the line.
    move.weigh(kind.load, LIMP_SHARE, DRY_FROM, DRY_BY);
    tearing = kind.load;
    haptics?.notification('success');
  }

  // The net has carried the fish out of the picture. It goes back to the school unseen.
  function giveUp() {
    suitors.netted(hooked);
    hooked = null;
    kind = null;
    hung = false;
    net?.hide();
    tearing = 0;
    move.weigh();
  }

  // The fish is still on the hook: half out of the water it kicks, and once it has hung
  // under the tip a moment the net comes in under it.
  function onHook(dt, input, tip, room) {
    const dry = dryness(move.y);
    // Half out of the water: it feels the air and kicks, and the water breaks round it.
    if (kick.rise(dry)) {
      splash.burst(move.x, move.z, BREAK_SPLASH);
      haptics?.impact('medium');
    }
    hangDt = dt;
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
      // Off the hook this frame: from here its weight leaves the line.
    }
    net?.place(scoop.x, scoop.y, scoop.z, scoop.handleX, scoop.handleZ, scoop.stretch, scoop.rock);
  }

  // Off the hook: the fish falls into the net, lies there kicking, and goes where the
  // net goes. The lure stays on the line. Returns true when the net has gone.
  function inNet(dt) {
    const gone = scoop.step(dt, move.x, move.y, move.z);
    if (scoop.landing) {
      kick.land();
      haptics?.impact('medium');
    } else if (scoop.caught && kick.lie(dt)) {
      haptics?.playTransient(0.4, 0.2);
    }
    // Head up in the bag, as it fell.
    school.hang(hooked, scoop.fishX, scoop.fishY, scoop.fishZ, scoop.fishX, scoop.fishY + 1, scoop.fishZ, dt, kick.vigor, false);
    net?.place(scoop.x, scoop.y, scoop.z, scoop.handleX, scoop.handleZ, scoop.stretch, scoop.rock);
    return gone;
  }

  return {
    // 'none', 'coming' while one swims to the lure or stays by it between bites, 'biting',
    // 'fleeing' while it bolts frightened, 'on' while one is hooked, 'landed' while it
    // hangs on the line or lies in the net.
    get fish() {
      return hooked ? (hung ? 'landed' : 'on') : suitors ? suitors.doing : 'none';
    },
    // How many fish are round the lure or making off from it, spares and the school's.
    get around() {
      return suitors ? suitors.around : 0;
    },
    // The bite under way: '' for none, 'light', 'medium', 'heavy' or 'dead'. And whether
    // the hook is in the fish's mouth this frame: the lure rides there, not on the line.
    get bite() {
      return suitors ? suitors.bite : '';
    },
    get hookIn() {
      return suitors ? suitors.hookIn : false;
    },
    // The fish that matters most at the lure, the one biting or else the keenest: how
    // hungry, how interested in the lure and how frightened, each 0 to 1.
    get hunger() {
      return (!hooked && suitors?.lead?.hunger) || 0;
    },
    get interest() {
      return (!hooked && suitors?.lead?.interest) || 0;
    },
    get fright() {
      const lead = !hooked && suitors?.lead;
      return lead ? (lead.state === 'fleeing' ? lead.flee.fright : lead.fright) : 0;
    },
    // Every fish with a mind about the lure (suitors.js), for tuning and the checks.
    get minds() {
      return suitors ? suitors.minds : [];
    },
    // The share of its speed across the line a running fish has lost to a rod carried
    // against it, 0 to 1.
    get braked() {
      return hooked && !hung ? sideStrain.share : 0;
    },
    // How near the hooked fish is to throwing the hook, 0 to 1.
    get hookLoose() {
      return hooked && !hung ? shed.loose : 0;
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
    // The fish on the line: its body's scale, 0 with none on, and whether it is one that
    // can take line.
    get size() {
      return kind ? kind.size : 0;
    },
    get big() {
      return kind ? takesLine : false;
    },
    // What a finger held down on a running fish is adding to the line, N, and how hard
    // the hand on the rod is working, 0 to 1.
    get press() {
      return hooked && !hung ? lean.press : 0;
    },
    get effort() {
      return strain.effort;
    },
    // What a rod held low is adding to what the reel holds, N.
    get lowered() {
      return hooked && !hung ? lowRod.holds : 0;
    },
    // How much shorter the line is drawn tight for this frame than what is out, m: a
    // shake of a hooked fish's head snatching it, or a biting fish plucking it.
    get snatch() {
      if (hooked) return hung ? 0 : thump.pull / line.stiffness;
      return suitors ? suitors.pull / line.stiffness : 0;
    },

    // The lure has landed, having gone the level direction (dirX, dirZ). From now on
    // the fish near it may notice it.
    arm(dirX, dirZ) {
      homeX = dirX;
      homeZ = dirZ;
      strike.reset();
      // A cast that began after one with nothing landed is one more dry cast.
      dry = cast && landed === landedBefore ? dry + 1 : 0;
      landedBefore = landed;
      cast = true;
      suitors?.arm(dirX, dirZ, dry >= DRY_CASTS);
    },

    // The lure is out of the water: every fish round it goes.
    sendAway() {
      suitors?.scatter();
    },

    /**
     * Once a frame with the lure in the water and no fish on: the fish round the lure
     * make up their own minds (suitors.js), and the hand may strike. taken: line wound
     * in this frame, m. input.raised: how far up the hand has tipped the rod, degrees,
     * or null; input.lift: the desktop stand-in for a strike.
     * Returns 'bite' on the frame a bite begins, 'hooked' on the frame a fish is on,
     * '' otherwise. While hookIn is true the lure is in a fish's mouth.
     */
    come(dt, input, tip, taken) {
      const struck = strike.step(dt, input.raised, input.lift);
      if (!suitors) return '';
      const what = suitors.step(dt, tip, taken, struck, input.viewYaw);
      if (what === 'hooked') hook(suitors.caught);
      return what;
    },

    /**
     * Once a frame with a fish on. The lure rides in its mouth, line comes in or runs
     * out, and spot, the point the view watches, drifts after it.
     * Returns how it ended, on the frame it does: 'landed', in close and no longer taking
     * line, 'spooled', the fish has taken all the line, or 'shed', it has thrown the hook
     * on a slack line and the lure is left in the water.
     * '' while it goes on.
     */
    fight(dt, input, tip, spot) {
      // Its runs and rests, by what its pull is costing it against the line as it was a
      // frame ago, and where a run that has just begun means to go.
      if (fight.step(dt, tension, course.uneasy(bearing.far), sideStrain.share)) course.begin(head, kind.bold);
      course.step(dt, fight.running, kind.bold);
      // A finger held down on a fish that is taking line leans on it.
      lean.step(dt, input.finger, fight.force > RUN_OUT_AT);
      // A rod held low has its butt in it: the reel holds that much more. With the
      // finger's lean, this is what stands against the fish over the reel's own hold.
      haul.brace(lean.press + lowRod.step(dt, tip.y));
      // Its head shakes: a snatch on the line and in the hand.
      const shake = thump.step(dt, fight.running, fight.stamina);
      if (shake) haptics?.playTransient(shake.intensity, shake.sharpness);
      school.mouth(hooked, mouth);
      // Near the top and pulling, it churns the water, pointing the way it goes.
      if (churn) churn.follow(dt, mouth.x, mouth.z, Math.min(1, Math.max(0, (mouth.y - CHURN_DEEP) / (CHURN_TOP - CHURN_DEEP))) * Math.min(1, fight.force / kind.runFresh));
      tension = line.tension;
      // What the hand holds is the pull on the rod, read off the rod.
      const taken = Math.min(haul.step(dt, input.finger, tension), out.room);
      rod.reel.wind(taken);
      // The lure rides in its mouth, and the line ends there.
      move.place(mouth.x, mouth.y, mouth.z);
      const gap = move.gap(tip);
      out.wind(dt, taken, gap);
      // Pulling harder than the reel holds, it takes line, finger down or not. With none
      // left to take, it has it all and is gone. It goes by the fish's own pull and by
      // nothing else: a fish that cannot out-pull the reel gets no line, however hard it
      // fetches up against the end of it. What is wound in from such a fish stays in.
      const slips = haul.slip(gap - out.length, line.stiffness);
      let given = 0;
      if (haul.gives(fight.force)) {
        given = Math.min(slips, Math.max(0, spool - out.length));
        out.pay(given);
        if (slips > given) {
          lose();
          return 'spooled';
        }
        haul.keeps();
      } else {
        // A knock, not line taken: lent, and wound back as the fish comes off the end.
        out.pay(slips);
        haul.lend(slips);
        out.pay(-haul.takeBack(gap - out.length, line.stiffness));
      }
      running = given / dt;
      // On a slack line it shakes the hook, and may throw it.
      if (shed.step(dt, out.length - gap, fight.stamina)) {
        throwHook();
        return 'shed';
      }
      // What the fish is up against is all of it: the stretch in the line and what the
      // tackle has given under it.
      stretch = gap - out.length + haul.lent;
      // The reel in the hand.
      const tick = click.step(given, taken, Math.min(1, tension / RUN_OUT_AT));
      if (tick) haptics?.playTransient(tick.intensity, tick.sharpness);
      // The view drifts after it, along the water.
      spot.x = toward(spot.x, mouth.x, WATCH_FOLLOW, dt);
      spot.z = toward(spot.z, mouth.z, WATCH_FOLLOW, dt);
      if (!(fight.force < RUN_OUT_AT && Math.hypot(tip.x - mouth.x, tip.z - mouth.z) < LAND_WITHIN)) return '';
      bringIn(tip);
      return 'landed';
    },

    /**
     * Once a frame with the fish landed. It hangs on the lure and winding lifts it to
     * just under the tip. Then the net comes in under it, it drops in, and the net
     * carries it away. spot, the point the view watches, drifts after it, up as well as
     * along. Returns true on the frame the net has gone, the fish with it.
     */
    land(dt, input, tip, spot) {
      kick.fade(dt);
      // The view drifts after it as it comes up out of the water and hangs: after the
      // lure it hangs from, which stays on the line when the fish has gone into the net.
      spot.x = toward(spot.x, move.x, WATCH_FOLLOW, dt);
      spot.y = toward(spot.y, move.y, WATCH_FOLLOW, dt);
      spot.z = toward(spot.z, move.z, WATCH_FOLLOW, dt);
      const room = Math.max(0, out.length - SHOW_LENGTH);
      const taken = scoop.dropped ? 0 : Math.min(haul.step(dt, input.finger, LIFT_AS), room);
      rod.reel.wind(taken);
      out.wind(dt, taken, move.gap(tip));
      if (scoop.dropped && tearing > 0) {
        tearing = toward(tearing, 0, COMES_OFF, dt);
        if (tearing < 1e-3) tearing = 0;
        move.weigh(LURE_KG + tearing);
      }
      if (!scoop.dropped) {
        onHook(dt, input, tip, room);
        return false;
      }
      if (!inNet(dt)) return false;
      giveUp();
      return true;
    },

    // Once a frame after the rod and the line have moved, while the fish hangs on the
    // hook: its mouth is on the lure, where the rod has just left it, and its body hangs
    // from there along the line.
    follow(tip) {
      if (!hooked || !hung || scoop.dropped) return;
      school.hang(hooked, move.x, move.y, move.z, tip.x, tip.y, tip.z, hangDt, kick.vigor);
    },

    // Once a frame, whatever the stage, after the stage's own call: how hard the hand is
    // working follows what it holds, and that is the line's pull on the rod, fish or no
    // fish, in the water or hanging from the tip.
    carry(dt, input, tip) {
      // Fish bolting from the lure or leaving it go on doing so, whatever the stage.
      suitors?.tend(dt, input.viewYaw, tip);
      // With no fish being fought there is nothing to churn the water.
      if (churn && !(hooked && !hung)) churn.lift(dt);
      strain.step(dt, line.tension);
      if (strain.effort !== toldEffort) {
        toldEffort = strain.effort;
        rod.setStrain(toldEffort);
      }
    },
  };
}
