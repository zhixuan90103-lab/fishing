/**
 * The shape of one splash over time: the crown, the column that jumps up in the middle,
 * and where each drop is and how big.
 *
 * Owns: the three kinds of splash, the table of drops each throws, and the closed forms
 * that say where everything is `age` seconds after it.
 * The crown and the column are a skeleton, not things that are drawn (they were, as a
 * ring and a spike, until 2026-11-25): splashSpray.js throws white water to fill them,
 * as high and as late as they say. The drops here are the few that are followed one by
 * one, so that each can ring where it lands.
 * Does not own: what a splash is made of (splashSpray.js), drawing (sprayPool.js), when a splash happens, how strong or of which kind
 * (the caller), the rings on the water (rippleField.js), or the sea itself. The ocean is
 * not touched: this is laid on top of it.
 * No Three, no scene: it runs in Node. Design: docs/SPLASH.md section 3.
 *
 * Something going into the water ('in') does four things, in this order. A thin crown of
 * water is thrown up round it and falls back. The hole it leaves closes, and where it
 * closes a column of water jumps up in the middle, higher than the crown and a moment
 * after it. The top of the column comes away as two or three drops. They fall back, and
 * each makes its own small ring where it lands.
 * Something drawn up out of the water ('out') does not hit it. It brings water up with
 * it, a low wide heap that falls back, and water runs off it: a string of drops let go
 * one after another as it rises, each from higher up, each landing with its own ring.
 * A fish thrashing at the top of the water ('thrash') neither goes in nor comes out. Its
 * tail and its flank throw the water off sideways: a low ragged sheet that flies outward
 * and breaks at once into a great many small drops, a fan of spray going every way, low
 * and far and not up. There is no column and no heap. (Until 2026-11-25 a fought fish
 * used the other two, and with its round drops it looked like something blowing bubbles.)
 *
 * Nothing is integrated. Every position is a formula of the age, so a splash looks the
 * same at any frame rate and costs nothing once it is over.
 *
 * Bigger than true, on purpose: a 10 gram lure thrown its hardest really raises a crown
 * of a few centimetres and a column of ten or so. These are about one and a half times
 * that (two and a half at first: too tall on the phone, 2026-11-25). A full cast puts it
 * 22 m off, where the true column would be half a screen point.
 *
 * Units: metres, seconds, kilograms. +Y is up, the water is y = 0. Positions are relative
 * to where the splash is.
 */

const GRAVITY = 9.81;

// The numbers below are for a thing of this weight, kg: the lure. A heavier thing makes
// a bigger splash, by the same power of its weight as it makes bigger rings
// (rippleField.js BY_WEIGHT), and no more than BIG_MOST times.
const WEIGHT = 0.01;
const BY_WEIGHT = 1 / 6;
const BIG_MOST = 2.4;

// Drops one splash can have in the air: the most any kind throws (KINDS below). The
// other kinds use the first of them and leave the rest unthrown.
export const DROPS = 26;
// Of a splash going in: this many come off the top of the column. The rest are thrown
// off the lip of the crown.
const TIP_DROPS = 3;

// The crown: the sheet of water thrown up around the point of entry. Its height at the
// top of its rise at full strength, m, and how long it stands, s.
const CROWN_HEIGHT = 0.07;
const CROWN_LIFE = 0.26;
// Radius of its foot when it starts and when it has fallen back, m.
const CROWN_FOOT = [0.02, 0.07];
// Its drops leave the lip at between these, m/s, upward and outward.
const CROWN_UP = [0.4, 1.0];
const CROWN_OUT = [0.1, 0.35];

// The column in the middle. Going in: it starts JET_AFTER s after the blow, when the
// hole has closed, stands JET_HEIGHT m at its top at full strength, is JET_FOOT m across
// at the water and lasts JET_LIFE s. Its top comes away as drops when it is this far
// through, with this much upward speed left, m/s.
const JET_AFTER = 0.09;
const JET_HEIGHT = 0.16;
const JET_FOOT = 0.03;
const JET_LIFE = 0.42;
const TIP_AT = 0.42;
const TIP_UP = [0.3, 0.7];
const TIP_OUT = [0.02, 0.1];
// Coming out: the water brought up with the thing, low and wide, from the first moment.
const HEAP_HEIGHT = 0.08;
const HEAP_FOOT = 0.09;
const HEAP_LIFE = 0.5;
// And the water running off it: drops let go over DRIP_OVER s as it rises at DRIP_RISE
// m/s, each from where it has got to, no higher than DRIP_TOP m, this far off the middle.
const DRIP_OVER = 0.75;
const DRIP_RISE = 0.6;
const DRIP_TOP = 0.32;
const DRIP_OFF = 0.07;

// Thrashing: the sheet thrown off sideways. It is this tall at the most, m, flies out
// from SHEET_FOOT[0] to SHEET_FOOT[1] m across in SHEET_LIFE s, and is gone.
const SHEET_HEIGHT = 0.05;
const SHEET_FOOT = [0.08, 0.34];
const SHEET_LIFE = 0.16;
// And the spray it breaks into: drops thrown outward at between these speeds, m/s, this
// far above the flat, radians: low. They start from the fish's flank, this far out, m,
// and are smaller than a splash's.
const SPRAY_SPEED = [1.0, 2.6];
const SPRAY_UP = [0.15, 0.6];
const SPRAY_FROM = 0.1;
const SPRAY_SIZE = [0.003, 0.006];

// Drop radius, m.
const DROP_SIZE = [0.005, 0.01];

// A splash far away is drawn a little larger than life, or it is a pixel or two. Up to
// this distance it is life size, m, and beyond it grows in step with the distance, so it
// covers about the same part of the screen. Never more than SIZE_MAX times.
const LIFE_SIZE_WITHIN = 7;
const SIZE_MAX = 1.25;

// The three kinds of splash, each from the numbers above. life: it is all over after this
// long, s. throws: how many drops. crown: the sheet round it, or none: how tall, the
// radius of its foot from first to last, how long it stands. column: what stands in the
// middle, or none: how long after the blow it starts, how tall, how wide at the foot, how
// long. root: its size grows as the root of how hard and how heavy, not in step with it.
const KINDS = {
  in: {
    life: 1.1, throws: 14, root: false,
    crown: { height: CROWN_HEIGHT, foot: CROWN_FOOT, life: CROWN_LIFE },
    column: { after: JET_AFTER, height: JET_HEIGHT, foot: JET_FOOT, life: JET_LIFE },
  },
  out: {
    life: 1.45, throws: 14, root: false,
    crown: null,
    column: { after: 0, height: HEAP_HEIGHT, foot: HEAP_FOOT, life: HEAP_LIFE },
  },
  thrash: {
    life: 0.8, throws: 26, root: true,
    crown: { height: SHEET_HEIGHT, foot: SHEET_FOOT, life: SHEET_LIFE },
    column: null,
  },
};
const kindOf = (kind) => KINDS[kind] || KINDS.in;

// The shape of a kind of splash, for what fills it with water (splashSpray.js).
export function shapeOf(kind) {
  return kindOf(kind);
}

export function lifeOf(kind) {
  return kindOf(kind).life;
}

// How many times life size a splash this far from the eye is drawn.
export function sizeAt(distance) {
  return Math.max(1, Math.min(SIZE_MAX, distance / LIFE_SIZE_WITHIN));
}

// How big a splash is for how hard the blow was, 0 to 1, and how heavy the thing, kg:
// 1 is the lure thrown its hardest. A thrashing fish's spray grows as the root of that:
// it is thrown fast already, and the speed of a drop goes with the size, so that at the
// full size the hardest drop back of a big fish flew 0.7 m up and 2.7 m out.
export function bigOf(strength, weight = WEIGHT, kind = 'in') {
  const bulk = Math.min(BIG_MOST, Math.pow(Math.max(weight, 1e-4) / WEIGHT, BY_WEIGHT));
  const big = (0.45 + 0.55 * Math.min(1, Math.max(0, strength))) * bulk;
  return kindOf(kind).root ? Math.sqrt(big) : big;
}

/**
 * The crown at `age`: the radius of its foot and its height, m, into out.radius and
 * out.height. height is 0 before it and once it has fallen back. A thing coming out of
 * the water throws none. A thrashing fish's is the low sheet it throws off sideways.
 */
export function crownAt(kind, age, big, out) {
  const crown = kindOf(kind).crown;
  const u = crown ? age / crown.life : 0;
  if (u <= 0 || u >= 1) {
    out.radius = 0; out.height = 0;
    return out;
  }
  out.radius = (crown.foot[0] + (crown.foot[1] - crown.foot[0]) * u) * big;
  out.height = crown.height * big * Math.sin(Math.PI * u);
  return out;
}

/**
 * The column in the middle at `age`: the radius of its foot and its height, m. Going in
 * it is the jet that jumps up as the hole closes; coming out it is the heap of water
 * brought up with the thing. A thrashing fish raises none. height is 0 before it and once
 * it has fallen back.
 */
export function columnAt(kind, age, big, out) {
  const column = kindOf(kind).column;
  const u = column ? (age - column.after) / column.life : 0;
  if (u <= 0 || u >= 1) {
    out.radius = 0; out.height = 0;
    return out;
  }
  // Up fast and down slower: the top of its rise is a third of the way through.
  const rise = Math.sin(Math.PI * Math.pow(u, 0.7));
  out.height = column.height * big * rise;
  out.radius = column.foot * big * (1 - 0.45 * u);
  return out;
}

function between(range, t) {
  return range[0] + (range[1] - range[0]) * t;
}

/**
 * The drops of one splash of a kind: for each, when it is let go, s, where from, how
 * fast, its size, and whether it makes a ring where it lands. Filled once, from a seed,
 * so every splash of a kind is the same one turned a different way. All for a splash of
 * size 1: dropAt scales them.
 */
export function makeDrops(kind = 'in', seed = 1) {
  let s = seed;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const drops = [];
  const throws = kindOf(kind).throws;
  for (let i = 0; i < DROPS; i += 1) {
    const turn = rnd() * Math.PI * 2;
    const size = between(DROP_SIZE, rnd());
    if (i >= throws) {
      // Not thrown by this kind.
      drops.push({ t0: Infinity, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, size: 0, rings: false });
    } else if (kind === 'thrash') {
      // Spray off the flank: outward every way, low, a few of them a little late.
      const speed = between(SPRAY_SPEED, rnd());
      const up = between(SPRAY_UP, rnd());
      const around = (i + rnd()) / throws * Math.PI * 2;
      drops.push({ t0: 0.05 * rnd() * rnd(), x: Math.cos(around) * SPRAY_FROM, y: 0.01, z: Math.sin(around) * SPRAY_FROM, vx: Math.cos(around) * speed * Math.cos(up), vy: speed * Math.sin(up), vz: Math.sin(around) * speed * Math.cos(up), size: between(SPRAY_SIZE, rnd()), rings: i % 9 === 0 });
    } else if (kind === 'out') {
      // Run off the thing as it rises: let go where it has got to, with no speed of its own.
      const t0 = DRIP_OVER * (i + rnd() * 0.8) / DROPS;
      const off = DRIP_OFF * Math.sqrt(rnd());
      drops.push({ t0, x: Math.cos(turn) * off, y: Math.min(DRIP_TOP, 0.04 + DRIP_RISE * t0), z: Math.sin(turn) * off, vx: 0, vy: 0, vz: 0, size, rings: i % 3 === 0 });
    } else if (i < TIP_DROPS) {
      // Off the top of the column, as it turns over.
      const t0 = JET_AFTER + JET_LIFE * (TIP_AT + 0.08 * i);
      const out = between(TIP_OUT, rnd());
      drops.push({ t0, x: 0, y: JET_HEIGHT * (0.92 - 0.12 * i), z: 0, vx: Math.cos(turn) * out, vy: between(TIP_UP, rnd()), vz: Math.sin(turn) * out, size: size * 1.25, rings: true });
    } else {
      // Off the lip of the crown, at once.
      const out = between(CROWN_OUT, rnd());
      drops.push({ t0: 0.02 * rnd(), x: Math.cos(turn) * CROWN_FOOT[0], y: 0, z: Math.sin(turn) * CROWN_FOOT[0], vx: Math.cos(turn) * out, vy: between(CROWN_UP, rnd()), vz: Math.sin(turn) * out, size, rings: false });
    }
  }
  return drops;
}

// How long after the splash this drop lands, s, for a splash of this size.
export function landsAt(drop, big) {
  const vy = drop.vy * big;
  return drop.t0 + (vy + Math.sqrt(vy * vy + 2 * GRAVITY * drop.y * big)) / GRAVITY;
}

/**
 * Where one drop is `age` seconds after a splash of size `big`, written into out.x,
 * out.y, out.z and out.size, and how it is moving into out.vx, out.vy, out.vz. size is
 * 0 before it is let go and once it has fallen back into the water; x and z are then
 * where it leaves from, or where it landed.
 */
export function dropAt(drop, age, big, out) {
  out.vx = 0; out.vy = 0; out.vz = 0;
  if (!(drop.size > 0)) {
    out.x = 0; out.y = 0; out.z = 0; out.size = 0;
    return out;
  }
  const lands = landsAt(drop, big) - drop.t0;
  const t = Math.max(0, Math.min(age - drop.t0, lands));
  out.x = (drop.x + drop.vx * t) * big;
  out.z = (drop.z + drop.vz * t) * big;
  if (t <= 0 || t >= lands) {
    out.y = 0; out.size = 0;
    return out;
  }
  out.y = drop.y * big + drop.vy * big * t - 0.5 * GRAVITY * t * t;
  out.vx = drop.vx * big;
  out.vy = drop.vy * big - GRAVITY * t;
  out.vz = drop.vz * big;
  // Full size for most of its way, thinning out over the last part of the fall.
  out.size = drop.size * Math.sqrt(big) * Math.min(1, (1 - t / lands) * 4);
  return out;
}
