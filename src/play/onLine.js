/**
 * A fish on a line: what the line does to it and what it does itself.
 *
 * Owns: the aim of a hooked fish every frame. How far out the line holds it, what of its
 * motion is the line hauling it and what is its own swimming, which way its head lies at
 * rest, the turn it makes to bolt, how sharply it turns and stops.
 * Does not own: how hard it pulls or whether it is running (fight.js hands those in);
 * how deep it is, how it lies and how it works its tail (posture.js, called from here);
 * which way a run heads across the line (course.js, handed in as `across`);
 * moving the fish (src/fish/swim.js does that from the aim); the line or the reel.
 * No Three, no scene: it runs in Node. Design: docs/PLAY.md section 8.
 *
 * The line can pull and cannot push. Where it holds a fish is the distance at which it
 * pulls as hard as the fish does. Further out than that the fish is hauled in, bodily,
 * straight at the rod tip: that is the line's doing, and the fish does not turn to swim
 * that way. Nearer than that, or on a slack line, the fish goes out itself, the way it
 * faces. Across the line is its own business, and only while it runs.
 *
 * Running, it goes where it means to. A run that begins with its head the wrong way
 * begins with a turn on the spot, and then it goes.
 *
 * Resting, which way its head lies goes by one thing: whether the line is dragging it.
 * A run leaves it with its back to the rod and there it hangs. Wound in, it is pulled by
 * the mouth: its head comes round as it is hauled, and then it follows nose first.
 * Line, hook, head, tail. Given slack, a fish with anything left turns away again and
 * takes the slack back; a spent one stays where it is.
 *
 * It chases the place the line holds it; it is not pushed by the difference in force. A
 * short line is stiff, and a fish answering the force itself overshoots and is snatched
 * back, harder the shorter the line. Chasing a place settles the same however stiff.
 *
 * Units: metres, seconds, newtons, radians. Level directions are (x, z).
 */

import { BODY_DRAG } from './fight.js';
import { ROD_DOWN, createPosture } from './posture.js';

// ---------------------------------------------------------------- where the line holds it

// How soon it is where the line holds it, s. Lower follows the line more tightly and
// overshoots more at low frame rates. Higher, it gives way later to a rod swung against it.
const SETTLE_IN = 0.4;
// On a line gone slack it is back where the line holds it this soon, s. A stiff line is
// slack for want of a few centimetres.
const SLACK_TAKEN_IN = 0.08;
// It may go this much faster than the line's hold lets its pull carry it, m/s.
const SLACK_SPEED = 0.3;
// The fastest the line can haul it in, m/s.
const LED_MAX = 1.6;
// With more than a quarter turn to make it swings round to one side of straight: a
// running fish on the far side, away from what pulls it, a resting one on the rod's
// side, by this much, m/s.
const TURN_INSIDE = 0.3;

// ---------------------------------------------------------------- its head, at rest

// A run leaves it with its head this far off straight away from the rod, rad, to the
// side it is on.
const REST_SLANT = 0.5;
// How far it has to be hauled before its nose is at the rod tip, metres: worn right out,
// and fresh. A fresh fish holds its head against the line for a metre and a half; a
// spent one is round at once.
const ROUND_IN = [0.3, 1.6];
// Given slack, a fresh fish has its head away again this fast, 1/s; a worn one slower by
// its stamina, a spent one not at all.
const TURNS_BACK = 4;
// Turning under its own power at rest it keeps this share of its speed, less by as much
// as the line has the better of it.
const ARC_KEEPS = 0.6;

// ---------------------------------------------------------------- the turn to bolt

// A run that begins with its head the wrong way begins with the C-start a startled fish
// makes: the body bends into a C and the head comes round inside half a length (Domenici
// and Blake 1991, in docs/FISH-SWIM-RESEARCH.md). Until it faces within about 45 degrees
// of where it means to go (the cosine C_FACING) it keeps only C_KEEPS of the speed it
// wants, and may turn C_TURN sharply, 1/s, however slowly it is going.
const C_FACING = 0.7;
const C_KEEPS = 0.15;
const C_TURN = 5;

// ---------------------------------------------------------------- how sharply

// How sharply it turns and speeds up, in a run and at rest, 1/s.
const TURN_RUN = 7;
const TURN_REST = 2.5;
const ACCEL_RUN = 8;
const ACCEL_REST = 5;
// The tightest it can swing round at speed, m: about a body's length. Its turning is
// held to what that allows at the speed it is going or being hauled, plus PIVOT, rad/s,
// that a fish with no way on can still be swung by the head.
const ARC_RADIUS = 0.45;
const PIVOT = 0.8;
// A fish with a long way to turn comes round at this many times its `turn`, rad/s
// (swim.js closes on a heading at a rate that goes as how far off it is, up to this).
const TURN_SWINGS = 1.2;
// A line holding a running fish harder than it is pulling stops it and swings its head
// round: for each newton the line has over its pull, it slows and turns this much
// faster, 1/s. This is what lets the rod ease the moment a run ends.
const HELD_SLOWS = 5 / 6;
const HELD_TURNS = 2.5 / 6;
// How fast the line stops it, 1/s.
const SLOW = 8;

/** fight: the fish's pull (fight.js): force, stamina, running, effort, bolt(), draws(). */
export function createOnLine(fight) {
  // How deep it is, and how it lies and works its tail.
  const posture = createPosture();
  // Which side its head hangs off to this rest, 1 left, -1 right, 0 not picked yet.
  let restSide = 0;
  // How far the line has brought its head round this rest, 0 back to the rod to 1 nose
  // at the rod tip, and how far it was from under the tip when that was last reckoned.
  let led = 0;
  let farWas = -1;

  return {
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
     * Write the aim of the hooked fish. Call once a frame, from its brain.
     * fish: its yaw. to: its bearing from the rod tip, from bearing().
     * stretch: how much further the hook is from the tip than there is line, m. Below
     * zero the line is loose by that much. stiffness: the line's, N per metre stretched.
     * winding: how fast line is coming in, m/s. holds: the most tension the reel holds
     * before it gives line, N.
     * across: how fast it is swimming across the line, m/s, positive to the left of the
     * line out to it: its own course. dt: the frame, s. rod: what a raised rod is
     * doing to it (highRod.js), with lifts, how much of the way up to the top of the
     * water it is bringing it, 0 to 1, and rides, how far up of there its spring has
     * it, m.
     */
    steer(fish, aim, to, stretch, stiffness, winding, holds, across, dt = 0, rod = ROD_DOWN) {
      const running = fight.running;
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
      const nx = Math.sin(fish.yaw);
      const nz = Math.cos(fish.yaw);
      // More than a quarter turn to make. Led round by the line it swings on the rod's
      // side, as far as the line is tight. Bolting it swings on the far side, away from
      // what pulls it.
      if ((ox * away - oz * across) * nx + (oz * away + ox * across) * nz < 0) {
        if (running) away += TURN_INSIDE;
        else away -= TURN_INSIDE * Math.min(1, Math.max(0, stretch) / Math.max(held, 1e-6));
      }
      // Coming nearer the rod is the line's doing, not the fish's: it is hauled, bodily,
      // straight toward the tip, and does not turn its head that way to swim in. What it
      // swims is the rest: out, and across.
      const hauled = Math.min(0, away);
      const out = Math.max(0, away);
      aim.towX = ox * hauled;
      aim.towZ = oz * hauled;
      if (running) {
        restSide = 0;
        led = 0;
        farWas = -1;
      }
      let vx = ox * out - oz * across;
      let vz = oz * out + ox * across;
      if (!running) {
        // Resting, its head is where the line has brought it. `off` is how far it is from
        // straight away, rad. The side is picked once a rest, as its head lies when the
        // run ends.
        if (!restSide) restSide = ox * nz - oz * nx >= 0 ? 1 : -1;
        // Every metre it is hauled nearer brings its head round by so much. Nothing else
        // does: left alone it stays as it is.
        if (farWas >= 0 && to.far < farWas) led = Math.min(1, led + (farWas - to.far) / (ROUND_IN[0] + (ROUND_IN[1] - ROUND_IN[0]) * fight.stamina));
        farWas = to.far;
        // Given slack, what was holding it is gone. With anything left it turns its head
        // away again and goes, the way it was hanging back all along, until the line has
        // it once more. Worn out it has nothing to go with, and stays where it is.
        const loose = stretch < 0;
        if (loose) led = Math.max(0, led - TURNS_BACK * fight.stamina * dt);
        const off = REST_SLANT + (Math.PI - REST_SLANT) * led * led * (3 - 2 * led);
        const hx = ox * Math.cos(off) - oz * Math.sin(off) * restSide;
        const hz = oz * Math.cos(off) + ox * Math.sin(off) * restSide;
        // Going out, it swims the way it faces, as fast as its pull carries it. With its
        // head brought round to the rod it cannot go out, and does not.
        const swims = Math.cos(off) > 0.2 ? out : 0;
        vx = hx * swims;
        vz = hz * swims;
        aim.yaw = Math.atan2(hx, hz);
      } else if (vx * vx + vz * vz > 0.0025) aim.yaw = Math.atan2(vx, vz);
      else aim.yaw = Math.atan2(ox, oz);
      const speed = Math.hypot(vx, vz);
      const facing = speed > 1e-6 ? Math.max(0, (vx * nx + vz * nz) / speed) : 1;
      // What the line's pull has over its own.
      const overheld = Math.max(0, stiffness * stretch - fight.force);
      const keeps = ARC_KEEPS * fight.force / (fight.force + overheld + 1e-9);
      // Bolting with its head the wrong way it does not charge off the way it faces and
      // come round in a sweep. It throws its head round first, hardly moving, and goes
      // when it is pointing where it means to go.
      const turning = running && facing < C_FACING;
      const faced = Math.min(1, facing / C_FACING);
      aim.speed = running
        ? speed * (C_KEEPS + (1 - C_KEEPS) * faced * faced * (3 - 2 * faced))
        : speed * (keeps + (1 - keeps) * facing);
      // How deep, and how it lies and works its tail there: posture.js.
      posture.step(fish, aim, ox, oz, dt, rod, overheld / (fight.force + overheld + 1e-9), to.far, fight.effort);
      // However hard it is being turned, it cannot come round tighter than its speed lets it.
      // Hauled by the mouth it is swung as fast as it is hauled.
      const tightest = (Math.max(fish.speed || 0, -hauled) / ARC_RADIUS + PIVOT) / TURN_SWINGS;
      // On a line gone slack a resting fish with something left throws its head round as
      // it does to bolt: nothing is holding it by the mouth.
      const freed = !running && stretch < 0 ? C_TURN * fight.stamina : 0;
      // Resting it comes round to hang back unhurriedly. Only a running fish is swung
      // harder the harder the line holds it.
      aim.turn = running ? Math.min(TURN_RUN + HELD_TURNS * overheld, turning ? Math.max(tightest, C_TURN) : tightest) : Math.max(Math.min(TURN_REST, tightest), freed);
      aim.accel = running ? ACCEL_RUN : ACCEL_REST;
      aim.slow = SLOW + HELD_SLOWS * overheld;
    },
  };
}
