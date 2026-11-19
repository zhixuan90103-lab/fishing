/**
 * Where a hooked fish means to go in a run.
 *
 * Owns: what the fish wants. Which side it tears off to and how far across, how deep it
 * dives, when it cuts to the other side, whether this run is one of the few that rush in
 * at the angler, and keeping it in the water in front of the angler.
 * Does not own: what comes of that. The line decides what it can actually do (fight.js):
 * out, if the reel gives line; round the arc the line allows, if it does not. Nor how
 * hard it pulls or when it runs and rests (fight.js), or the fish's swimming
 * (src/fish/swim.js). catch.js hands this file's answers to the rest of its aim.
 * No Three, no scene: it runs in Node. Design: docs/PLAY.md section 8.
 *
 * Where a fish runs is the fish's own business, and nobody knows it beforehand. All the
 * angler can do is hold it. It has one leaning: away from what pulls it. A rod carried to
 * its left makes it likelier to go right, and no more than likelier.
 * It never runs dead straight. And once in a long while it turns and comes at the angler,
 * and the line falls slack.
 *
 * Units: metres, seconds, radians. "Across" is positive to the left of the line from the
 * rod tip out to the fish.
 */

import { between } from './maths.js';

// Each run draws how far to the side it leans, as a share of the fish's `dash`: between
// these, to the left or to the right. Never nothing: it does not run dead straight.
const LEAN = [0.25, 1];
// With the rod carried clearly to one side of it, it goes to the other side this often.
// A half is no leaning at all.
const AWAY_OFTEN = 0.7;
// The rod is clearly to one side once it points this far off the line to the fish, radians.
const ROD_ASIDE = 8 * Math.PI / 180;
// In a run it may cut to the other side: this often, s. A bolder fish, sooner.
const DART_EVERY = [0.9, 2.6];
// Worn out, it has this share of its `dash`. And close in it has less, where the same
// speed would whip it round the rod: all of it beyond ACROSS_FAR from under the tip,
// level metres, this share at the tip.
const DASH_SPENT = 0.45;
const ACROSS_FAR = 9;
const ACROSS_NEAR_SHARE = 0.3;
// How deep a run takes it, as a share of the deepest: drawn between these each run.
const DEEP = [0.15, 1];
// It stays within this angle of the cast's direction, radians, seen from the rod tip.
// Past it, it swims back across. This keeps it in the water in front of the angler.
const KEEP_WITHIN = 40 * Math.PI / 180;
// A run rushes in at the angler this often, and only with this much stamina left. Rare:
// it is the moment a fish is lost, not the way a fish fights.
const RUSH_OFTEN = 0.07;
const RUSH_ABOVE = 0.45;
// It comes this far, m, at this share of its `dash`, and no nearer than this to under
// the tip, level metres. Then it turns and runs like any other.
const RUSH_FOR = [2, 4.5];
const RUSH_SPEED = 0.8;
const RUSH_NO_NEARER = 4;

/** random: 0 to 1, for everything a run draws. */
export function createCourse(random = Math.random) {
  // How far to one side this run leans, and which side that is, 1 or -1. Seconds until
  // it may cut to the other side. How deep it goes. And metres it has still to rush in.
  let lean = 0;
  let side = 1;
  let dartIn = 0;
  let deep = 1;
  let rush = 0;

  // Which side it goes to. rodOff: how far the rod points to the left of the line out to
  // the fish, radians. Away from the rod more often than not, when the rod is to a side.
  function pick(rodOff) {
    const leaning = Math.abs(rodOff) > ROD_ASIDE ? AWAY_OFTEN : 0.5;
    const away = rodOff > 0 ? -1 : 1;
    return random() < leaning ? away : -away;
  }

  return {
    // How deep this run takes it, 0 to 1.
    get deep() {
      return deep;
    },
    // Whether it is rushing in at the angler.
    get rushing() {
      return rush > 0;
    },

    // A run begins: it picks a side, how far to lean, how deep to go, and now and then
    // to come at the angler. bold: the fish's own, 0 to 1. stamina: 1 fresh to 0.
    begin(rodOff = 0, bold = 0.5, stamina = 1) {
      side = pick(rodOff);
      lean = side * between(random, LEAN);
      dartIn = between(random, DART_EVERY) * (1.3 - 0.6 * bold);
      deep = between(random, DEEP);
      rush = stamina > RUSH_ABOVE && random() < RUSH_OFTEN ? between(random, RUSH_FOR) : 0;
    },

    // Once a frame. running: the fish is in a run. came: how many metres nearer the rod
    // tip it got this frame. far: level metres from under the tip.
    step(dt, running, rodOff = 0, bold = 0.5, came = 0, far = 99) {
      if (!running) {
        rush = 0;
        return;
      }
      if (rush > 0) rush = far < RUSH_NO_NEARER ? 0 : Math.max(0, rush - Math.max(0, came));
      dartIn -= dt;
      if (dartIn > 0) return;
      side = pick(rodOff);
      lean = side * between(random, LEAN);
      dartIn = between(random, DART_EVERY) * (1.3 - 0.6 * bold);
    },

    // off: how far round from the cast's direction the fish is, radians, positive to the
    // left. Too far round to one side, it swims back across.
    keepInFront(off) {
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

    // How fast it is rushing in at the rod right now, m/s. 0 when it is not.
    toward(dash) {
      return rush > 0 ? dash * RUSH_SPEED : 0;
    },
  };
}
