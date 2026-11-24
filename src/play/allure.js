/**
 * How much a fish wants the lure, by what the lure is doing.
 *
 * Owns: how well a lure moving at some speed is liked, the twitch of a lure that moves
 * off after lying still, one fish's interest rising and falling with those, and the
 * levels at which it goes for the lure and gives it up.
 * Does not own: which fish are near (suitors.js), how a fish swims to the lure
 * (visit.js), what its bite is (bite.js), or the lure.
 * No Three, no scene: it runs in Node. Rule: docs/FISHING-REQUIREMENTS.md section 7.
 * Design: docs/PLAY.md section 7.
 *
 * Nobody sends a fish. Each fish near the lure has its own interest in it. A lure that
 * moves slowly draws it most, one that lies still or sinks draws it too, more slowly,
 * and one that goes off after a pause gives it a start. A lure hauled in fast puts it
 * off: its interest drains, and a fish already after the lure lets it go. A hungry fish
 * warms to a lure sooner and is put off later than a full one.
 *
 * Units: metres, seconds. Interest is 0 to 1.
 */

// A lure slower than this, m/s, is lying still. Up to SLOW_TO it is swimming slowly,
// which is liked best. From there the liking falls, and at FAST_FROM and over it is
// running away, which is disliked.
const STILL_UNDER = 0.05;
const SLOW_TO = 0.6;
const FAST_FROM = 1;
// How much a still lure draws a fish, against 1 for a slow one and -1 for a fast one.
const STILL_DRAWS = 0.25;
// How fast interest rises for a starved fish at a slow lure, 1/s, the share of that a
// full fish manages, and how fast it drains at a fast lure, with the share of that a
// starved fish holds out against.
const WARMS = 0.45;
const FULL_WARMS = 0.35;
const COOLS = 0.7;
const STARVED_COOLS = 0.5;
// A lure that has lain still this long, s, and then moves off gives every fish
// watching this much interest at once.
const PAUSED_FOR = 0.4;
const TWITCH = 0.2;
// A fish goes for the lure with its interest above this, give or take, drawn for each
// fish, and lets it go again below GIVES_UP.
const GOES_AT = 0.5;
const GOES_VARIES = 0.1;
export const GIVES_UP = 0.2;
// After a bite that came to nothing it has this share of its interest left.
export const AFTER_A_BITE = 0.45;

function smooth(t) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t * t * (3 - 2 * t);
}

/**
 * How a lure going this fast draws a fish: 1 slow, STILL_DRAWS still, -1 fast.
 */
export function draws(speed) {
  if (speed < STILL_UNDER) return STILL_DRAWS;
  if (speed <= SLOW_TO) return 1;
  return 1 - 2 * smooth((speed - SLOW_TO) / (FAST_FROM - SLOW_TO));
}

/**
 * How good a mouthful a lure going this fast looks, 0 to 1, for which bite it gets
 * (bite.js): 1 slow, STILL_DRAWS still, 0 fast.
 */
export function taste(speed) {
  return Math.max(0, draws(speed));
}

// The interest above which this fish goes for the lure, drawn with random(), 0 to 1.
export function drawGoesAt(random) {
  return GOES_AT + (random() * 2 - 1) * GOES_VARIES;
}

/**
 * The lure as every fish near it sees it. One for the cast: step it once a frame, then
 * move each fish's interest with warm().
 */
export function createAllure() {
  let stillFor = 0;

  const allure = {
    // How the lure draws a fish this frame, 1 to -1, and the start it gave them this
    // frame by moving off after a pause, 0 or TWITCH.
    draw: STILL_DRAWS,
    twitch: 0,

    // The lure has just landed.
    reset() {
      stillFor = 0;
      allure.draw = STILL_DRAWS;
      allure.twitch = 0;
    },

    // Once a frame. speed: how fast the lure is moving along the water, m/s.
    step(dt, speed) {
      allure.draw = draws(speed);
      allure.twitch = 0;
      if (speed < STILL_UNDER) stillFor += dt;
      else {
        if (stillFor >= PAUSED_FOR && allure.draw > 0) allure.twitch = TWITCH;
        stillFor = 0;
      }
    },

    /**
     * One fish's interest after this frame. interest: what it was, 0 to 1. hunger: 0
     * full to 1 starved.
     */
    warm(dt, interest, hunger) {
      const rate = allure.draw >= 0
        ? allure.draw * WARMS * (FULL_WARMS + (1 - FULL_WARMS) * hunger)
        : allure.draw * COOLS * (1 - (1 - STARVED_COOLS) * hunger);
      return Math.min(1, Math.max(0, interest + rate * dt + allure.twitch));
    },
  };
  return allure;
}
