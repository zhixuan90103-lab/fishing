/**
 * Rings on the water: where the surface was hit, and how high it stands anywhere now.
 *
 * Owns: the list of places the water was hit, how each ring spreads and dies, and the
 * height and slope of the water that all of them make at a point.
 * Does not own: what hit the water or how hard (the caller says where and how hard, and
 * nothing else: a stone, a lure and a fish are the same to it), the sea's own waves
 * (minamo/ocean), or drawing (ripples.js puts these numbers on the sea).
 * No Three, no scene: it runs in Node. Design: docs/SPLASH.md section 9.
 *
 * A hit starts a ring, and the water stands up round the thing at once: the first crest
 * is there within a twentieth of a second, not grown from nothing as the front runs
 * out. Its front runs outward at one speed, with a few crests behind it
 * that fade toward the middle. It gets lower as it spreads and as it ages, and when it
 * is too low to see it is forgotten. Rings add up: two cross each other and go on.
 *
 * A ring is a function of how old it is and nothing else. Nothing is stepped but the
 * age, so the water is the same at any frame rate.
 *
 * How big the rings are follows what hit the water: how hard, and how heavy it is. A
 * heavier thing is a bigger thing and makes wider rings, further apart, that run faster
 * and last longer, as longer waves do; a harder blow makes them taller and a little
 * wider. So a fish breaking the surface makes rings about twice the lure's.
 *
 * A thing going along the water does not leave circles. Each place it passes sends its
 * wave out only to the two sides and back, and those pieces, one after another along its
 * way, join into the two arms of a V behind it with the crests lying along the arms. The
 * V is as wide as the waves are fast against the thing: half its angle is the wave's
 * speed over the thing's, and never more than 19.47 degrees, which is Kelvin's angle and
 * the widest any wake is. Slow things trail the full Kelvin V; a fast fish or a line
 * drawn quickly trails a narrow one (Rabaud and Moisy 2013: past a speed the wake narrows
 * as one over the speed, like a Mach cone). docs/SEA-FEEDBACK-RESEARCH.md.
 *
 * Bigger than true, on purpose: a 10 gram lure really raises millimetres of water in
 * rings a few centimetres apart that are gone within a metre or two. The lure's here are
 * about fifteen times that in height, ten in spacing, and reach about three times as far. The
 * view is 1.7 m above the water and looks across it, so a ring 22 m off, a full cast, is
 * squeezed about thirteen to one, and the lure's rings there are about a screen point
 * apart: seen, and slight. At 0.8 m apart they were plain in a picture and too big on the
 * phone (2026-11-25).
 *
 * Units: metres, seconds, kilograms. x, z on the water, y up.
 */

// The rings of a thing of this weight, kg, hitting as hard as a thrown lure can: the
// numbers below are for it. It is the lure.
export const WEIGHT = 0.01;
// From one crest to the next, m.
export const APART = 0.4;
// Rings grow with the thing's size, which is the cube root of its weight, and less than
// in step with it: by this power of the weight. A 1 kg fish's are 2.2 times the lure's.
const BY_WEIGHT = 1 / 6;
// The softest hit makes rings this share as far apart as the hardest.
const SOFT_APART = 0.7;
// How fast the front runs outward, m/s. True rings this far apart run at about 0.8.
// Rings further apart run faster, as the square root of it.
export const SPEED = 0.78;
// The blow throws the first crest up where the thing went in: the front starts this many
// crests out, and the ring comes up to its height in this long, s. With the front started
// from nothing the ring was half up 0.2 to 0.3 s after the blow and full at 0.65 to 0.9,
// by when a fish lifted out is already clear of the water (measured 2026-11-25).
export const STARTS = 0.6;
export const RISES = 0.05;
// The crests are tallest this many crests behind the front, and fade behind that.
export const BEHIND = 0.9;
// The tallest crest of the hardest hit, just after it, m. 0.025 was the right reach on
// the phone and too flat (2026-11-25): this alone was raised.
export const HEIGHT = 0.04;
// A ring this many crests wide has spread to 0.7 of its height; it goes on falling.
export const WIDENS = 1.25;
// And it falls to about a third in this long whatever its width, s. Rings further apart
// last longer, as the square root of it.
export const LASTS = 1.9;
// Forgotten when age alone has brought it to this share, or when its tallest crest is
// under this, m, and it is past coming up: nobody can see it, and a thing moving along
// the water leaves a great many.
const GONE_AT = 0.02;
const GONE_UNDER = 0.0012;
// A thing under the water still moves the top of it, gently: the water over it takes
// the sharpness out. What it raises is lower the deeper it is, down to a third for every
// FADES m, and broader, the crests twice as far apart for every SOFTENS m. So half a
// metre down it is a slow, low swell where at the surface it would be a sharp ring, and
// from the bottom, 2.4 m, no wake at all. (Tried on 2026-11-25: all of it down to 1 m, which put
// sharp rings over a thing plainly under water; none of it below 0.2 m, which left the
// water dead over a fish a hand's breadth down; FADES 0.45, too faint over a towed lure
// and a fish drawn in; and 0.7, at which a bite on the bottom showed.)
export const FADES = 0.6;
export const SOFTENS = 0.25;
// A blow from deeper than this, m, is taken as from this deep: a bite on the bottom still
// lifts the water a little, in one broad faint ring, so that it is not felt in the hand
// with nothing at all to see. (Asked for on 2026-11-25. True would be nothing.) Only a
// blow: a thing going along down there leaves no wake up here.
export const DEEP_AS = 0.9;
// The very middle is held flat within about this share of a crest: the thing itself is there.
export const MIDDLE = 0.19;
// The widest a wake is: the sine of Kelvin's angle, 19.47 degrees. A wave left behind by
// a thing going along runs no faster than this share of the thing's speed.
export const KELVIN = 1 / 3;
// A piece of wake is sent out round the two directions that make the arms, and this
// far either way of them, as a share of a quarter turn. Wider and each piece is more of
// a circle; narrower and the arms break into beads between one piece and the next.
export const ARM_WIDE = 0.34;
// A wake is over sooner than a ring from a blow: its pieces last this share as long.
const WAKE_LASTS = 0.45;
// How many rings there can be at once. A new one past this takes the place of the lowest.
export const MOST = 40;

const TWO_PI = Math.PI * 2;

/**
 * One ring's height and outward slope at a distance r from where it began.
 * front: how far its front has run, m. low: how tall its tallest crest is now, m.
 * apart: from one of its crests to the next, m.
 * out: [height m, slope outward (rise over run)].
 * This is the whole circle. A piece of wake is this times armAt().
 */
export function ringAt(r, front, low, apart, out = [0, 0]) {
  out[0] = 0;
  out[1] = 0;
  const u = (front - r) / apart;
  if (!(u > 0) || !(low > 0)) return out;
  const fall = Math.exp(1 - u / BEHIND);
  const tall = (u / BEHIND) * fall;
  const wave = Math.sin(TWO_PI * u);
  // Behind the front by u crests: d/du of tall(u) * sin(2 pi u).
  const dWave = (fall / BEHIND) * (1 - u / BEHIND) * wave + tall * TWO_PI * Math.cos(TWO_PI * u);
  const r2 = r * r;
  const m2 = MIDDLE * MIDDLE * apart * apart;
  const flat = r2 / (r2 + m2);
  const dFlat = (2 * r * m2) / ((r2 + m2) * (r2 + m2));
  out[0] = low * flat * tall * wave;
  out[1] = low * (dFlat * tall * wave - flat * dWave / apart);
  return out;
}

/**
 * How much of a piece of wake goes out in a direction. along: the cosine of the angle
 * between that direction and the way the thing was going. lean: the wave's speed over the
 * thing's: the arms stand that far back of square to its way.
 * out: [share 0 to 1, how fast that changes with `along`].
 */
export function armAt(along, lean, out = [0, 0]) {
  const off = (along + lean) / ARM_WIDE;
  out[0] = Math.exp(-off * off);
  out[1] = out[0] * -2 * off / ARM_WIDE;
  return out;
}

// What a hit makes. strength: how hard, 0 to 1 and over. weight: of the thing, kg.
// depth: how far under the water it is, m. Returns how far apart its crests are, m, and
// how tall the tallest starts, m.
export function ringOf(strength, weight = WEIGHT, depth = 0) {
  const bulk = Math.pow(Math.max(weight, 1e-4) / WEIGHT, BY_WEIGHT);
  const down = Math.max(0, depth);
  return {
    apart: APART * bulk * (SOFT_APART + (1 - SOFT_APART) * Math.min(1, strength)) * (1 + down / SOFTENS),
    tall: HEIGHT * bulk * strength * Math.exp(-down / FADES),
  };
}

const speedOf = (apart) => SPEED * Math.sqrt(apart / APART);
// How far a ring's front has run, and how tall its tallest crest is now.
const frontOf = (ring) => STARTS * ring.apart + ring.speed * ring.age;
const lowOf = (ring) => ring.tall * (1 - Math.exp(-ring.age / RISES)) * Math.exp(-ring.age / ring.lasts) / Math.sqrt(1 + frontOf(ring) / (WIDENS * ring.apart));

// The lean that stands for a whole circle: a blow, not a thing going along.
export const ROUND = 9;

export function createRippleField() {
  // x, z, age, and what the hit made of each ring.
  const rings = [];
  // For the drawing, four numbers a ring: x, z, how far the front has run, how tall.
  const data = new Float32Array(MOST * 4);
  // And four more: how far apart its crests are, the way the thing that left it was
  // going (x, z), and its lean; a lean of ROUND is a whole circle.
  const shape = new Float32Array(MOST * 4);
  const one = [0, 0];
  const arm = [0, 0];

  function add(ring) {
    if (rings.length < MOST) rings.push(ring);
    else {
      let lowest = 0;
      for (let i = 1; i < rings.length; i += 1) if (lowOf(rings[i]) < lowOf(rings[lowest])) lowest = i;
      rings[lowest] = ring;
    }
    pack();
  }
  // One ring at a place: [height, rise along x, rise along z].
  function at(ring, x, z, out) {
    const dx = x - ring.x;
    const dz = z - ring.z;
    const r = Math.hypot(dx, dz);
    out[0] = out[1] = out[2] = 0;
    if (r < 1e-6) return out;
    ringAt(r, frontOf(ring), lowOf(ring), ring.apart, one);
    if (ring.lean === ROUND) {
      out[0] = one[0];
      out[1] = one[1] * dx / r;
      out[2] = one[1] * dz / r;
      return out;
    }
    const along = (dx * ring.dirX + dz * ring.dirZ) / r;
    armAt(along, ring.lean, arm);
    // The share changes round the ring, not along it: its slope lies across the radius.
    const turn = one[0] * arm[1] / r;
    out[0] = one[0] * arm[0];
    out[1] = one[1] * arm[0] * dx / r + turn * (ring.dirX - along * dx / r);
    out[2] = one[1] * arm[0] * dz / r + turn * (ring.dirZ - along * dz / r);
    return out;
  }
  const three = [0, 0, 0];

  const field = {
    data,
    shape,
    // How many rings there are now.
    count: 0,

    /**
     * The water was hit at (x, z). strength: how hard, 0 nothing to 1 the hardest a
     * thrown lure hits it; more is taken as it comes. weight: of the thing that hit it,
     * kg; left out, the lure's. depth: how far under the water it is, m, if it did not
     * break the surface: the water over it is stirred, lower and broader the deeper.
     */
    poke(x, z, strength, weight = WEIGHT, depth = 0) {
      if (!(strength > 0)) return;
      const ring = { x, z, age: 0, ...ringOf(strength, weight, Math.min(depth, DEEP_AS)), dirX: 0, dirZ: 1, lean: ROUND };
      if (!(ring.tall > GONE_UNDER)) return;
      ring.speed = speedOf(ring.apart);
      ring.lasts = LASTS * Math.sqrt(ring.apart / APART);
      add(ring);
    },

    /**
     * A thing going along the water has come to (x, z): it leaves a piece of its wake
     * there. strength, weight, depth: as for poke. dirX, dirZ: the way it is going, a
     * unit. speed: how fast, m/s. taller: its crests stand this many times as tall, and
     * no further apart.
     */
    trail({ x, z, strength, weight = WEIGHT, dirX, dirZ, speed, depth = 0, taller = 1 }) {
      if (!(strength > 0) || !(speed > 0)) return;
      const ring = { x, z, age: 0, ...ringOf(strength, weight, depth), dirX, dirZ };
      ring.tall *= taller;
      if (!(ring.tall > GONE_UNDER)) return;
      ring.speed = Math.min(speedOf(ring.apart), speed * KELVIN);
      ring.lean = ring.speed / speed;
      ring.lasts = LASTS * WAKE_LASTS * Math.sqrt(ring.apart / APART);
      add(ring);
    },

    // Once a frame.
    step(dt) {
      if (!(dt > 0)) return;
      for (let i = rings.length - 1; i >= 0; i -= 1) {
        rings[i].age += dt;
        if (Math.exp(-rings[i].age / rings[i].lasts) < GONE_AT || (rings[i].age > RISES * 6 && lowOf(rings[i]) < GONE_UNDER)) rings.splice(i, 1);
      }
      pack();
    },

    // How far above the still water the rings stand at (x, z), m.
    heightAt(x, z) {
      let h = 0;
      for (const ring of rings) h += at(ring, x, z, three)[0];
      return h;
    },

    // The slope of that at (x, z): out is [rise per metre along x, along z].
    slopeAt(x, z, out = [0, 0]) {
      out[0] = 0;
      out[1] = 0;
      for (const ring of rings) {
        at(ring, x, z, three);
        out[0] += three[1];
        out[1] += three[2];
      }
      return out;
    },

  };

  function pack() {
    field.count = rings.length;
    for (let i = 0; i < rings.length; i += 1) {
      const ring = rings[i];
      data[i * 4] = ring.x;
      data[i * 4 + 1] = ring.z;
      data[i * 4 + 2] = frontOf(ring);
      data[i * 4 + 3] = lowOf(ring);
      shape[i * 4] = ring.apart;
      shape[i * 4 + 1] = ring.dirX;
      shape[i * 4 + 2] = ring.dirZ;
      shape[i * 4 + 3] = ring.lean;
    }
  }

  return field;
}
