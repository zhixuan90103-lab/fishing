/**
 * The fish round the lure: which ones have noticed it, which go for it, which one is
 * biting, which are frightened off, and the spare fish brought in when few are near.
 *
 * Owns: each fish's own mind about the lure (how hungry, how interested, how
 * frightened, what it is doing), the one bite under way and what the angler's strike
 * comes to, bringing spare fish in where they cannot be seen and sending them away
 * again likewise, and telling the materials: the school which fish it has taken, let go,
 * brought and dismissed, the lure and the line where a mouth holding the hook is, the
 * feel the knock of a bite.
 * Does not own: the hooked fish (catch.js, which this file hands it to), or any of the
 * sums: how a lure draws a fish (allure.js), what a bite is (bite.js), what frightens a
 * fish and whether it stays (fright.js), how it bolts (flee.js), how many fish a cast
 * wants and when the next spare is due (muster.js), where the view cannot see
 * (outOfSight.js), how a fish swims to the lure, idles and makes off (visit.js), how big
 * a fish is among its kind (fishKind.js).
 * No Three: like catch.js it only joins those to the materials' openings.
 * Rules: docs/FISHING-REQUIREMENTS.md sections 7 to 9. Design: docs/PLAY.md section 7.
 *
 * Nobody sends a fish to the lure. Every fish that is near enough to notice it gets a
 * mind of its own about it: a hunger, drawn once, and an interest that the lure's own
 * behaviour warms or cools (allure.js). When its interest is high enough it wants the
 * lure. One fish goes for it at a time: of those that want it, the keenest, which is
 * the one that warmed first or the hungriest. The others gather and idle round the lure
 * until that one's bite is over, or it has been frightened off, or it has not managed to
 * reach the hook. Tried with every fish that wanted the lure going for it at once: ten
 * fish jostled over one hook and for half a minute none got its mouth on it.
 *
 * With too few fish near, spares are brought in: new fish, not the school's, put in the
 * water where the view cannot see them and left to swim in. They are fish like the
 * others here. When they leave they swim out of sight before they are taken out.
 *
 * What each fish is doing:
 *   watching  a fish of the school, still its own master, with an eye on the lure.
 *   near      taken: idling round the lure.
 *   coming    taken: going for the lure.
 *   biting    taken: the one fish at the hook.
 *   fleeing   taken: bolting, frightened.
 *   leaving   taken, a spare: swimming off out of sight, to be dismissed there.
 * A fish of the school that leaves is simply let go: it swims home by itself.
 */

import { AFTER_A_BITE, GIVES_UP, createAllure, drawGoesAt, taste } from './allure.js';
import { createBite, drawHunger } from './bite.js';
import { bulkOf, fishOf } from './fishKind.js';
import { createFlee } from './flee.js';
import { FRIGHT, NEAR, frightBeside, getsOver, nerveOf, wary } from './fright.js';
import { between } from './maths.js';
import { MOST, createMuster } from './muster.js';
import { placeBeside, unseen, wayOut } from './outOfSight.js';
import { steerAbout, steerOff, steerToLure, steerWithLure, touching } from './visit.js';

// A fish of the school within this of the lure, level metres, notices it. One that has
// noticed it and drifts this much further off forgets it, and so does an idling one.
const NOTICE = 7;
const FORGET = 3;
// A spare is put in this deep, m.
const BRING_DEPTH = [-2.6, -1.2];
// A fish idles round the lure at between these many metres, and this much above or
// below it, m.
const RING = [1.2, 3.2];
const RING_DEEP = [-0.6, 0.3];
// Going for a lure that is being wound, a fish keeps up with no more of its speed than
// this, m/s: it does not chase a lure hauled in fast.
const KEEPS_UP = 0.6;
// A fish that has gone for the lure and not got its mouth on it in this long, s, gives
// the others a turn.
const TRIES_FOR = 8;
// A fish whose bite has passed bites again no sooner than this, s.
const BITES_AGAIN = [0.8, 2.4];
// A fish of the school that has been let go takes no notice of the lure for this long, s.
const SHY_FOR = 20;
// When a fish is hooked the others bolt at least this frightened, and do not come back.
const HOOKED_FRIGHT = 0.5;
// A spare leaving goes down to this depth, m.
const OFF_DEPTH = -2.6;

/**
 * school: the fish, with fishes, take, giveBack, bring, dismiss and mouth. line: for its
 * tip. move: the lure's motion. out: the line out. feel: the hand, optional. random: 0 to 1.
 * surface: the top of the water, optional, with stir(x, z, strength, weight, depth): the
 * water over a bite.
 * species: which table of fishKind.js these fish are read off.
 */
export function createSuitors({ school, line, move, out, feel = null, surface = null, random, species }) {
  // What the fish biting now weighs, kg: the water over it is told with each pluck.
  let biterLoad = 0;
  const allure = createAllure();
  const bite = createBite(random);
  const muster = createMuster(random);
  // Every fish with a mind about the lure, by fish. And the spares among the fish this
  // file has ever had, hooked ones included, so that a spare is never given to the school.
  const minds = new Map();
  const spares = new Set();
  // Fish of the school taking no notice for a while: seconds left, by fish.
  const shy = new Map();
  // The lure is in the water and may be noticed.
  let open = false;
  // The level direction the cast went.
  let homeX = 0;
  let homeZ = 1;
  // This cast's fish are from the hungry half.
  let starved = false;
  // The fish going for the lure and for how long, the fish biting (the same one, once
  // its mouth is there), how fast the lure is going, and the fish just hooked.
  let goer = null;
  let goingFor = 0;
  let biter = null;
  let lureSpeed = 0;
  let caught = null;
  const mouth = { x: 0, y: 0, z: 0 };
  const brainMouth = { x: 0, y: 0, z: 0 };
  const spot = { x: 0, z: 0 };
  const off = { x: 0, z: 0 };

  // One function writes the aim of every fish this file has taken, by what it is doing.
  const brain = (fish, aim) => {
    const mind = minds.get(fish);
    if (!mind) return;
    if (mind.state === 'fleeing') mind.flee.steer(fish, aim, move);
    else if (mind.state === 'leaving') steerOff(fish, aim, mind.offX, mind.offZ, OFF_DEPTH);
    else if (mind.state === 'biting' && bite.held) steerWithLure(fish, aim, line.tip, bite.kind);
    else if (mind.state === 'coming' || mind.state === 'biting') {
      school.mouth(fish, brainMouth);
      steerToLure(fish, aim, brainMouth, move, Math.min(lureSpeed, KEEPS_UP));
    } else steerAbout(fish, aim, move, mind.ring, mind.turn, move.y + mind.deep);
  };

  function newMind(fish, spare, state) {
    const mind = {
      fish, spare, state,
      hunger: drawHunger(random, starved),
      interest: 0,
      goesAt: drawGoesAt(random),
      fright: 0,
      flee: createFlee(random),
      mayReturn: true,
      biteIn: 0,
      ring: between(random, RING),
      turn: random() < 0.5 ? -1 : 1,
      deep: between(random, RING_DEEP),
      offX: 0,
      offZ: 0,
    };
    minds.set(fish, mind);
    if (spare) spares.add(fish);
    return mind;
  }

  // Fish that are round the lure or have an eye on it: not the ones bolting or leaving.
  function live() {
    let n = 0;
    for (const mind of minds.values()) if (mind.state !== 'fleeing' && mind.state !== 'leaving') n += 1;
    return n;
  }

  const farFromLure = (fish) => Math.hypot(fish.x - move.x, fish.z - move.z);

  // Put one spare in the water out of sight, to one side of the lure, heading for it.
  // Returns false when no place out of sight was found or no spare is left.
  function bringOne(viewYaw, tip) {
    if (!placeBeside(random, move, homeX, homeZ, viewYaw, tip, spot)) return false;
    const fish = school.bring(spot.x, between(random, BRING_DEPTH), spot.z, Math.atan2(move.x - spot.x, move.z - spot.z), brain);
    if (!fish) return false;
    newMind(fish, true, 'near');
    return true;
  }

  // A fish is done with the lure. One of the school is let go and swims home; a spare
  // swims off, and is dismissed once it cannot be seen (tend).
  function leave(mind) {
    if (goer === mind) goer = null;
    if (biter === mind) {
      biter = null;
      bite.end();
    }
    if (mind.spare) {
      mind.state = 'leaving';
      return;
    }
    if (mind.state !== 'watching') school.giveBack(mind.fish);
    minds.delete(mind.fish);
    shy.set(mind.fish, SHY_FOR);
  }

  // It bolts. One of the school that had not come over yet just loses interest for a while.
  function bolt(mind, mayReturn) {
    if (mind.state === 'watching') {
      minds.delete(mind.fish);
      shy.set(mind.fish, SHY_FOR);
      return;
    }
    if (goer === mind) goer = null;
    mind.state = 'fleeing';
    mind.mayReturn = mayReturn;
    mind.flee.begin(mind.fish, mind.fright);
  }

  // Frighten a fish by so much. It bolts if that is more than it has the nerve for. If
  // not it stays, and thinks better of the lure for now.
  function scare(mind, fright) {
    mind.fright += fright;
    if (mind.fright > nerveOf(mind.hunger)) {
      bolt(mind, true);
      return;
    }
    if (mind.state === 'biting' || mind.state === 'coming') mind.state = 'near';
    if (goer === mind) goer = null;
    mind.interest *= AFTER_A_BITE;
  }

  // The bite came to nothing through the angler's doing: the fish that was at the hook
  // is frightened by so much, and is back among the others if it stays.
  function spoil(fright) {
    const was = biter;
    endBite();
    was.biteIn = between(random, BITES_AGAIN);
    was.state = 'near';
    scare(was, fright);
    return was;
  }

  // The bite is off without a fish hooked.
  function endBite() {
    biter = null;
    goer = null;
    bite.end();
  }

  // The fish at the hook is hooked. It is handed to catch.js; every other fish bolts,
  // and none of them comes back.
  function hook() {
    const mind = biter;
    caught = mind.fish;
    minds.delete(mind.fish);
    endBite();
    open = false;
    muster.stop();
    for (const other of [...minds.values()]) {
      if (other.state === 'leaving' || other.state === 'fleeing') {
        other.mayReturn = false;
        continue;
      }
      other.fright = Math.max(HOOKED_FRIGHT, other.fright + frightBeside(farFromLure(other.fish)));
      bolt(other, false);
    }
    return 'hooked';
  }

  const suitors = {
    // What the fish round the lure are up to, the busiest of it: 'biting', 'coming',
    // 'near', 'fleeing' or 'none'.
    get doing() {
      let best = 'none';
      const rank = { none: 0, leaving: 0, watching: 0, fleeing: 1, near: 2, coming: 3, biting: 4 };
      for (const mind of minds.values()) if (rank[mind.state] > rank[best]) best = mind.state;
      return best;
    },
    // The bite under way, '' for none, and whether the hook is in a mouth this frame.
    get bite() {
      return biter ? bite.kind : '';
    },
    get hookIn() {
      return !!biter && bite.held;
    },
    // The pull of the biting fish on the line this frame, N.
    get pull() {
      return biter ? bite.pull : 0;
    },
    // How many fish are round the lure: come over to it, and not bolting or leaving.
    get around() {
      let n = 0;
      for (const mind of minds.values()) if (mind.state === 'near' || mind.state === 'coming' || mind.state === 'biting') n += 1;
      return n;
    },
    // The fish that matters most just now, for the readout: the one biting, else the
    // keenest. Its hunger and fright, 0 with none.
    get lead() {
      if (biter) return biter;
      let best = null;
      for (const mind of minds.values()) if (mind.state !== 'leaving' && (!best || mind.interest > best.interest)) best = mind;
      return best;
    },
    // Every fish with a mind about the lure, for tuning and for the checks. Read only.
    get minds() {
      return minds.values();
    },
    // The fish hooked on the last 'hooked'.
    get caught() {
      return caught;
    },
    // Whether this fish is a spare, not one of the school.
    isSpare(fish) {
      return spares.has(fish);
    },

    /**
     * The lure has landed, having gone the level direction (dirX, dirZ). hungry: this
     * cast's fish are drawn from the hungry half.
     */
    arm(dirX, dirZ, hungry) {
      homeX = dirX;
      homeZ = dirZ;
      starved = hungry;
      open = true;
      muster.arm();
      allure.reset();
    },

    /**
     * Once a frame with the lure in the water and no fish on. taken: line wound in this
     * frame, m. struck: the hand struck this frame. viewYaw: where the view looks.
     * Returns 'bite' on the frame a bite begins, 'hooked' on the frame a fish is hooked
     * (it is `caught`), '' otherwise. While hookIn is true the lure is in its mouth, and
     * put there, and the line goes with it.
     */
    step(dt, tip, taken, struck, viewYaw) {
      lureSpeed = Math.hypot(move.vx, move.vz);
      allure.step(dt, lureSpeed);
      // The school's fish near enough take notice, each with a mind of its own.
      if (open) {
        let room = MOST - live();
        for (const fish of school.fishes) {
          if (room <= 0) break;
          if (fish.state !== 'free' || minds.has(fish) || shy.has(fish)) continue;
          if (farFromLure(fish) > NOTICE) continue;
          newMind(fish, false, 'watching');
          room -= 1;
        }
      }
      // With too few near, spares make up the number, one at a time.
      if (open && muster.step(dt, live())) muster.brought(bringOne(viewYaw, tip));
      let began = false;
      // The keenest of the fish that want the lure and are free to go for it.
      let keenest = null;
      for (const mind of [...minds.values()]) {
        const fish = mind.fish;
        if (mind.state === 'fleeing' || mind.state === 'leaving' || mind.state === 'biting') continue;
        mind.interest = allure.warm(dt, mind.interest, mind.hunger);
        mind.fright = getsOver(mind.fright, dt);
        mind.biteIn -= dt;
        const far = farFromLure(fish);
        if (mind.state === 'watching') {
          // Still the school's. Taken the moment it wants the lure: it comes over.
          if (fish.state !== 'free' || far > NOTICE + FORGET) {
            minds.delete(fish);
            continue;
          }
          if (mind.interest < mind.goesAt) continue;
          school.take(fish, brain);
          mind.state = 'near';
        }
        if (far > NOTICE + FORGET) {
          leave(mind);
          continue;
        }
        if (mind.state === 'near') {
          if (mind.biteIn <= 0 && mind.interest >= mind.goesAt && !wary(mind.fright, mind.hunger) && (!keenest || mind.interest + mind.hunger > keenest.interest + keenest.hunger)) keenest = mind;
          continue;
        }
        // Going for it. The lure no longer to its liking, or the hook not reached in a
        // good while: it falls back and another may go.
        goingFor += dt;
        if (mind.interest < GIVES_UP || goingFor > TRIES_FOR) {
          mind.state = 'near';
          if (goingFor > TRIES_FOR) mind.biteIn = between(random, BITES_AGAIN);
          goer = null;
          continue;
        }
        school.mouth(fish, mouth);
        if (!touching(mouth, move)) continue;
        biter = mind;
        mind.state = 'biting';
        bite.begin(mind.hunger, taste(lureSpeed), bulkOf(species, fish.size));
        biterLoad = fishOf(species, fish.size).load;
        began = true;
      }
      if (!goer && keenest) {
        goer = keenest;
        goingFor = 0;
        keenest.state = 'coming';
      }
      const what = biter ? bite.step(dt, taken) : null;
      if (what === 'knock') {
        feel?.hit(bite.knock.intensity, bite.knock.sharpness);
        // The pluck stirs the water over it, as hard as the hand feels it: what shows of
        // that from down there is the water's business.
        surface?.stir(move.x, move.z, bite.knock.intensity, biterLoad, -move.y);
      }
      if (what === 'scraped') return hook();
      // The bite has passed and nobody struck: the fish stays, and will bite again.
      if (what === 'over') {
        biter.state = 'near';
        biter.interest *= AFTER_A_BITE;
        biter.biteIn = between(random, BITES_AGAIN);
        biter = null;
        goer = null;
      }
      // A strike with the hook in a mouth sets it. Any other strike frightens every fish
      // near: the one at the hook most, the ones beside it less. Each decides for itself
      // whether to bolt. Struck and wound in the same moment is a strike.
      if (struck) {
        if (biter && bite.held) return hook();
        // The rod moved the line and the lure, and the hook found nothing.
        feel?.hit(0.16, 0.55);
        const was = biter ? spoil(bite.kind === 'light' ? FRIGHT.nipped : FRIGHT.missed) : null;
        for (const mind of [...minds.values()]) {
          if (mind === was || mind.state === 'fleeing' || mind.state === 'leaving') continue;
          const far = farFromLure(mind.fish);
          if (far < NEAR) scare(mind, frightBeside(far));
        }
        return '';
      }
      if (what === 'drawn') {
        spoil(FRIGHT.drawn);
        return '';
      }
      // In its mouth the lure goes where the mouth goes, and the line with it: finger up
      // it runs after the fish, finger down what is wound is the lure being drawn
      // through its lips. Either way there is at least as much line out as reaches the
      // fish. Line lying spare is left spare: nothing has wound it in, and the fish going
      // off with the lure is what takes it up. (Until 2026-11-25 the line out was set to
      // the reach every frame: spare line was gone the frame a fish took the lure, and
      // the line was drawn straight in that one frame.)
      if (biter && bite.held) {
        school.mouth(biter.fish, mouth);
        move.drawnTo(dt, mouth.x, mouth.y, mouth.z);
        out.pay(Math.max(0, move.gap(tip) - out.length));
      }
      return began ? 'bite' : '';
    },

    /**
     * Once a frame whatever the stage: the fish that are bolting or leaving go on doing
     * so with a fish on the line or the cast over. A bolting fish, calm again, comes
     * back to the lure or goes; a spare that is leaving is dismissed once the view
     * cannot see it. viewYaw: where the view looks, radians.
     */
    tend(dt, viewYaw, tip) {
      for (const [fish, left] of shy) {
        if (left <= dt) shy.delete(fish);
        else shy.set(fish, left - dt);
      }
      for (const mind of [...minds.values()]) {
        const fish = mind.fish;
        if (mind.state === 'fleeing') {
          if (!mind.flee.calm) continue;
          if (open && mind.mayReturn && mind.flee.comesBack(mind.hunger)) {
            // Back as a fish that has just come: hungry or not anew, and calm.
            mind.state = 'near';
            mind.hunger = drawHunger(random, false);
            mind.fright = 0;
            mind.interest = 0;
          } else leave(mind);
        }
        if (mind.state !== 'leaving') continue;
        if (unseen(fish.x, fish.z, viewYaw, tip)) {
          school.dismiss(fish);
          minds.delete(fish);
          continue;
        }
        wayOut(fish.x, fish.z, viewYaw, tip, off);
        mind.offX = off.x;
        mind.offZ = off.z;
      }
    },

    // The lure is out of the water, or the cast is over: every fish goes.
    scatter() {
      open = false;
      muster.stop();
      goer = null;
      for (const mind of [...minds.values()]) if (mind.state !== 'leaving') leave(mind);
    },

    /**
     * A fish that was on the line is loose in the water again: it threw the hook, or
     * took all the line. It bolts and does not come back. lure: the lure is still in
     * the water there, and other fish may come to it.
     */
    loose(fish, lure) {
      const mind = newMind(fish, spares.has(fish), 'fleeing');
      mind.mayReturn = false;
      mind.flee.begin(fish, FRIGHT.shed);
      school.take(fish, brain);
      if (!lure) return;
      open = true;
      muster.again();
      allure.reset();
    },

    // A hooked fish has been netted and carried out of the picture: one of the school
    // goes back to it unseen, a spare is taken out of the water.
    netted(fish) {
      if (spares.has(fish)) school.dismiss(fish);
      else school.keep(fish);
    },
  };
  return suitors;
}
