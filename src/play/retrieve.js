/**
 * How fast line comes in while the finger is down with no fish on.
 *
 * Owns: the speed of an empty retrieve over time, and how much line that is per frame.
 * Does not own: the line's length (fishing.js applies what this returns), the reel's
 * parts (reel.js), the lure, or what happens once a fish is on.
 * No Three, no scene: it runs in Node. Rule: docs/FISHING-REQUIREMENTS.md section 7.
 *
 * Every press starts again from slow: ease in, hold slow, rise to one steady speed, stay
 * there. A press never picks up where the last one left off. On release the line does not
 * stop dead: what speed it had coasts out quickly, on its own, under any new press.
 *
 * The line taken is the exact integral of the speed, so it does not depend on frame rate.
 */

// Slow speed at the start of every press, m/s, and how long it takes to ease up to it, s.
export const SLOW_SPEED = 0.3;
const EASE_IN = 0.15;
// How long a press stays slow before it starts to speed up, counted from the press, s.
const SLOW_FOR = 0.6;
// How long the rise from slow to steady takes, s.
const RISE = 0.9;
// The steady speed, m/s. Raise it and the lure comes home sooner and pulls harder.
export const STEADY_SPEED = 1.2;
// How fast the line's speed dies after release, 1/s.
const COAST_RATE = 9;

// Integral of smoothstep from 0 to s.
function area(s) {
  return s * s * s - 0.5 * s * s * s * s;
}

function clamp01(x) {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

// Speed t seconds into a press.
function speedAt(t) {
  if (t <= 0) return 0;
  const a = clamp01(t / EASE_IN);
  const b = clamp01((t - SLOW_FOR) / RISE);
  return SLOW_SPEED * a * a * (3 - 2 * a) + (STEADY_SPEED - SLOW_SPEED) * b * b * (3 - 2 * b);
}

// Line taken t seconds into a press.
function takenAt(t) {
  if (t <= 0) return 0;
  const a = clamp01(t / EASE_IN);
  const b = clamp01((t - SLOW_FOR) / RISE);
  return SLOW_SPEED * (EASE_IN * area(a) + Math.max(0, t - EASE_IN))
    + (STEADY_SPEED - SLOW_SPEED) * (RISE * area(b) + Math.max(0, t - SLOW_FOR - RISE));
}

export function createRetrieve() {
  let since = 0;
  let pressed = false;
  let coast = 0;

  const retrieve = {
    // Line speed right now, m/s.
    speed: 0,

    // Forget everything: a new cast.
    reset() {
      since = 0;
      pressed = false;
      coast = 0;
      retrieve.speed = 0;
    },

    // Once a frame. held: the finger is down and this press counts as reeling.
    // Returns the metres of line taken in during the frame.
    step(dt, held) {
      if (!(dt > 0)) return 0;
      if (held && !pressed) since = 0;
      if (!held && pressed) coast += speedAt(since);
      pressed = held;
      const keep = Math.exp(-COAST_RATE * dt);
      let taken = coast * (1 - keep) / COAST_RATE;
      coast *= keep;
      if (held) {
        taken += takenAt(since + dt) - takenAt(since);
        since += dt;
      }
      retrieve.speed = coast + (held ? speedAt(since) : 0);
      return taken;
    },
  };
  return retrieve;
}
