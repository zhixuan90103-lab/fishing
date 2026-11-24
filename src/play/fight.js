/**
 * A hooked fish: how hard it pulls right now, and what that costs it.
 *
 * Owns: its runs and rests, its two stores (burst and stamina), the pull of a run and of
 * a rest, and how fast that pull takes line or has to be dragged.
 * Does not own: what the fish does with the pull, which way it faces or where it goes on
 * the line (onLine.js); which way a run heads across the line, or how it takes to where
 * it is (course.js); the line, its length or its tension (line.js, lineOut.js); how fast
 * line comes in or when it runs out (haul.js); how a fish swims (src/fish/swim.js); when
 * it is hooked or landed (catch.js). Every number that differs from fish to fish is
 * handed in (fishKind.js).
 * No Three, no scene: it runs in Node. Rule: docs/FISHING-REQUIREMENTS.md sections 10, 11.
 * Design: docs/PLAY.md section 8.
 *
 * Nothing here runs on a clock, and nothing counts rounds.
 *
 * Two stores. Its burst is what one run spends: a run ends when it is gone, and the next
 * begins when enough of it is back. Its stamina is the whole fight's. What spends both is
 * the effort it puts out, more the more the line stands against it and more the more worn
 * it already is. So held hard a run is over sooner and takes less line, and let run on a
 * free reel it goes on and on; either way the run costs it the same.
 *
 * A fight is a handful of rounds, each weaker than the last. Every run spends a run's
 * worth of burst and the same cost comes off its stamina, so each run takes it down a
 * step. Its pull follows its stamina evenly. And the more worn it is the sooner the same
 * effort empties it, so each run is shorter than the last and takes less line, until it
 * cannot take line at all; worn right out it only kicks.
 *
 * Resting it is not limp. While it has anything left it hangs back against the line, and
 * that pull is what keeps the line tight and the rod bent through a rest. It goes with
 * its stamina: worn right out it pulls with nothing but the little it weighs in water.
 * Its stamina goes three ways: running it loses it, resting on a line that only holds it
 * it gets a little back, resting and hauled along it gets less back and the hauling
 * costs it.
 *
 * Units: seconds, newtons.
 */

import { between, toward } from './maths.js';

// ---------------------------------------------------------------- stamina and burst

// Stamina runs from 1, fresh, to 0. What a second of all it has costs a fresh fish
// against a line that holds it, times the fish's `tire`. And what a second of putting
// out nothing gives back.
const TIRE_FLAT_OUT = 0.2;
const RECOVER = 0.012;
// Pulling against nothing, on a free reel or a slack line, costs it this share of what
// pulling against a line that holds it does. Lower and a fish let run tires less.
const FREE_COSTS = 0.35;
// How much of its fresh self a fish worn right out still is, as a share: a run lasts it
// by this much, and a rest is this much slower.
const WORN_OUT = 0.3;
// Hauled through the water at rest by a line pulling harder than it is, it loses this
// much stamina a second for each newton the line has over its own pull, times its
// `tire`. With RECOVER this is what makes a rest that is wound through cost it a little,
// where a rest left alone gives a little back.
const HAUL_COSTS = 0.0015;
// Drawn along by the line it gets its burst back more slowly: by as much as the line's
// pull, with this many newtons added, is more than its own resting pull with the same
// added. Lower and winding a resting fish in holds off its next run for longer.
const DRAWN_EASY = 12;
// Each rest it bolts a little sooner or later than its nature says: this much either way.
const GO_VARIES = 0.1;

// ---------------------------------------------------------------- its pull

// The pull of a run follows stamina to this power. 1 fades evenly: every round pulls less
// than the last by about the same.
const RUN_FADE = 1;
// Resting it hangs back with this share of its fresh run, times its stamina, on top of
// what it weighs in the water (fishKind.js `rest`).
const HANGS_BACK = 0.17;
// How fast the pull comes on at the start of a run, 1/s. A snatch: the rod goes into its
// deep bend at once.
const FORCE_ON = 14;
// At the end of a run the fish gives up: this share of the pull goes at once, at GIVE_UP,
// 1/s, and the rod tip kicks up. The rest eases off at FORCE_OFF into the shallow bend.
// That drop is what tells the hand it can wind now.
const GIVE_SHARE = 0.7;
const GIVE_UP = 16;
const FORCE_OFF = 2.5;
// The pull it takes to move the fish through the water, N per m/s. Winding it in, or
// swinging the rod away from it, costs this much tension per m/s.
export const BODY_DRAG = 9;
// Bolting, it is swimming, not being dragged: line runs out at what its pull has over the
// reel's hold, divided by this, N per m/s. Lower and a run takes line faster.
const BOLT_DRAG = 18;

// ---------------------------------------------------------------- looks only

// Resting, it gives a flick of its body every so often, between these, s, this long, s,
// and this hard, as a tail effort, times its stamina. Nothing of it reaches the line.
const FLICK_EVERY = [1.1, 3.2];
const FLICK_FOR = 0.3;
const FLICK = 0.6;

export function createFight(random = Math.random) {
  // The fish on the line: see fishKind.js for the fields.
  let kind = { runFresh: 0, runSpent: 0, rest: 0, tire: 1, burst: 1, recover: 1, goAt: 0.6 };
  // What the pull has over the resting pull, in two parts: one goes at once when a run
  // ends, the other eases off.
  let quick = 0;
  let slow = 0;
  let running = false;
  // How much of a run it has to have back before it bolts again, this rest.
  let goAt = 1;
  // Looks only: seconds until its next flick, and seconds of this one left.
  let flickIn = 0;
  let flicking = 0;

  const fight = {
    // How hard the fish is pulling right now, N.
    force: 0,
    // 1 fresh, 0 worn out.
    stamina: 1,
    // What it has left of a run, 0 to 1.
    burst: 1,
    // Whether it is in a run.
    get running() {
      return running;
    },
    // How hard it is working, 0 to 1, for its tail: its pull against the most it has
    // fresh, so a fresh run is flat out whatever speed the line lets it make and a rest
    // is next to nothing. Or the flick it is giving, if that is more.
    get effort() {
      return Math.max(kind.runFresh > 0 ? Math.min(1, fight.force / kind.runFresh) : 0, flicking > 0 ? FLICK * fight.stamina * Math.sin(Math.PI * flicking / FLICK_FOR) : 0);
    },

    // Just hooked: it runs at once. fish: its numbers, from fishOf() in fishKind.js.
    begin(fish) {
      kind = fish;
      quick = 0;
      slow = 0;
      fight.force = kind.rest + HANGS_BACK * kind.runFresh;
      fight.stamina = 1;
      fight.burst = 1;
      running = true;
      flickIn = between(random, FLICK_EVERY);
      flicking = 0;
    },

    /**
     * Once a frame: what its pull costs it, the run ending or the next beginning, and the
     * pull following that. tension: how hard the line is pulling now, N. uneasy: how much
     * less of a run it waits to have back before it bolts again, as a share, 0 to 1: its
     * own unease at where it is (course.js), not anything this file knows about.
     * braced: the share of its swimming a rod carried against it has turned straight
     * against the line (sideStrain.js), 0 to 1: that much of its effort is met in full.
     * Returns true on the frame a run begins.
     */
    step(dt, tension = 0, uneasy = 0, braced = 0) {
      if (!(dt > 0)) return false;
      // What it can pull now, worn as it is: a run is all of that, whatever it has come
      // down to.
      const able = kind.runSpent + (kind.runFresh - kind.runSpent) * fight.stamina ** RUN_FADE;
      // What it pulls with at rest: its weight in the water and its hanging back. Effort
      // is what it puts out over that, and `met` how much of its pull the line stands against.
      const idle = kind.rest + HANGS_BACK * kind.runFresh * fight.stamina;
      const exert = able > idle ? Math.min(1, Math.max(0, fight.force - idle) / (able - idle)) : 0;
      const held = fight.force > 1e-6 ? Math.min(1, Math.max(0, tension) / fight.force) : 0;
      const met = held + (1 - held) * Math.min(1, Math.max(0, braced));
      // What a second of this takes out of it. The more worn it is the more that is: the
      // same effort empties a tired fish sooner.
      const worn = WORN_OUT + (1 - WORN_OUT) * fight.stamina;
      const cost = exert * (FREE_COSTS + (1 - FREE_COSTS) * met) / worn;
      // Three ways it goes with its stamina. Running, it loses it. Resting on a line
      // that only holds it, it gets a little back. Resting and drawn along, the line is
      // pulling harder than it is: it gets less back, and being hauled through the water
      // costs it, so wound in as it rests it goes on losing a little.
      const drawn = (idle + DRAWN_EASY) / (Math.max(tension, idle) + DRAWN_EASY);
      const hauled = running ? 0 : Math.max(0, tension - fight.force);
      fight.stamina += (RECOVER * (1 - exert) * drawn - kind.tire * (TIRE_FLAT_OUT * cost + HAUL_COSTS * hauled / worn)) * dt;
      fight.stamina = Math.min(1, Math.max(0, fight.stamina));
      let began = false;
      if (running) {
        fight.burst -= (cost / kind.burst) * dt;
        if (fight.burst <= 0) {
          fight.burst = 0;
          running = false;
          goAt = kind.goAt + (random() * 2 - 1) * GO_VARIES;
        }
      } else {
        // It gets its burst back hanging on the line, slower while the line draws it
        // along, and slower the more worn it is: it rests longer between runs the longer
        // the fight has gone on.
        fight.burst = Math.min(1, fight.burst + (dt / kind.recover) * Math.sqrt(worn) * drawn);
        if (fight.burst >= goAt * (1 - uneasy)) {
          running = true;
          began = true;
        }
      }
      // What a run has over the resting pull, split into the part that goes at once when
      // the fish gives up and the part that eases off.
      const over = running ? Math.max(0, able - idle) : 0;
      const quickTo = over * GIVE_SHARE;
      const slowTo = over - quickTo;
      quick = toward(quick, quickTo, quickTo > quick ? FORCE_ON : GIVE_UP, dt);
      slow = toward(slow, slowTo, slowTo > slow ? FORCE_ON : FORCE_OFF, dt);
      fight.force = idle + quick + slow;
      // Looks only.
      if (running) flicking = 0;
      else if (flicking > 0) flicking -= dt;
      else {
        flickIn -= dt;
        if (flickIn <= 0) {
          flicking = FLICK_FOR;
          flickIn = between(random, FLICK_EVERY);
        }
      }
      return began;
    },

    // How fast it is taking line off a reel that holds `holds` newtons, m/s. Pulling
    // harder than the reel holds, there is nowhere the line stops it: it takes line as
    // fast as what its pull has over the hold can drive it through the water.
    bolt(holds) {
      return Math.max(0, fight.force - holds) / BOLT_DRAG;
    },

    // The pull on the line that holds it while line comes in at `winding`, m/s: its own,
    // and what it takes to draw it through the water that fast, N. This is where the
    // line's tension settles, short of what the reel gives line at.
    draws(winding) {
      return fight.force + BODY_DRAG * winding;
    },
  };
  return fight;
}
