/**
 * A hooked fish: how hard it pulls right now, and how that pull sets it against the line.
 *
 * Owns: the fish's runs and rests, its stamina, the force of each run, how fast it takes
 * line, and the aim of a fish on a line: out, in or held, how deep, how sharply.
 * Does not own: which way a run heads across the line (course.js): catch.js hands in the
 * sideways speed that comes to. Nor the line, its
 * length or its tension (line.js, lineOut.js), how fast line comes in or when it runs
 * out (haul.js), how a fish swims (src/fish/swim.js), when the fish is hooked or landed
 * (catch.js).
 *
 * A big fish, fresh, pulls harder than the reel holds, so its runs take line. A small one
 * never pulls that hard. Which it is, and every number that differs from fish to fish,
 * is handed in: fishKind.js.
 *
 * Nothing here runs on a clock. A fish has two stores. Its burst is what one run spends:
 * a run ends when it is gone, and the next begins when enough of it is back. Its stamina
 * is the whole fight's: it only goes down, and with it go the force of a run and how much
 * burst can come back. What spends both is the pull the fish itself puts out, and more of
 * it the more the line stands against that pull: held hard, a run is over sooner, takes
 * less line and costs the fish more, and let run on a free reel it goes on and on. That is
 * all the reward there is for holding a fish, and all the reason there is to.
 * Resting, its burst comes back, slower while the line is drawing it along.
 *
 * The two halves must look different on the fish itself, before any haptics. A run is a
 * bolt for its life: it comes on at once, fast, out and away and diving. A rest is a
 * sulk: it all but stops, hanging on the line near the top, and only comes in because
 * the line leads it. Now and then a rest is cut short and it bolts again.
 * No Three, no scene: it runs in Node. Rule: docs/FISHING-REQUIREMENTS.md sections 10, 11.
 * Design: docs/PLAY.md section 8.
 *
 * The fish is never moved by the line. It is told how far the line is stretched, and
 * swims to where the stretch would hold it: the distance at which the line pulls as hard
 * as it does. Further out than that it turns and comes in, nearer it heads away, and
 * there it swims across, round the rod on a tight line. So the line stays tight between
 * runs, and winding it in leads the fish in head first.
 *
 * So who moves whom goes by the difference between the line's pull and its own: slack,
 * it comes for a small pull, and pulling, it takes a harder one to bring it the same way.
 * And there is no leading it by where the rod points. The line draws it toward the rod
 * tip, wherever the tip is, and that is all the lead there is.
 *
 * It cannot stop and go back the way it came. Brought round by the line it swings round
 * in an arc, nose first, keeping way on: the tighter the slower it is going.
 *
 * It chases that place, it is not pushed by the difference in force. A short line is
 * stiff, and a fish answering the force itself overshoots and is snatched back, harder
 * the shorter the line. Chasing a place settles the same however stiff the line is.
 *
 * Units: metres, seconds, newtons. Level directions are (x, z).
 */

import { between, toward } from './maths.js';

// How hard it pulls in a run and between runs, how fast it tires and how long it runs
// are the fish's own: begin() is handed them (fishKind.js). The rest are the same for
// every fish.

// Stamina runs from 1, fresh, to 0. What a second of pulling as hard as it ever can
// costs it against a line that holds it, times the fish's `tire`: a lesser pull costs
// that share of it. And what a second of not pulling at all would give back.
const TIRE_FLAT_OUT = 0.2;
const RECOVER = 0.012;
// Pulling against nothing, on a free reel or a slack line, costs it this share of what
// pulling against a line that holds it does. Lower and a fish let run tires less.
const FREE_COSTS = 0.35;
// Drawn along by the line it gets its burst back more slowly: by as much as the line's
// pull, with this many newtons added, is more than its own resting pull with the same
// added. Lower and winding a resting fish in holds off its next run for longer.
const DRAWN_EASY = 2;
// The most of a run's burst it can get back, worn right out, as a share: fresh, all of it.
const BURST_SPENT = 0.3;
// Each rest it bolts a little sooner or later than its nature says: this much either way.
const GO_VARIES = 0.1;
// A run keeps most of its force until the fish is nearly spent, then it goes quickly:
// the force follows stamina to this power. 1 would fade evenly.
const RUN_FADE = 0.6;
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
const BODY_DRAG = 1.5;
// Bolting, it is swimming, not being dragged: line runs out at what its pull has over the
// reel's hold, divided by this, N per m/s. Lower and a run takes line faster.
const BOLT_DRAG = 1.1;
// How soon it is where the line holds it, s. Lower follows the line more tightly and
// overshoots more at low frame rates. Higher, it gives way later to a rod swung against it.
const SETTLE_IN = 0.4;
// On a line gone slack it is back where the line holds it this soon, s. A stiff line is
// slack for want of a few centimetres, and a fish that crept back to it at its settling
// pace left the line hanging loose for a third of a second in the middle of a run.
const SLACK_TAKEN_IN = 0.08;
// It may go this much faster than the line's hold lets its pull carry it, m/s.
const SLACK_SPEED = 0.3;
// The fastest the line can lead it in, m/s.
const LED_MAX = 1.6;
// Turning back the way it came under its own power it keeps this share of its speed and
// swings round: a fish cannot stop and reverse. A fish the line is out-pulling keeps less
// of it, by as much as the line has the better of it: it is stopped first and then swung
// by the head. Being led round it swings on the rod's side, by this much, m/s. Bolting,
// it swings round on the far side, away from what pulls it.
const ARC_KEEPS = 0.6;
const TURN_INSIDE = 0.3;
// The tightest it can swing round at speed, m: about a body's length. Its turning is
// held to what that allows at the speed it is going, plus this much, rad/s, that a fish
// with no way on can still be swung by the head.
const ARC_RADIUS = 0.45;
// A fish with a long way to turn comes round at this many times its `turn`, rad/s
// (swim.js closes on a heading at a rate that goes as how far off it is, up to this).
const TURN_SWINGS = 1.2;
const PIVOT = 0.8;

// The deepest a run takes it, the depth it rests at, and the shallowest it goes, m. How
// deep a given run goes is the run's own (course.js).
const RUN_DEPTH = -2.9;
const REST_DEPTH = -0.5;
const SHALLOWEST = -0.25;
// It only dives in a run when further than DIVE_FAR from under the tip, level metres, and
// not at all inside DIVE_NEAR. Close in the line runs steeply down to it, and a dive
// there is a straight pull on a short, stiff line.
const DIVE_NEAR = 3;
const DIVE_FAR = 9;
// How sharply it turns and speeds up, in a run and at rest, 1/s.
const TURN_RUN = 7;
const TURN_REST = 3.5;
const ACCEL_RUN = 14;
const ACCEL_REST = 5;
// A line holding it harder than it is pulling stops it and swings its head round: for
// each newton the line has over its pull, it slows and turns this much faster, 1/s. This
// is what lets the rod ease the moment a run ends, and not half a second later.
const HELD_SLOWS = 5;
const HELD_TURNS = 2.5;
// How fast the line stops it, and how fast it changes depth diving and coming back up, 1/s.
const SLOW = 8;
const RISE_RUN = 2.2;
const RISE_REST = 0.9;
// Looks only: resting, it gives a flick of its body every so often, between these, s,
// this long, s, and this hard, as a tail effort. Nothing of it reaches the line.
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

    // Just hooked: it runs at once. fish: its numbers, from fishOf() in fishKind.js.
    begin(fish) {
      kind = fish;
      quick = 0;
      slow = 0;
      fight.force = kind.rest;
      fight.stamina = 1;
      fight.burst = 1;
      running = true;
      flickIn = between(random, FLICK_EVERY);
      flicking = 0;
    },

    /**
     * Once a frame: what its pull costs it, the run ending or the next beginning, and the
     * pull following that. tension: how hard the line is pulling now, N.
     * Returns true on the frame a run begins.
     */
    step(dt, tension = 0) {
      if (!(dt > 0)) return false;
      // What it is putting out, against the most it ever can, and how much of that the
      // line is standing against.
      const exert = kind.runFresh > 0 ? Math.min(1, fight.force / kind.runFresh) : 0;
      const met = fight.force > 1e-6 ? Math.min(1, Math.max(0, tension) / fight.force) : 0;
      const cost = exert * (FREE_COSTS + (1 - FREE_COSTS) * met);
      fight.stamina += (RECOVER * (1 - exert) - TIRE_FLAT_OUT * kind.tire * cost) * dt;
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
        // along, and only as much of it as the fight has left it.
        const most = BURST_SPENT + (1 - BURST_SPENT) * fight.stamina;
        // A worn fish gets it back more slowly as well as getting less of it back: it
        // rests longer between runs the longer the fight has gone on.
        fight.burst = Math.min(most, fight.burst + (dt / kind.recover) * most * Math.sqrt(most) * (kind.rest + DRAWN_EASY) / (Math.max(tension, kind.rest) + DRAWN_EASY));
        if (fight.burst >= goAt * most) {
          running = true;
          began = true;
        }
      }
      // What a run has over the resting pull, split into the part that goes at once when
      // the fish gives up and the part that eases off.
      const over = running ? Math.max(0, kind.runSpent + (kind.runFresh - kind.runSpent) * fight.stamina ** RUN_FADE - kind.rest) : 0;
      const quickTo = over * GIVE_SHARE;
      const slowTo = over - quickTo;
      quick = toward(quick, quickTo, quickTo > quick ? FORCE_ON : GIVE_UP, dt);
      slow = toward(slow, slowTo, slowTo > slow ? FORCE_ON : FORCE_OFF, dt);
      fight.force = kind.rest + quick + slow;
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

    /**
     * Where the hooked fish is, seen from the rod tip: the level direction out to it,
     * into out.x, out.z, and how far, into out.far. fish and tip have x, z. With the fish
     * right under the tip the direction is (homeX, homeZ), the way the cast went.
     */
    bearing(fish, tip, homeX, homeZ, out) {
      out.x = fish.x - tip.x;
      out.z = fish.z - tip.z;
      out.far = Math.hypot(out.x, out.z);
      if (out.far > 1e-6) {
        out.x /= out.far;
        out.z /= out.far;
      } else {
        out.x = homeX;
        out.z = homeZ;
      }
      return out;
    },

    /**
     * Write the aim of the hooked fish.
     * fish: its yaw. to: its bearing from the rod tip, from bearing().
     * stretch: how much further the hook is from the tip than there is line, m. Below
     * zero the line is loose by that much. stiffness: the line's, N per metre stretched.
     * winding: how fast line is coming in, m/s. holds: the most tension the reel holds
     * before it gives line, N.
     * across: how fast it is swimming across the line, m/s, positive to the left of the
     * line out to it: its own course. toward: how fast it is rushing in at the rod, m/s,
     * or 0: its own will too, and it goes whatever the line is doing. deep: how deep this
     * run takes it, 0 to 1.
     */
    steer(fish, aim, to, stretch, stiffness, winding, holds, across, toward = 0, deep = 1) {
      const ox = to.x;
      const oz = to.z;
      // The stretch that holds it: its own pull, plus what it takes to drag it in as fast
      // as the line is coming. It swims to there, and comes in with the line meanwhile.
      const held = fight.draws(winding) / stiffness;
      // It cannot outrun what its pull has over the line's.
      const spare = Math.max(0, fight.force - stiffness * Math.max(0, stretch));
      const bolt = fight.bolt(holds);
      // On a slack line there is nothing to overshoot against: it takes the slack up as
      // fast as it can swim, and settles only once the line has it.
      const settling = (held - stretch) / (stretch < 0 ? SLACK_TAKEN_IN : SETTLE_IN) - winding;
      let away = Math.max(-LED_MAX, Math.min(spare / BODY_DRAG + SLACK_SPEED, bolt > 0 ? Math.max(bolt, settling) : settling));
      // Rushing in at the rod is its own doing: the line has no say, and goes slack.
      if (toward > 0) away = -toward;
      const nx = Math.sin(fish.yaw);
      const nz = Math.cos(fish.yaw);
      // More than a quarter turn to make. Led round by the line it swings on the rod's
      // side, as far as the line is tight. Bolting it swings on the far side, away from
      // what pulls it.
      if ((ox * away - oz * across) * nx + (oz * away + ox * across) * nz < 0) {
        if (running && !(toward > 0)) away += TURN_INSIDE;
        else away -= TURN_INSIDE * Math.min(1, Math.max(0, stretch) / Math.max(held, 1e-6));
      }
      const vx = ox * away - oz * across;
      const vz = oz * away + ox * across;
      const speed = Math.hypot(vx, vz);
      const facing = speed > 1e-6 ? Math.max(0, (vx * nx + vz * nz) / speed) : 1;
      aim.yaw = Math.atan2(vx, vz);
      // What the line's pull has over its own.
      const overheld = Math.max(0, stiffness * stretch - fight.force);
      const keeps = ARC_KEEPS * fight.force / (fight.force + overheld + 1e-9);
      aim.speed = speed * (keeps + (1 - keeps) * facing);
      const dive = Math.min(1, Math.max(0, (to.far - DIVE_NEAR) / (DIVE_FAR - DIVE_NEAR)));
      aim.y = running ? REST_DEPTH + (RUN_DEPTH - REST_DEPTH) * deep * dive * dive * (3 - 2 * dive) : REST_DEPTH;
      aim.top = SHALLOWEST;
      // However hard it is being turned, it cannot come round tighter than its speed lets it.
      const tightest = ((fish.speed || 0) / ARC_RADIUS + PIVOT) / TURN_SWINGS;
      aim.turn = Math.min((running ? TURN_RUN : TURN_REST) + HELD_TURNS * overheld, tightest);
      aim.accel = running ? ACCEL_RUN : ACCEL_REST;
      aim.slow = SLOW + HELD_SLOWS * overheld;
      aim.rise = running ? RISE_RUN : RISE_REST;
      // How hard it is working is its pull against the most it has: a fresh run is flat
      // out whatever speed the line lets it make, a rest is next to nothing.
      aim.effort = Math.max(kind.runFresh > 0 ? Math.min(1, fight.force / kind.runFresh) : 0, flicking > 0 ? FLICK * Math.sin(Math.PI * flicking / FLICK_FOR) : 0);
    },
  };
  return fight;
}
