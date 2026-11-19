/**
 * A hooked fish: how hard it pulls right now, and how that pull sets it against the line.
 *
 * Owns: the fish's runs and rests, its stamina, the force of each run, how fast it takes
 * line, and the aim of a fish on a line: out, in or held, how deep, how sharply.
 * Does not own: which way a run heads across the line (course.js), being led by the rod
 * (lead.js): catch.js hands in the sideways speed the two come to. Nor the line, its
 * length or its tension (line.js, lineOut.js), how fast line comes in or when it runs
 * out (haul.js), how a fish swims (src/fish/swim.js), when the fish is hooked or landed
 * (catch.js).
 *
 * A big fish, fresh, pulls harder than the reel holds, so its runs take line. Running
 * tires it, and so does being wound in. Left alone it gets its strength back. Tired
 * enough, its runs no longer take line and it can be brought in. A small one never pulls
 * that hard. Which it is, and every number that differs from fish to fish, is handed in:
 * fishKind.js.
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

// Stamina runs from 1, fresh, to 0. What a second of running costs, what a metre of
// being wound in costs, and what a second left alone gives back. The first two are
// multiplied by the fish's `tire`.
const TIRE_RUNNING = 0.12;
const TIRE_PER_METRE = 0.03;
const RECOVER = 0.03;
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
// A fresh run lasts between these, s, times the fish's `runFor`. A spent one this share
// of that.
const RUN_FOR = [1.6, 3.2];
const RUN_SPENT_SHARE = 0.55;
// A rest lasts between these, s. Now and then, this often, it is cut short to between the
// second pair and the fish bolts again when it seemed done.
const REST_FOR = [1.8, 4.5];
const REST_SHORT = [0.35, 0.8];
const SHORT_CHANCE = 0.25;

// The pull it takes to move the fish through the water, N per m/s. Winding it in, or
// swinging the rod away from it, costs this much tension per m/s.
const BODY_DRAG = 1.5;
// Bolting, it is swimming, not being dragged: line runs out at what its pull has over the
// reel's hold, divided by this, N per m/s. Lower and a run takes line faster.
const BOLT_DRAG = 1.1;
// How soon it is where the line holds it, s. Lower follows the line more tightly and
// overshoots more at low frame rates. Higher, it gives way later to a rod swung against it.
const SETTLE_IN = 0.4;
// It may go this much faster than the line's hold lets its pull carry it, m/s.
const SLACK_SPEED = 0.3;
// The fastest the line can lead it in, m/s.
const LED_MAX = 1.6;
// Turning back the way it came, it slows to this share of its speed, and leans its turn
// toward the rod by this much, m/s. A fish cannot stop and reverse: it swings round, and
// swinging round on the far side would yank the line.
const TURNING = 0.2;
const TURN_INSIDE = 0.3;

// Depth it swims at in a run and at rest, and the shallowest it goes, m.
const RUN_DEPTH = -1.7;
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

export function createFight(random = Math.random) {
  // The fish on the line: see fishKind.js for the fields.
  let kind = { runFresh: 0, runSpent: 0, rest: 0, tire: 1, runFor: 1 };
  // What the pull has over the resting pull, in two parts: one goes at once when a run
  // ends, the other eases off.
  let quick = 0;
  let slow = 0;
  let running = false;
  let left = 0;

  function beginRun() {
    running = true;
    left = between(random, RUN_FOR) * kind.runFor * (RUN_SPENT_SHARE + (1 - RUN_SPENT_SHARE) * fight.stamina);
  }

  const fight = {
    // How hard the fish is pulling right now, N.
    force: 0,
    // 1 fresh, 0 worn out.
    stamina: 1,
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
      beginRun();
    },

    // Once a frame: the runs and rests, stamina, and the pull following them.
    // wound: metres of line wound in this frame. Returns true on the frame a run begins.
    step(dt, wound) {
      if (!(dt > 0)) return false;
      if (running) fight.stamina -= TIRE_RUNNING * kind.tire * dt;
      else if (wound > 0) fight.stamina -= TIRE_PER_METRE * kind.tire * wound;
      else fight.stamina += RECOVER * dt;
      fight.stamina = Math.min(1, Math.max(0, fight.stamina));
      let began = false;
      left -= dt;
      if (left <= 0) {
        if (running) {
          running = false;
          left = between(random, random() < SHORT_CHANCE ? REST_SHORT : REST_FOR);
        } else {
          beginRun();
          began = true;
        }
      }
      // What a run has over the resting pull, split into the part that goes at once when
      // the fish gives up and the part that eases off.
      const over = running ? kind.runSpent + (kind.runFresh - kind.runSpent) * fight.stamina ** RUN_FADE - kind.rest : 0;
      const quickTo = over * GIVE_SHARE;
      const slowTo = over - quickTo;
      quick = toward(quick, quickTo, quickTo > quick ? FORCE_ON : GIVE_UP, dt);
      slow = toward(slow, slowTo, slowTo > slow ? FORCE_ON : FORCE_OFF, dt);
      fight.force = kind.rest + quick + slow;
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
     * line out to it: its own course and the rod's lead together.
     */
    steer(fish, aim, to, stretch, stiffness, winding, holds, across) {
      const ox = to.x;
      const oz = to.z;
      // The stretch that holds it: its own pull, plus what it takes to drag it in as fast
      // as the line is coming. It swims to there, and comes in with the line meanwhile.
      const held = fight.draws(winding) / stiffness;
      // It cannot outrun what its pull has over the line's.
      const spare = Math.max(0, fight.force - stiffness * Math.max(0, stretch));
      const bolt = fight.bolt(holds);
      const settling = (held - stretch) / SETTLE_IN - winding;
      let away = Math.max(-LED_MAX, Math.min(spare / BODY_DRAG + SLACK_SPEED, bolt > 0 ? Math.max(bolt, settling) : settling));
      const nx = Math.sin(fish.yaw);
      const nz = Math.cos(fish.yaw);
      // More than a quarter turn to make: it goes round on the rod's side.
      if ((ox * away - oz * across) * nx + (oz * away + ox * across) * nz < 0) away -= TURN_INSIDE;
      const vx = ox * away - oz * across;
      const vz = oz * away + ox * across;
      const speed = Math.hypot(vx, vz);
      const facing = speed > 1e-6 ? Math.max(0, (vx * nx + vz * nz) / speed) : 1;
      aim.yaw = Math.atan2(vx, vz);
      aim.speed = speed * (TURNING + (1 - TURNING) * facing);
      const dive = Math.min(1, Math.max(0, (to.far - DIVE_NEAR) / (DIVE_FAR - DIVE_NEAR)));
      aim.y = running ? REST_DEPTH + (RUN_DEPTH - REST_DEPTH) * dive * dive * (3 - 2 * dive) : REST_DEPTH;
      aim.top = SHALLOWEST;
      // What the line's pull has over its own.
      const overheld = Math.max(0, stiffness * stretch - fight.force);
      aim.turn = (running ? TURN_RUN : TURN_REST) + HELD_TURNS * overheld;
      aim.accel = running ? ACCEL_RUN : ACCEL_REST;
      aim.slow = SLOW + HELD_SLOWS * overheld;
      aim.rise = running ? RISE_RUN : RISE_REST;
      // How hard it is working is its pull against the most it has: a fresh run is flat
      // out whatever speed the line lets it make, a rest is next to nothing.
      aim.effort = kind.runFresh > 0 ? Math.min(1, fight.force / kind.runFresh) : 0;
    },
  };
  return fight;
}
