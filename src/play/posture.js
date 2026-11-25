/**
 * A hooked fish's posture: how deep it is, how fast it gets there, how it lies, where its
 * nose points and how hard its tail works.
 *
 * Owns: the depth a hooked fish hangs at, how a raised rod brings it up to the top of the
 * water and how it rides the rod's spring there, how it is laid over on its side and
 * rights itself, how its nose is drawn up the line, the thrash as it drops back in, and
 * what its tail does for how hard it is pulling.
 * Does not own: which way it heads, how fast, how sharply it turns (onLine.js, which
 * calls this); how hard it pulls (fight.js); how high the rod is or what its spring is
 * doing (highRod.js hands that in); moving the fish (src/fish/swim.js does that from the
 * aim); or what the water does about any of it (catch.js reports, src/shore/ shows).
 * No Three, no scene: it runs in Node. Design: docs/PLAY.md section 8.
 *
 * Everything comes in through its mouth. Left alone it hangs under the water. The line
 * comes down to it from the rod tip, so where the line has the better of it its nose is
 * drawn up; raise the rod and it is brought up to the top, head first, at the pace it
 * swims; there it rides the rod's spring, goes over on its side as its back comes out,
 * and drops back in righting itself and thrashing.
 *
 * Units: metres, seconds, radians.
 */

import { BACK_OVER } from './fishKind.js';
import { USUAL } from './highRod.js';

// A hooked fish hangs at KEEPS_DEPTH, m, from the bite to the net: run or rest, far off
// or by the boat. It gets away by going far, not by going down. It comes up only as the
// angler brings it up with a raised rod (highRod.js): all the way, it is at the top of
// the water, where it cuts the surface, throws spray and leaves a sharp wake. Hanging
// where it does the water over it only swells (docs/SPLASH.md section 9).
// The eye is 1.7 m above the water, so depth reads as distance: a fish fifteen metres off
// that goes two and a half metres down lands in the picture where one six metres off
// would be. When it dived in a run and rose to rest, every run read as a lunge at the
// camera and every rest, hauled nearer, as backing away. (Until 2026-11-24: to -2.9 in a
// run far off, -0.5 at rest. Then one depth, -0.6, then -0.35. For some hours on
// 2026-11-25 it came up by itself in every run; the angler asked for it to be the rod's
// doing.)
const KEEPS_DEPTH = -0.35;
// Held up at the top by the line, the rod holds it with its back UP_UNDER m under the
// water, and it rides the rod's spring up and down from there (highRod.js): down a
// hand's breadth when it snatches the line, up when the rod throws it back, and its back
// may come out of the water by OUT_MOST m and no more.
// Tried and thrown out the same day: swinging it up and down by the clock. It looked
// like what it was.
const UP_UNDER = 0.06;
const OUT_MOST = 0.07;
// Held up by the mouth with its back at the top of the water, a fish cannot keep upright:
// it is laid over on its side, and its flank shows. It begins to go over with its back
// within LIES_FROM m of the surface and is LIES_MOST radians over, most of the way flat,
// with its back as far out as it goes. Dropped back in, it rights itself, and drives down
// with a few great strokes of its tail: it thrashes as hard as it is falling, all out at
// FALLS m/s, and that dies away in THRASH_FOR s.
const LIES_FROM = 0.05;
// That is for a fish of this size. A bigger fish rides lower and shows less of its back,
// and begins to go over further down, as the square of its size: or it never went over
// (measured: a big fish no more than 41 to 50 degrees, a small one 80).
const LIES_SIZE = 0.8;
const LIES_MOST = 1.25;
const FALLS = 0.5;
const THRASH_FOR = 0.45;
// A hooked fish's tail works harder than its pull on the line says: it is fighting the
// hook whether or not it gets anywhere. Its tail effort is its pull's share of its
// freshest, to this power: a rest at a fifth of its pull beats at near a half, a run
// at four fifths beats at near nine tenths. (1 until 2026-11-25: resting, its tail hardly
// moved, and it looked like a model being towed.)
const TAIL_KEEN = 0.45;
// Brought up by the line it needs no speed of its own: it comes up this fast, 1/s. Nor
// going down: let down again it sinks back to where it hangs at SINKS, 1/s. (Without
// that a fish that stopped under the surface stayed there.)
const LIFTED = 14;
const SINKS = 0.8;
// That quickness is for a fish already at the top. From deeper down it is not snatched
// up: it comes up swimming, no steeper than RISE_SLOPE of the speed it is making, like
// any hooked fish coming to its depth, and a fish making no way of its own is drawn up
// by the line as if it were making DRAWN_UP m/s. (Until 2026-11-25 the quickness applied
// from any depth, and the strike is itself a raised rod: a fish hooked on the bottom was
// at the top in 0.18 s.)
const DRAWN_UP = 0.6;
const RIDES_WITHIN = 0.2;
// The rod has it once it is bringing it this much of the way up.
const HELD_UP = 0.05;
// It goes over on one side and stays on it until it is nearly upright again: under this
// much of the way over it may pick the other.
const UPRIGHT = 0.02;
// A rod carried as usual: it brings the fish up not at all.
export const ROD_DOWN = { lifts: 0, rides: 0, tip: USUAL };
// The line has it by the mouth, and its head goes where the line draws it. The line
// comes down to it from the rod tip, so wherever the line has the better of it its nose
// is drawn up: as steeply as the line lies, LED_UP times over. That is little far off,
// where the line lies nearly flat, and a good deal by the boat. Held up at the top by a
// raised rod its head is HELD_UP_NOSE radians higher again: the head comes out first.
// All told no more than NOSE_MOST radians. Falling back in and thrashing it lets go of
// that and noses down, DIVES radians at the hardest. (Until 2026-11-25 it rose and fell
// level, like a tray.)
// It is over true: a line 5 degrees off the flat tips the fish 9.
const LED_UP = 1.8;
const NOSE_MOST = 0.7;
const HELD_UP_NOSE = 0.3;
const DIVES = 0.25;
// Hooked deeper than that, on a lure left to sink, it comes up to it: this fast,
// 1/s, and no steeper than this share of the speed it is making, so it swims up and is
// not lifted.
const RISE = 0.9;
const RISE_SLOPE = 0.6;

export function createPosture() {
  // Which side it goes over on at the top, 1 its right side down, -1 its left; how hard
  // it is thrashing, 0 to 1; and how deep it was last frame.
  let lieSide = 1;
  let thrash = 0;
  let wasY = null;

  return {
    /**
     * Write the depth, the lie, the tilt and the tail of the hooked fish's aim. Once a
     * frame, from onLine.js, after it has written which way the fish heads and how fast.
     * ox, oz: the unit from the rod tip out to it. rod: what a raised rod is doing
     * (highRod.js): lifts, rides, tip. led: how much the line has the better of its own
     * pull, 0 to 1. far: how far it is from under the rod tip, m. effort: how hard it is
     * pulling, 0 to 1 (fight.js).
     */
    step(fish, aim, ox, oz, dt, rod = ROD_DOWN, led = 0, far = 1, effort = 0) {
      const lifted = rod.lifts;
      // Where it hangs, or as far up from there as the rod is bringing it, and up and down
      // of that as the rod's spring has it. The highest it may go: its back out.
      const back = BACK_OVER * (fish.size || 1);
      aim.y = KEEPS_DEPTH + (-(UP_UNDER + back) - KEEPS_DEPTH) * lifted + rod.rides;
      aim.top = OUT_MOST - back;
      // At the top, held up, it is laid over on its side: the further its back is out, the
      // further over. It goes over away from the line, whichever side it is on.
      const backUnder = Number.isFinite(fish.y) ? -fish.y - back : 1;
      const liesFrom = LIES_FROM * ((fish.size || 1) / LIES_SIZE) ** 2;
      const over = lifted * Math.min(1, Math.max(0, (liesFrom - backUnder) / (liesFrom + OUT_MOST)));
      if (over < UPRIGHT) lieSide = ox * Math.cos(fish.yaw) - oz * Math.sin(fish.yaw) >= 0 ? 1 : -1;
      aim.lie = lieSide * LIES_MOST * over * over * (3 - 2 * over);
      // Falling back in, it thrashes.
      const fell = wasY !== null && dt > 0 && Number.isFinite(fish.y) ? (wasY - fish.y) / dt : 0;
      wasY = Number.isFinite(fish.y) ? fish.y : null;
      thrash = Math.max(thrash * Math.exp(-dt / THRASH_FOR), lifted * Math.min(1, Math.max(0, fell / FALLS)));
      aim.thrash = thrash;
      // Its nose goes where the line draws it: up the line, and higher held up at the top;
      // down as it drives back under.
      const steep = Number.isFinite(fish.y) ? Math.atan2(Math.max(0, rod.tip - fish.y), Math.max(far, 0.5)) : 0;
      aim.tilt = Math.min(NOSE_MOST, LED_UP * steep * Math.max(led, lifted) + HELD_UP_NOSE * lifted) * (1 - thrash) - DIVES * thrash;

      // Coming to its depth it swims there: no steeper than its speed allows.
      const drop = Number.isFinite(fish.y) ? Math.abs(aim.y - fish.y) : 0;
      // Brought up by a raised rod it comes at its own pace too, or at the pace the line
      // draws it if it is making none of its own. Only once it is at the top, within
      // RIDES_WITHIN m of where the rod holds it, does it go with the rod's spring.
      const up = rod.lifts > HELD_UP;
      const pace = Math.max(fish.speed || 0, up ? DRAWN_UP : 0);
      aim.rise = Math.min(up ? LIFTED : RISE, RISE_SLOPE * pace / Math.max(drop, 0.05));
      if (Number.isFinite(fish.y)) {
        const near = Math.min(1, Math.max(0, 1 - drop / RIDES_WITHIN));
        if (up) aim.rise += (LIFTED - aim.rise) * near * near;
        else if (aim.y < fish.y) aim.rise = Math.max(aim.rise, SINKS);
      }
      // Its tail works harder than its pull on the line says.
      aim.effort = Math.pow(Math.min(1, Math.max(0, effort)), TAIL_KEEN);
    },
  };
}
