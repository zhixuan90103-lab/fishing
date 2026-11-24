/**
 * Where a hooked fish means to go in a run.
 *
 * Owns: what the fish wants. Which side it tears off to and how far across, when it cuts
 * to the other side, how ill at ease it is near the bank, and keeping
 * it in the water in front of the angler. It never means to come at the angler: until
 * 2026-11-24 one run in fifteen did, the first after the bite included, and the line fell
 * slack by a metre or two for no reason anyone could see.
 * Does not own: what comes of that. The line decides what it can actually do (fight.js):
 * out, if the reel gives line; round the arc the line allows, if it does not. Nor how
 * hard it pulls or when it runs and rests (fight.js), or the fish's swimming
 * (src/fish/swim.js). catch.js hands this file's answers to the rest of its aim.
 * No Three, no scene: it runs in Node. Design: docs/PLAY.md section 8.
 *
 * Where a fish runs is the fish's own business, and nobody knows it beforehand. All the
 * angler can do is hold it.
 * It always means to get further from the rod: out and to one side, never dead straight,
 * left or right alike. Only once in a long while does it turn and come at the angler, and
 * the line falls slack.
 * Which side is mostly a matter of where its head is pointing when the run begins. It
 * cannot turn on the spot, so it bolts the way it is facing. And where it is facing is
 * what the line has made of it: a fish held hard is stopped and swung round by the head,
 * toward the rod tip, so a rod carried to the left of a fish that ran right brings its
 * head round to the left, and its next run goes out to the left. That is the angler's
 * hold on it, and the whole of it: nothing here reads where the rod is.
 * The rest is its own. It has a place it would be, drawn when it is hooked, and heads
 * back there the likelier the further off it is. And in the middle of a run it may cut
 * across to the other side.
 * It wants room, which here is being far off: hooked, it keeps to one depth (onLine.js).
 * Brought in close to the bank it will not lie quiet, and
 * bolts again with less of a run back: uneasy(). When that run comes is fight.js's.
 * It used to pick a side by where the rod was, away from it seven times in ten: a rod
 * left to one side sent it the same way run after run, and bringing its head round
 * showed in nothing it did next.
 *
 * Units: metres, seconds, radians. "Across" is positive to the left of the line from the
 * rod tip out to the fish.
 */

import { between } from './maths.js';

// Each run draws how far to the side it leans, as a share of the fish's `dash`: between
// these, to the left or to the right. Never nothing: it does not run dead straight.
const LEAN = [0.7, 1];
// A run sets off to the side its head points, this often when its head is clearly to
// that side. A half would be no leading at all, 1 a fish that can be steered like a cart.
const HEAD_LEADS = 0.8;
// Its head is clearly to one side once it points this far off dead ahead or dead astern,
// as a share of all the way sideways. Less than that and it leads by that much less.
const HEAD_CLEAR = 0.35;
// Cutting across in the middle of a run, it would as soon keep on the way it is going:
// it stays on its side this often, before its own place has its say.
const KEEPS_ON = 0.8;
// It has somewhere of its own it would be: a bearing off the cast's direction, drawn when
// it is hooked, within this share of KEEP_WITHIN either way. The further round from there
// it is, the likelier its next dash heads back: by this much of a chance at KEEP_WITHIN
// away from it. This is what turns it without the rod being moved: left to itself it
// works to and fro about its own place, and where that is, is its own business.
const HAUNT_WITHIN = 0.6;
const HAUNT_DRAWS = 0.3;
// In a run it may cut to the other side: this often, s. A bolder fish, sooner.
const DART_EVERY = [0.9, 2.6];
// Worn out, it has this share of its `dash`. And close in it has less, where the same
// speed would whip it round the rod: all of it beyond ACROSS_FAR from under the tip,
// level metres, this share at the tip.
const DASH_SPENT = 0.6;
const ACROSS_FAR = 7;
const ACROSS_NEAR_SHARE = 0.45;
// It stays within this angle of the cast's direction, radians, seen from the rod tip.
// Past it, it swims back across. This keeps it in the water in front of the angler.
const KEEP_WITHIN = 36 * Math.PI / 180;
// Brought in close it will not lie quiet. Inside BANK_NEAR, level metres from under the
// rod tip, it bolts again with this much less of a run back, as a share, and no sooner
// at all beyond BANK_FAR. This is the run it makes at the bank, when it looked to be in
// the hand. Higher, and a fish near the bank hardly rests at all. There is no sea bed
// here: how near the rod tip it is stands in for how shallow the water is.
const BANK_ALARMS = 0.45;
const BANK_NEAR = 3;
const BANK_FAR = 9;

/** random: 0 to 1, for everything a run draws. */
export function createCourse(random = Math.random) {
  // How far to one side this run leans, and which side that is, 1 or -1. Seconds until
  // it may cut to the other side.
  let lean = 0;
  let side = 1;
  let dartIn = 0;
  // Where it would be, and where it is as stands() was last told: radians round from the
  // cast's direction, positive to the left.
  let haunt = 0;
  let round = 0;

  // Which side it goes to. toLeft: the chance of the left before its own place has its
  // say. Back toward that place the likelier the further from it it is.
  function pick(toLeft) {
    const left = toLeft + HAUNT_DRAWS * Math.max(-1, Math.min(1, (haunt - round) / KEEP_WITHIN));
    return random() < left ? 1 : -1;
  }

  return {

    // Just hooked: it draws the place it would be.
    hooked() {
      haunt = (random() * 2 - 1) * HAUNT_WITHIN * KEEP_WITHIN;
      round = 0;
    },

    // A run begins: it picks a side and how far to lean. head: how far to the left its head points, -1 to 1: 1 is
    // square to the left of the cast's direction, 0 dead ahead or dead astern.
    // bold: the fish's own, 0 to 1.
    begin(head = 0, bold = 0.5) {
      side = pick(0.5 + (HEAD_LEADS - 0.5) * Math.max(-1, Math.min(1, head / HEAD_CLEAR)));
      lean = side * between(random, LEAN);
      dartIn = between(random, DART_EVERY) * (1.3 - 0.6 * bold);
    },

    // Once a frame. running: the fish is in a run.
    step(dt, running, bold = 0.5) {
      if (!running) return;
      dartIn -= dt;
      if (dartIn > 0) return;
      side = pick(0.5 + side * (KEEPS_ON - 0.5));
      lean = side * between(random, LEAN);
      dartIn = between(random, DART_EVERY) * (1.3 - 0.6 * bold);
    },

    // Once a frame, where the fish is: off, how far round from the cast's direction,
    // radians, positive to the left. What it picks next goes by this. And too far round
    // to one side, it swims back across at once: that is the edge of the picture.
    stands(off) {
      round = off;
      if (off > KEEP_WITHIN && side > 0) {
        side = -1;
        lean = -Math.abs(lean);
      } else if (off < -KEEP_WITHIN && side < 0) {
        side = 1;
        lean = Math.abs(lean);
      }
    },

    /**
     * How fast it means to swim across the line right now, m/s. Resting it means nothing:
     * it goes where the line takes it.
     * dash: the fish's own (fishKind.js). stamina: 1 fresh to 0. far: level metres from
     * under the rod tip.
     */
    across(running, stamina, dash, far) {
      if (!running) return 0;
      const room = Math.min(1, far / ACROSS_FAR);
      return dash * (DASH_SPENT + (1 - DASH_SPENT) * stamina) * (ACROSS_NEAR_SHARE + (1 - ACROSS_NEAR_SHARE) * room) * lean;
    },

    // How ill at ease it is where it is, 0 to 1: how much less of a run it waits to have
    // back before it bolts again. far: level metres from under the rod tip.
    uneasy(far) {
      const near = Math.min(1, Math.max(0, (BANK_FAR - far) / (BANK_FAR - BANK_NEAR)));
      return BANK_ALARMS * near * near * (3 - 2 * near);
    },
  };
}
