/**
 * Which way a hooked fish's run goes.
 *
 * Owns: how far to one side each run leans, when it cuts back the other way, keeping it
 * in the water in front of the angler, and how fast all that carries it across the line.
 * Does not own: how hard it pulls or when it runs and rests (fight.js), how fast line
 * leaves (fight.js, haul.js), being led by the rod (lead.js), or the fish's swimming
 * (src/fish/swim.js). catch.js adds this file's sideways speed to the rest of its aim.
 * No Three, no scene: it runs in Node. Design: docs/PLAY.md section 8.
 *
 * A run heads out and away: straight out, or out and off to one side, never flat across
 * the angler. Further out there is more water in front of the angler, so a run that goes
 * out as well as across stays in sight.
 *
 * Units: metres, seconds, radians. "Across" is positive to the left of the line from the
 * rod tip out to the fish.
 */

import { between } from './maths.js';

// Each run draws how far to the side it leans, as a share of the fish's `dash`: between
// these, to the left or to the right. Never nothing: dead straight out every time is as
// dull as flat across.
const LEAN = [0.12, 1];
// Held by the line, with no room to go out, it does not slide off sideways at speed
// either: it gets this share of its sideways speed, and all of it once line is leaving
// at ACROSS_FULL, m/s.
const HELD_ACROSS = 0.3;
const ACROSS_FULL = 2;
// In a run that is taking line it may cut back the other way: this often, s.
const DART_EVERY = [0.9, 2.2];
// It only cuts back while line is leaving faster than this, m/s. On a held line a change
// of side is a full turn about, and that is a tired fish, not a bolting one.
const DART_NEEDS = 1.2;
// Worn out, it has this share of its `dash`. And close in it has less, where the same
// speed would whip it round the rod: all of it beyond ACROSS_FAR from under the tip,
// level metres, this share at the tip.
const DASH_SPENT = 0.45;
const ACROSS_FAR = 9;
const ACROSS_NEAR_SHARE = 0.3;
// Resting it barely moves across, m/s.
const ACROSS_REST = 0.07;
// It stays within this angle of the cast's direction, radians, seen from the rod tip.
// Past it, it swims back across. This keeps it in the water in front of the angler.
const KEEP_WITHIN = 40 * Math.PI / 180;

/** random: 0 to 1, for the lean of each run and the gaps between cuts. */
export function createCourse(random = Math.random) {
  // How far to one side this run leans, and which side that is, 1 or -1. And seconds
  // until it cuts back the other way.
  let lean = 0;
  let side = 1;
  let dartIn = 0;

  return {
    // A run begins: it picks a side and how far to lean.
    begin() {
      side = random() < 0.5 ? -1 : 1;
      lean = side * between(random, LEAN);
      dartIn = between(random, DART_EVERY);
    },

    // Once a frame. running: the fish is in a run. bolt: how fast line is leaving, m/s.
    step(dt, running, bolt) {
      if (!(running && bolt > DART_NEEDS)) return;
      dartIn -= dt;
      if (dartIn > 0) return;
      side = -side;
      lean = side * between(random, LEAN);
      dartIn = between(random, DART_EVERY);
    },

    // off: how far round from the cast's direction the fish is, radians, positive to the
    // left. Too far round to one side, it swims back across.
    keepInFront(off) {
      if (off > KEEP_WITHIN) side = -1;
      else if (off < -KEEP_WITHIN) side = 1;
    },

    /**
     * How fast it is swimming across the line right now, m/s.
     * dash: the fish's own (fishKind.js). stamina: 1 fresh to 0. bolt: how fast line is
     * leaving, m/s. far: level metres from under the rod tip.
     */
    across(running, stamina, dash, bolt, far) {
      if (!running) return ACROSS_REST * side;
      const room = Math.min(1, far / ACROSS_FAR);
      const speed = dash * (DASH_SPENT + (1 - DASH_SPENT) * stamina) * (ACROSS_NEAR_SHARE + (1 - ACROSS_NEAR_SHARE) * room);
      const going = HELD_ACROSS + (1 - HELD_ACROSS) * Math.min(1, bolt / ACROSS_FULL);
      return speed * Math.abs(lean) * going * side;
    },
  };
}
