/**
 * What a splash is made of: every bit of water one throws into the air, and the foam it
 * leaves lying on the water.
 *
 * Owns: for each kind of splash, the table of bits it throws: when each leaves, where
 * from, how fast, how big, how long it lasts and which kind of bit it is; and how wide
 * a patch of foam it leaves and for how long.
 * Does not own: the order of a splash and how tall each part of it stands (splashBurst.js:
 * these tables fill those shapes with water), what a bit looks like or where it is once
 * thrown (sprayPool.js), the foam's look (foamPatch.js), or when a splash happens.
 * No Three, no scene: it runs in Node. Design: docs/SPLASH.md section 3.
 *
 * Each part of a splash is a great many bits thrown together:
 *   in      the crown: a ring of white water thrown up and out, and drops off its lip.
 *           Then the column: a jet straight up the middle, later and higher, and the
 *           drops off its top. A breath of mist over it.
 *   out     the heap brought up with the thing: a low wide burst of white water, water
 *           flung off it sideways, and the string of drops that run off it as it rises.
 *   thrash  a low sheet torn off sideways every way, and the fan of fine drops it breaks
 *           into, further out than up.
 *
 * The tables are for a splash of size 1 (splashBurst.js bigOf). A bigger one is the same
 * table wider and thrown harder: places grow in step with the size, speeds and how long
 * a bit lasts as its root, so that how high it goes grows in step too.
 *
 * Units: metres, seconds. +Y up, the water y = 0, the splash at the origin.
 * Kinds of bit are sprayPool.js's: 0 white water, 1 a drop, 2 mist.
 */

import { shapeOf } from './splashBurst.js';

const GRAVITY = 9.81;
const WATER = 0;
const DROP = 1;
const MIST = 2;

// How the air slows each kind of bit, 1/s. A clot of fine water stops soon; a drop
// carries; mist hangs.
const DRAG = [3.2, 0.5, 5];
// How big a clot of white water is, m, radius: a splash of size 1 is a lure's.
const CLOT = [0.011, 0.024];
const FINE = [0.0018, 0.0036];
const HAZE = [0.05, 0.09];

// How many bits each kind of splash throws, by part.
const COUNT = {
  in: { crown: 64, lip: 30, jet: 44, tip: 12, mist: 3 },
  out: { heap: 260, flung: 80, drips: 56, mist: 12 },
  thrash: { sheet: 280, fan: 130, mist: 12 },
};

// The foam a splash of size 1 leaves on the water: how wide at first, m, radius, and how
// long it takes to break up, s, and how many smaller patches lie round the middle one.
const FOAM = {
  in: { radius: 0.035, life: 1.2, round: 2 },
  out: { radius: 0.13, life: 2.4, round: 4 },
  thrash: { radius: 0.15, life: 2.0, round: 4 },
};

// The speed that throws a bit this high, m/s, with a little over for the air.
const toReach = (height) => Math.sqrt(2 * GRAVITY * height) * 1.12;

export function foamOf(kind) {
  return FOAM[kind] || FOAM.in;
}

/**
 * The bits of one splash of a kind, for size 1: each { after, x, y, z, vx, vy, vz, size,
 * life, kind, drag }. Filled once from a seed: every splash of a kind is the same one
 * turned a different way.
 */
export function makeSpray(kind = 'in', seed = 7) {
  let s = seed;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const within = (range) => range[0] + (range[1] - range[0]) * rnd();
  const bits = [];
  const shape = shapeOf(kind);
  const count = COUNT[kind] || COUNT.in;
  // One bit leaving at `after` from `out` m off the middle and `y` up, thrown outward at
  // `away` m/s and up at `up`.
  const add = (bit, after, out, y, away, up, size, life, turn = rnd() * Math.PI * 2) => {
    const c = Math.cos(turn);
    const d = Math.sin(turn);
    bits.push({ after, x: c * out, y, z: d * out, vx: c * away, vy: up, vz: d * away, size, life, kind: bit, drag: DRAG[bit] });
  };

  if (kind === 'out') {
    const heap = shape.column;
    const up = toReach(heap.height);
    // The heap: white water welling up over the whole width of the thing, and falling back.
    for (let i = 0; i < count.heap; i += 1) add(WATER, 0.14 * rnd() * rnd(), heap.foot * Math.sqrt(rnd()), 0.01, 0.1 + 0.55 * rnd(), up * (0.45 + 0.75 * rnd()), within(CLOT) * 1.25, 0.5 + 0.4 * rnd());
    // Water flung off it sideways as it breaks through.
    for (let i = 0; i < count.flung; i += 1) add(DROP, 0.1 * rnd(), heap.foot * 0.8, 0.02, 0.4 + 1.1 * rnd(), up * (0.5 + 0.9 * rnd()), within(FINE), 0.9);
    // And water running off it as it rises: let go one after another, from higher and higher.
    for (let i = 0; i < count.drips; i += 1) {
      const after = 0.8 * (i + rnd()) / count.drips;
      add(DROP, after, 0.07 * Math.sqrt(rnd()), Math.min(0.32, 0.04 + 0.6 * after), 0.05 * rnd(), -0.1 * rnd(), within(FINE) * 1.3, 0.7);
    }
    for (let i = 0; i < count.mist; i += 1) add(MIST, 0.1 * rnd(), heap.foot * rnd(), 0.03, 0.2 * rnd(), 0.5 + 0.6 * rnd(), within(HAZE) * 1.3, 0.8 + 0.5 * rnd());
    return bits;
  }

  if (kind === 'thrash') {
    const sheet = shape.crown;
    // The sheet torn off sideways: low, fast, every way, ragged because it leaves over a moment.
    for (let i = 0; i < count.sheet; i += 1) {
      const speed = 0.7 + 1.7 * rnd();
      const rise = 0.08 + 0.42 * rnd();
      add(WATER, 0.07 * rnd() * rnd(), sheet.foot[0] * (0.6 + 0.8 * rnd()), 0.01, speed * Math.cos(rise), speed * Math.sin(rise), within(CLOT), 0.36 + 0.38 * rnd(), (i + rnd()) / count.sheet * Math.PI * 2);
    }
    // And the fan of fine drops it breaks into.
    for (let i = 0; i < count.fan; i += 1) {
      const speed = 1.0 + 1.7 * rnd();
      const rise = 0.2 + 0.6 * rnd();
      add(DROP, 0.06 * rnd(), sheet.foot[0], 0.015, speed * Math.cos(rise), speed * Math.sin(rise), within(FINE), 0.9, (i + rnd()) / count.fan * Math.PI * 2);
    }
    for (let i = 0; i < count.mist; i += 1) add(MIST, 0.05 * rnd(), sheet.foot[1] * 0.5 * rnd(), 0.03, 0.5 * rnd(), 0.25 + 0.3 * rnd(), within(HAZE), 0.6 + 0.4 * rnd());
    return bits;
  }

  const crown = shape.crown;
  const jet = shape.column;
  const lift = toReach(crown.height);
  const shoot = toReach(jet.height);
  // The crown: a ring of white water thrown up and outward.
  for (let i = 0; i < count.crown; i += 1) add(WATER, 0.03 * rnd(), crown.foot[0] * (0.7 + 0.9 * rnd()), 0.005, 0.12 + 0.4 * rnd(), lift * (0.55 + 0.6 * rnd()), within(CLOT) * 0.6, 0.32 + 0.3 * rnd(), (i + rnd()) / count.crown * Math.PI * 2);
  // Drops off its lip.
  for (let i = 0; i < count.lip; i += 1) add(DROP, 0.03 * rnd(), crown.foot[0] * 1.5, 0.01, 0.15 + 0.6 * rnd(), lift * (0.7 + 0.8 * rnd()), within(FINE), 0.6);
  // The column: a jet up the middle once the hole has closed, the later of it the lower.
  for (let i = 0; i < count.jet; i += 1) {
    const late = rnd();
    add(WATER, jet.after + 0.13 * late, jet.foot * 0.5 * rnd(), 0.005, 0.1 * rnd(), shoot * (1.05 - 0.55 * late) * (0.8 + 0.25 * rnd()), within(CLOT) * 0.55, 0.4 + 0.3 * rnd());
  }
  // Drops off its top as it turns over.
  for (let i = 0; i < count.tip; i += 1) add(DROP, jet.after + 0.03 + 0.1 * rnd(), jet.foot * 0.3, 0.02, 0.05 + 0.22 * rnd(), shoot * (0.85 + 0.35 * rnd()), within(FINE) * 1.2, 0.7);
  for (let i = 0; i < count.mist; i += 1) add(MIST, 0.05 + 0.1 * rnd(), crown.foot[1] * rnd(), 0.03, 0.15 * rnd(), 0.3 + 0.4 * rnd(), within(HAZE) * 0.4, 0.6 + 0.4 * rnd());
  return bits;
}

/**
 * Where one bit is `age` seconds after its splash of size `big`, into out.x, out.y,
 * out.z, and whether it is in the air into out.there. The same formula sprayPool.js
 * draws it by.
 */
export function bitAt(bit, age, big, out) {
  const t = age - bit.after;
  const fast = Math.sqrt(big);
  const gone = (1 - Math.exp(-bit.drag * t)) / bit.drag;
  out.x = bit.x * big + bit.vx * fast * gone;
  out.z = bit.z * big + bit.vz * fast * gone;
  out.y = bit.y * big + bit.vy * fast * gone - GRAVITY * (t - gone) / bit.drag;
  out.there = t >= 0 && t < bit.life * fast && out.y > -0.01;
  return out;
}
