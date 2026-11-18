/**
 * The shape of one splash over time: how tall and wide the crown is, where each drop is
 * and how big, and how wide each ring has spread.
 *
 * Owns: the table of drops thrown up by one splash, and the closed forms that say where
 * everything is `age` seconds after it.
 * Does not own: drawing (splash.js), when a splash happens or how strong (the caller), or
 * the sea itself. The ocean is not touched: this is laid on top of it.
 * No Three, no scene: it runs in Node. Design: docs/SPLASH.md.
 *
 * Nothing is integrated. Every position is a formula of the age, so a splash looks the
 * same at any frame rate and costs nothing once it is over.
 *
 * Units: metres, seconds. +Y is up, the water is y = 0. Positions are relative to where
 * the splash is.
 */

const GRAVITY = 9.81;

// Drops thrown up by one splash.
export const DROPS = 12;
// This many of them go nearly straight up, as the column in the middle.
const COLUMN = 4;
// How fast the drops leave, m/s, at full strength: upward, and outward for the crown and
// for the column. A weaker splash scales all of them down.
const UP_SPEED = [0.5, 1.25];
const CROWN_OUT = [0.06, 0.25];
const COLUMN_OUT = [0, 0.04];
// Drop radius, metres.
const DROP_SIZE = [0.004, 0.008];

// The crown: the sheet of water thrown up around the point of entry. Its height at the
// top of its rise at full strength, metres, and how long it stands, s.
const CROWN_HEIGHT = 0.06;
const CROWN_LIFE = 0.24;
// Radius of its foot when it starts and when it has fallen back, metres.
const CROWN_FOOT = [0.015, 0.05];

// The numbers above are for a 10 g lure: a plop, not a plunge. A splash far away is drawn
// a little larger than life, or it is a pixel or two. Up to this distance it is life size, metres, and beyond it
// grows in step with the distance, so it covers about the same part of the screen. Never
// more than SIZE_MAX times.
const LIFE_SIZE_WITHIN = 7;
const SIZE_MAX = 1.25;

// Rings spreading on the surface, and how long after the splash each one starts, s.
export const RINGS = 2;
const RING_DELAY = 0.14;
// How far a ring spreads at full strength, metres, and how fast it gets there, 1/s.
const RING_REACH = 0.18;
const RING_RATE = 3.2;
// A ring's width when it starts, metres. It thins to nothing over RING_LIFE seconds.
const RING_WIDTH = 0.02;
const RING_LIFE = 0.8;

// The whole splash is over after this long, s.
export const SPLASH_LIFE = RING_DELAY * (RINGS - 1) + RING_LIFE;

// How many times life size a splash this far from the eye is drawn.
export function sizeAt(distance) {
  return Math.max(1, Math.min(SIZE_MAX, distance / LIFE_SIZE_WITHIN));
}

/**
 * The crown at `age`: the radius of its foot and its height, metres, into out.radius and
 * out.height. height is 0 once it has fallen back.
 */
export function crownAt(age, strength, out) {
  const u = age / CROWN_LIFE;
  if (u <= 0 || u >= 1) {
    out.radius = 0; out.height = 0;
    return out;
  }
  out.radius = CROWN_FOOT[0] + (CROWN_FOOT[1] - CROWN_FOOT[0]) * u;
  out.height = CROWN_HEIGHT * (0.4 + 0.6 * strength) * Math.sin(Math.PI * u);
  return out;
}

function between(range, t) {
  return range[0] + (range[1] - range[0]) * t;
}

/**
 * The drops of one splash: for each, its velocity at the surface and its size. Filled
 * once, from a seed, so every splash is the same crown turned a different way.
 */
export function makeDrops(seed = 1) {
  let s = seed;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const drops = [];
  for (let i = 0; i < DROPS; i += 1) {
    const column = i < COLUMN;
    const turn = rnd() * Math.PI * 2;
    const out = between(column ? COLUMN_OUT : CROWN_OUT, rnd());
    drops.push({
      vx: Math.cos(turn) * out,
      vy: between(UP_SPEED, column ? 0.55 + 0.45 * rnd() : rnd() * 0.75),
      vz: Math.sin(turn) * out,
      size: between(DROP_SIZE, rnd()),
    });
  }
  return drops;
}

/**
 * Where one drop is `age` seconds after a splash of `strength` (0 to 1), written into
 * out.x, out.y, out.z and out.size. size is 0 once it has fallen back into the water.
 */
export function dropAt(drop, age, strength, out) {
  const k = 0.55 + 0.45 * strength;
  const vy = drop.vy * k;
  const flight = (2 * vy) / GRAVITY;
  if (age <= 0 || age >= flight) {
    out.x = 0; out.y = 0; out.z = 0; out.size = 0;
    return out;
  }
  out.x = drop.vx * k * age;
  out.y = vy * age - 0.5 * GRAVITY * age * age;
  out.z = drop.vz * k * age;
  // Full size on the way up, thinning out over the last part of the fall.
  const left = 1 - age / flight;
  out.size = drop.size * k * Math.min(1, left * 3);
  return out;
}

/**
 * Ring number `index` at `age`: its radius and width, metres, into out.radius and
 * out.width. width is 0 before it starts and after it has faded.
 */
export function ringAt(index, age, strength, out) {
  const t = age - index * RING_DELAY;
  if (t <= 0 || t >= RING_LIFE) {
    out.radius = 0; out.width = 0;
    return out;
  }
  out.radius = RING_REACH * (0.5 + 0.5 * strength) * (1 - Math.exp(-RING_RATE * t)) * (1 - 0.25 * index);
  out.width = RING_WIDTH * (1 - t / RING_LIFE);
  return out;
}
