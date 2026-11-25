/**
 * The splash where something goes into the water, is drawn up out of it, or thrashes at
 * the top of it: a burst of white water, drops, a breath of mist, and the foam left
 * lying where it was. The rings on the water are the water's own (ripples.js); a drop
 * that falls back in is reported, so that it can make one.
 *
 * Owns: starting a splash: throwing every bit of it into the air, laying its foam, and
 * saying when its drops come down.
 * Does not own: what a splash is made of (splashSpray.js), its order and the drops that
 * ring (splashBurst.js), what water in the air looks like and where each bit is once
 * thrown (sprayPool.js), the foam (foamPatch.js), when one happens (the caller), or the
 * sea.
 * Design: docs/SPLASH.md.
 *
 * It draws nothing itself. The pool and the foam it is given go in the scene
 * startShore.js draws after the water.
 *
 * World space.
 */

import { DROP } from './sprayPool.js';
import { bigOf, landsAt, makeDrops, sizeAt } from './splashBurst.js';
import { foamOf, makeSpray } from './splashSpray.js';

// A drop that falls back in hits the water this hard, for a splash of size 1, and as a
// thing of this weight, kg: a ring a hand's breadth across.
const DROP_HITS = 0.14;
const DROP_KG = 0.001;
// A splash is played this many times as fast as it truly goes: under 1, slowed. At its true
// pace the white water of a fish's splash is up and gone in under half a second, and the eye
// has no time to follow a drop out and down. Bigger than true is in splashBurst.js; this is
// slower than true. (2026-11-25: 0.55, so a little under twice as long.)
const PACE = 0.55;
// The drops that ring are thrown clean: the air hardly slows them, 1/s.
const DROP_DRAG = 0.02;

/**
 * pool: the water in the air (sprayPool.js). foam: what is left on the water
 * (foamPatch.js). landed(x, z, strength, weight): called when a drop that makes a ring
 * falls back into the water, optional.
 */
export function createSplash(pool, foam, landed = null) {
  const kinds = ['in', 'out', 'thrash'];
  const spray = Object.fromEntries(kinds.map((kind) => [kind, makeSpray(kind)]));
  const drops = Object.fromEntries(kinds.map((kind) => [kind, makeDrops(kind)]));
  // Where it is seen from, to size a far splash up.
  const eye = { x: 0, y: 0, z: 0 };
  // Drops still in the air that will make a ring: when each lands, where, how hard.
  const falling = [];
  let time = 0;

  function start(kind, x, z, strength, weight) {
    const big = bigOf(strength, weight, kind);
    // As it is drawn: one far away a little larger than life.
    const drawn = big * sizeAt(Math.hypot(x - eye.x, eye.y, z - eye.z));
    const fast = Math.sqrt(drawn);
    // Each splash is the same one turned a different way.
    const turn = (x * 12.9898 + z * 78.233) % (Math.PI * 2);
    const c = Math.cos(turn);
    const s = Math.sin(turn);
    for (const bit of spray[kind]) {
      pool.throw(
        x + (bit.x * c + bit.z * s) * drawn, bit.y * drawn, z + (bit.z * c - bit.x * s) * drawn,
        (bit.vx * c + bit.vz * s) * fast, bit.vy * fast, (bit.vz * c - bit.vx * s) * fast,
        bit.size * fast, bit.life * fast, bit.kind, bit.drag, bit.after / PACE, PACE,
      );
    }
    // The few big drops whose fall is followed, so that each can ring where it lands.
    for (const drop of drops[kind]) {
      if (!(drop.size > 0)) continue;
      const lands = landsAt(drop, drawn);
      pool.throw(
        x + (drop.x * c + drop.z * s) * drawn, drop.y * drawn, z + (drop.z * c - drop.x * s) * drawn,
        (drop.vx * c + drop.vz * s) * drawn, drop.vy * drawn, (drop.vz * c - drop.vx * s) * drawn,
        drop.size * 0.6 * fast, lands - drop.t0, DROP, DROP_DRAG, drop.t0 / PACE, PACE,
      );
      if (!landed || !drop.rings) continue;
      const far = lands - drop.t0;
      const lx = (drop.x + drop.vx * far) * drawn;
      const lz = (drop.z + drop.vz * far) * drawn;
      falling.push({ at: time + lands / PACE, x: x + lx * c + lz * s, z: z + lz * c - lx * s, strength: DROP_HITS * big });
    }
    // The foam it leaves: one patch where it was and a few smaller round it, not one disc.
    const left = foamOf(kind);
    foam.lay(x, z, left.radius * drawn, left.life * fast / PACE);
    for (let i = 0; i < left.round; i += 1) {
      const a = turn + (i / left.round) * Math.PI * 2;
      const off = left.radius * drawn * (0.7 + 0.5 * ((i * 7) % 3) / 2);
      foam.lay(x + Math.cos(a) * off, z + Math.sin(a) * off, left.radius * drawn * 0.6, left.life * fast * (0.6 + 0.1 * i) / PACE);
    }
  }

  return {
    // True while any splash is still playing.
    get active() {
      return falling.length > 0 || pool.active || foam.active;
    },

    // Where the splashes are looked at from, world space. One far away is drawn larger.
    seenFrom(position) {
      eye.x = position.x; eye.y = position.y; eye.z = position.z;
    },

    // Something went into the water at (x, z). strength 0 to 1: how hard it hit.
    // weight: of the thing, kg.
    burst(x, z, strength = 1, weight) {
      start('in', x, z, strength, weight);
    },

    // Something was drawn up out of the water at (x, z). strength 0 to 1: how much water
    // it brings with it. weight: of what comes through, kg.
    breach(x, z, strength = 1, weight) {
      start('out', x, z, strength, weight);
    },

    // A fish thrashing at the top of the water at (x, z) threw it about. strength 0 to
    // 1: how hard. weight: of what struck the water, kg.
    thrash(x, z, strength = 1, weight) {
      start('thrash', x, z, strength, weight);
    },

    // Once a frame.
    update(dt) {
      time += dt;
      for (let i = falling.length - 1; i >= 0; i -= 1) {
        const drop = falling[i];
        if (drop.at > time) continue;
        falling.splice(i, 1);
        landed(drop.x, drop.z, drop.strength, DROP_KG);
      }
    },
  };
}
