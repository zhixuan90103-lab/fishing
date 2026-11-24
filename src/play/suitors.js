/**
 * The fish round the lure: which ones have noticed it, which go for it, which one is
 * biting, which are frightened off, and the spare fish brought in when few are near.
 *
 * Owns: each fish's own mind about the lure (how hungry, how interested, how
 * frightened, what it is doing), the one bite under way and what the angler's strike
 * comes to, bringing spare fish in where they cannot be seen and sending them away
 * again likewise, and telling the materials: the school which fish it has taken, let go,
 * brought and dismissed, the lure and the line where a mouth holding the hook is, the
 * haptics the knock of a bite.
 * Does not own: the hooked fish (catch.js, which this file hands it to), or any of the
 * sums: how a lure draws a fish (allure.js), what a bite is (bite.js), fright and nerve
 * (flee.js), how a fish swims to the lure, idles and makes off (visit.js).
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
import { FRIGHT, NEAR, createFlee, frightBeside, getsOver, nerveOf, wary } from './flee.js';
import { between } from './maths.js';
import { steerAbout, steerOff, steerToLure, steerWithLure, touching } from './visit.js';

// A fish of the school within this of the lure, level metres, notices it. One that has
// noticed it and drifts this much further off forgets it, and so does an idling one.
const NOTICE = 7;
const FORGET = 3;
// No more fish than this have a mind about the lure at once.
const MOST = 10;
// A cast wants between these many fish round the lure. With fewer of the school's near,
// spares make up the number: this long after the lure lands, s, and then one at a time,
// this far apart, s.
const WANTED = [1, 10];
const TOP_UP_AFTER = 1;
const BRING_EVERY = [0.4, 1.6];
// With every fish gone from the lure, more are brought after this long, s.
const COME_AFTER = [1.5, 4];
// Where a spare is put in: to one side of the lure by at least this, m, or this share of
// how far off the lure is, whichever is more, and this much either way along the cast.
// And how deep, m.
const SIDE_LEAST = 5;
const SIDE_SHARE = 0.55;
const SIDE_MORE = [0, 2.5];
const ALONG = [-2, 4];
const BRING_DEPTH = [-2.6, -1.2];
// What the view cannot see: further than this off its line, radians, or further away
// than this, m. The picture reaches 13.5 degrees to either side; the rest is margin for
// reckoning from the rod tip and not the eye, which is this far behind it, m.
const UNSEEN_OFF = 24 * Math.PI / 180;
const UNSEEN_FAR = 38;
const EYE_BEHIND = 2.2;
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
// The body sizes that pluck the line lightest and hardest in a bite.
const BITE_SIZES = [0.78, 1.4];
// A spare leaving goes down to this depth, m.
const OFF_DEPTH = -2.6;

/**
 * school: the fish, with fishes, take, giveBack, bring, dismiss and mouth. line: for its
 * tip. move: the lure's motion. out: the line out. haptics: optional. random: 0 to 1.
 */
export function createSuitors({ school, line, move, out, haptics, random }) {
  const allure = createAllure();
  const bite = createBite(random);
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
  // How many fish this cast wants round the lure, how many spares are still to be
  // brought, and seconds until the next thing to do with either.
  let wanted = 1;
  let toBring = 0;
  let nextIn = 0;
  let toppedUp = false;
  // Seconds the lure has had no fish at all, and how long that goes on before more come.
  let emptyFor = 0;
  let refillAfter = 0;
  // The fish going for the lure and for how long, the fish biting (the same one, once
  // its mouth is there), how fast the lure is going, and the fish just hooked.
  let goer = null;
  let goingFor = 0;
  let biter = null;
  let lureSpeed = 0;
  let caught = null;
  const mouth = { x: 0, y: 0, z: 0 };
  const brainMouth = { x: 0, y: 0, z: 0 };

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

  // Whether the view, looking along viewYaw from behind the rod tip, cannot see x, z.
  function unseen(x, z, viewYaw, tip) {
    const fx = Math.sin(viewYaw);
    const fz = Math.cos(viewYaw);
    const dx = x - (tip.x - fx * EYE_BEHIND);
    const dz = z - (tip.z - fz * EYE_BEHIND);
    const far = Math.hypot(dx, dz);
    const ahead = dx * fx + dz * fz;
    return far > UNSEEN_FAR || ahead <= 0 || Math.acos(Math.min(1, ahead / far)) > UNSEEN_OFF;
  }

  // Put one spare in the water out of sight, to one side of the lure, heading for it.
  // Returns false when no place out of sight was found or no spare is left.
  function bringOne(viewYaw, tip) {
    const lureFar = Math.hypot(move.x - tip.x, move.z - tip.z) + EYE_BEHIND;
    const side = random() < 0.5 ? -1 : 1;
    for (let n = 0; n < 6; n += 1) {
      const along = between(random, ALONG);
      const across = side * (n % 2 ? -1 : 1) * (Math.max(SIDE_LEAST, SIDE_SHARE * (lureFar + along)) + between(random, SIDE_MORE)) * (1 + 0.25 * (n >> 1));
      const x = move.x + homeX * along + homeZ * across;
      const z = move.z + homeZ * along - homeX * across;
      if (!unseen(x, z, viewYaw, tip)) continue;
      const fish = school.bring(x, between(random, BRING_DEPTH), z, Math.atan2(move.x - x, move.z - z), brain);
      if (!fish) return false;
      newMind(fish, true, 'near');
      return true;
    }
    return false;
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

  // Frighten a fish by so much. It bolts if that is more than it has the nerve for,
  // and stays if not. Returns whether it bolted.
  function scare(mind, fright, mayReturn = true) {
    mind.fright += fright;
    if (mind.fright <= nerveOf(mind.hunger) && mayReturn) {
      // It stays, and thinks better of the lure for now.
      if (mind.state === 'biting' || mind.state === 'coming') mind.state = 'near';
      if (goer === mind) goer = null;
      mind.interest *= AFTER_A_BITE;
      return false;
    }
    if (mind.state === 'watching') {
      // One of the school that had not come yet: it just loses interest for a while.
      minds.delete(mind.fish);
      shy.set(mind.fish, SHY_FOR);
      return true;
    }
    if (goer === mind) goer = null;
    mind.state = 'fleeing';
    mind.mayReturn = mayReturn;
    mind.flee.begin(mind.fish, mind.fright);
    return true;
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
    toBring = 0;
    for (const other of [...minds.values()]) {
      if (other.state === 'leaving' || other.state === 'fleeing') {
        other.mayReturn = false;
        continue;
      }
      other.fright = Math.max(HOOKED_FRIGHT, other.fright + frightBeside(farFromLure(other.fish)));
      scare(other, 0, false);
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
    // How many fish this file has in hand, and how many of them are spares in the water.
    get around() {
      let n = 0;
      for (const mind of minds.values()) if (mind.state !== 'watching') n += 1;
      return n;
    },
    get sparesIn() {
      let n = 0;
      for (const mind of minds.values()) if (mind.spare) n += 1;
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
      wanted = Math.min(MOST, Math.floor(between(random, [WANTED[0], WANTED[1] + 1])));
      toBring = 0;
      toppedUp = false;
      nextIn = TOP_UP_AFTER;
      emptyFor = 0;
      refillAfter = between(random, COME_AFTER);
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
      if (open && minds.size < MOST) {
        for (const fish of school.fishes) {
          if (fish.state !== 'free' || minds.has(fish) || shy.has(fish)) continue;
          if (farFromLure(fish) > NOTICE) continue;
          newMind(fish, false, 'watching');
          if (minds.size >= MOST) break;
        }
      }
      // With too few near, spares make up the number, one at a time. With none left at
      // all, after a while the number is made up afresh.
      if (open) {
        if (toBring > 0) {
          nextIn -= dt;
          if (nextIn <= 0) {
            if (bringOne(viewYaw, tip)) toBring -= 1;
            nextIn = between(random, BRING_EVERY);
          }
        } else if (!toppedUp) {
          nextIn -= dt;
          if (nextIn <= 0) {
            toBring = Math.max(0, wanted - live());
            toppedUp = true;
            nextIn = 0;
          }
        } else if (live() === 0) {
          emptyFor += dt;
          if (emptyFor >= refillAfter) {
            wanted = Math.min(MOST, Math.floor(between(random, [WANTED[0], WANTED[1] + 1])));
            toBring = wanted;
            nextIn = 0;
            emptyFor = 0;
            refillAfter = between(random, COME_AFTER);
          }
        } else emptyFor = 0;
      }
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
        bite.begin(mind.hunger, taste(lureSpeed), (fish.size - BITE_SIZES[0]) / (BITE_SIZES[1] - BITE_SIZES[0]));
        began = true;
      }
      if (!goer && keenest) {
        goer = keenest;
        goingFor = 0;
        keenest.state = 'coming';
      }
      const what = biter ? bite.step(dt, taken) : null;
      if (what === 'knock') haptics?.playTransient(bite.knock.intensity, bite.knock.sharpness);
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
        const was = biter;
        if (was) {
          const fright = bite.kind === 'light' ? FRIGHT.nipped : FRIGHT.missed;
          endBite();
          was.biteIn = between(random, BITES_AGAIN);
          was.state = 'near';
          scare(was, fright);
        }
        for (const mind of [...minds.values()]) {
          if (mind === was || mind.state === 'fleeing' || mind.state === 'leaving') continue;
          const far = farFromLure(mind.fish);
          if (far < NEAR) scare(mind, frightBeside(far));
        }
        return '';
      }
      if (what === 'drawn') {
        const was = biter;
        endBite();
        was.biteIn = between(random, BITES_AGAIN);
        was.state = 'near';
        scare(was, FRIGHT.drawn);
        return '';
      }
      // In its mouth the lure goes where the mouth goes, and the line with it: finger up
      // it runs after the fish, finger down what is wound is the lure being drawn
      // through its lips. Either way there is as much line out as reaches the fish.
      if (biter && bite.held) {
        school.mouth(biter.fish, mouth);
        move.place(mouth.x, mouth.y, mouth.z);
        out.pay(move.gap(tip) - out.length);
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
      const fx = Math.sin(viewYaw);
      const fz = Math.cos(viewYaw);
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
        // Off to the side of the picture it is nearer to, and a little away.
        const side = (fish.x - tip.x) * fz - (fish.z - tip.z) * fx >= 0 ? 1 : -1;
        mind.offX = fz * side + fx * 0.3;
        mind.offZ = -fx * side + fz * 0.3;
      }
    },

    // The lure is out of the water, or the cast is over: every fish goes.
    scatter() {
      open = false;
      toBring = 0;
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
      toppedUp = true;
      toBring = 0;
      emptyFor = 0;
      refillAfter = between(random, COME_AFTER);
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
