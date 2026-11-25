/**
 * Water in the air: every bit of thrown water there is, drawn as soft specks that face
 * the eye.
 *
 * Owns: what thrown water looks like, where each bit of it is from the moment it is
 * thrown, and drawing all of it in one go.
 * Does not own: what throws it, when, how much or which way (splashSpray.js for a
 * splash, wakeTrack.js for a wake), the foam it leaves on the water (foamPatch.js), or
 * the sea.
 * Design: docs/SPLASH.md section 4.
 *
 * A splash is not a sheet of glass. Thrown water breaks at once into a great many small
 * drops, and what is seen is the light they scatter: it is white, soft at its edges,
 * ragged, brighter on the side the sun is on, and there is a great deal of it. So it is
 * drawn as hundreds of small soft blobs, not as a few shapes with hard edges (until
 * 2026-11-25 a splash was a jagged ring, a cone and 26 stretched balls, and read as
 * paper). Three kinds of bit:
 *   WATER  a clot of white water: soft, ragged, lit from above and by the sun, spreading
 *   DROP   one drop: a streak of light drawn out along the way it flies
 *   MIST   what hangs in the air after: large, very faint, slow
 *
 * Nothing is integrated. A bit is given where it starts, how fast, and when; where it is
 * after that is a formula of the time, worked out on the graphics card: thrown, slowed by
 * the air, pulled down. So it is the same at any frame rate and costs the processor
 * nothing while it flies. A bit that reaches the water is gone.
 *
 * It is see-through, so it goes in the scene startShore.js draws after the water. It
 * tests depth and writes none.
 *
 * World space. Metres, seconds.
 */

import * as THREE from 'three/webgpu';
import {
  atan, cameraPosition, cameraViewMatrix, exp, float, instancedDynamicBufferAttribute, length, max, mix, mx_noise_float, pow,
  saturate, select, smoothstep, sqrt, step, uniform, uv, varying, vec2, vec3, vec4, dot,
} from 'three/tsl';

export const WATER = 0;
export const DROP = 1;
export const MIST = 2;

const GRAVITY = 9.81;
// The air slows a bit of water by at least this, 1/s: the formula divides by it.
const DRAG_LEAST = 0.02;

// Scene-linear, and over white: the post pass applies an exposure well under 1.
// White water where the sun is on it, and where only the sky is.
const SUNLIT = new THREE.Color(1.75, 1.72, 1.64);
const SKYLIT = new THREE.Color(0.5, 0.66, 0.84);
// A drop is a glint of the sky.
const GLINT = new THREE.Color(1.9, 1.95, 2.0);
// How solid each kind is at its middle.
const SOLID = [0.5, 0.8, 0.14];
// A clot of white water spreads to this many times its size over its life; mist more.
const SPREADS = [1.9, 1, 2.6];
// A drop is drawn this many times as long as it is wide standing still, and this much
// longer for each m/s it is making.
const DROP_LONG = 1.3;
const STREAKS = 0.8;
// How ragged the edge of a clot is, 0 a round disc.
const RAGGED = 0.42;
// A bit is never drawn smaller than this share of how far off it is: a drop 3 mm across is a
// third of a screen point at 10 m and cannot be seen at all, and that is where a fish is
// fought. White water, a drop. Mist is large as it is.
const SEEN_AT_LEAST = [0.0012, 0.00075, 0];
// White water blown up to be seen is thinned in step, but never below this share of its own.
const THIN_LEAST = 0.3;
// A bit comes in over this share of its life and goes out over this last share.
const COMES_IN = 0.06;
const GOES_OUT = 0.55;

/** most: how many bits can be in the air at once. One more takes the place of the oldest. */
export function createSprayPool(most = 4096) {
  // Where and when it starts; how fast and how big; how long, a number of its own, which kind, how the air slows it.
  const start = new THREE.InstancedBufferAttribute(new Float32Array(most * 4), 4);
  const going = new THREE.InstancedBufferAttribute(new Float32Array(most * 4), 4);
  const kindOf = new THREE.InstancedBufferAttribute(new Float32Array(most * 4), 4);
  // How fast its own time runs against the clock: under 1 it flies the same path, slowed.
  const paceOf = new THREE.InstancedBufferAttribute(new Float32Array(most).fill(1), 1);
  for (const it of [start, going, kindOf, paceOf]) it.setUsage(THREE.DynamicDrawUsage);
  // Nothing has been thrown: every bit starts long ago and is over.
  for (let i = 0; i < most; i += 1) start.array[i * 4 + 3] = -1e6;

  const now = uniform(0);
  const sunWay = uniform(new THREE.Vector3(0.3, 0.8, 0.5).normalize());

  const A = instancedDynamicBufferAttribute(start, 'vec4');
  const B = instancedDynamicBufferAttribute(going, 'vec4');
  const C = instancedDynamicBufferAttribute(kindOf, 'vec4');

  const pace = instancedDynamicBufferAttribute(paceOf, 'float');
  // Its own time: the clock's, at its pace.
  const age = now.sub(A.w).mul(pace);
  const life = C.x;
  const seed = C.y;
  const kind = C.z;
  const drag = max(C.w, DRAG_LEAST);
  const isDrop = step(0.5, kind).mul(step(kind, 1.5));
  const isMist = step(1.5, kind);
  // Thrown, slowed by the air, pulled down: where it is and how it is moving at this age.
  const slowed = exp(drag.negate().mul(age));
  const gone = float(1).sub(slowed).div(drag);
  const fall = age.sub(gone).div(drag).mul(-GRAVITY);
  const place = vec3(A.x.add(B.x.mul(gone)), A.y.add(B.y.mul(gone)).add(fall), A.z.add(B.z.mul(gone)));
  // As it is seen to move: its own speed, at its pace.
  const moving = vec3(B.x.mul(slowed), B.y.mul(slowed).sub(float(1).sub(slowed).div(drag).mul(GRAVITY)), B.z.mul(slowed)).mul(pace);
  const through = saturate(age.div(max(life, 1e-3)));
  const there = step(0, age).mul(step(age, life)).mul(step(-0.01, place.y));

  const material = new THREE.SpriteNodeMaterial({ transparent: true, depthWrite: false });
  material.positionNode = place;
  // A drop is drawn out along the way it flies, as it is seen; the others are round.
  const seenMoving = cameraViewMatrix.mul(vec4(moving, 0)).xy;
  material.rotationNode = select(isDrop.greaterThan(0.5), atan(seenMoving.y, seenMoving.x), float(0));
  const spread = mix(mix(float(SPREADS[WATER]), float(SPREADS[DROP]), isDrop), float(SPREADS[MIST]), isMist);
  const least = length(cameraPosition.sub(place)).mul(mix(mix(float(SEEN_AT_LEAST[WATER]), float(SEEN_AT_LEAST[DROP]), isDrop), float(SEEN_AT_LEAST[MIST]), isMist));
  const true_ = B.w.mul(mix(float(1), spread, sqrt(through)));
  const across = max(true_, least).mul(there);
  // White water drawn larger than it is is thinner for it, or a small splash far off, every
  // clot of it blown up to be seen, is one big solid ball: a lure landed like a boulder.
  const thinned = mix(max(true_.div(max(least, 1e-6)), THIN_LEAST).min(1), float(1), isDrop);
  const long = mix(float(1), float(DROP_LONG).add(length(moving).mul(STREAKS)), isDrop);
  material.scaleNode = vec2(across.mul(long).mul(2), across.mul(2));

  // Flat across each bit, so worked out at the corners and handed on.
  const vThrough = varying(through, 'vSprayThrough');
  const vSeed = varying(seed, 'vSpraySeed');
  const vDrop = varying(isDrop, 'vSprayDrop');
  const vMist = varying(isMist, 'vSprayMist');
  const vThinned = varying(thinned, 'vSprayThinned');
  const p = uv().mul(2).sub(1);
  const r = length(p);
  // A clot's edge is eaten into, more as it thins out: it is ragged and breaks up.
  const eaten = mx_noise_float(vec3(p.mul(1.7).add(vSeed.mul(37)), vSeed.mul(11).add(vThrough.mul(1.6))));
  const clot = smoothstep(0, 1.15, float(1).sub(r).add(eaten.mul(RAGGED)).sub(vThrough.mul(0.35))).mul(smoothstep(1, 0.75, r));
  const streak = pow(saturate(float(1).sub(r)), 1.4);
  const haze = pow(saturate(float(1).sub(r)), 1.6);
  const shape = mix(mix(clot, streak, vDrop), haze, vMist);
  const solid = mix(mix(float(SOLID[WATER]), float(SOLID[DROP]), vDrop), float(SOLID[MIST]), vMist);
  const comes = smoothstep(0, COMES_IN, vThrough);
  const goes = smoothstep(1, 1 - GOES_OUT, vThrough);
  material.opacityNode = shape.mul(solid).mul(comes).mul(goes).mul(vThinned);
  // Each clot is lit as a little ball: from above by the sky, from one side by the sun.
  const facing = vec3(p.x, p.y, sqrt(saturate(float(1).sub(r.mul(r)))));
  const up = cameraViewMatrix.mul(vec4(0, 1, 0, 0)).xyz;
  const sun = cameraViewMatrix.mul(vec4(sunWay, 0)).xyz;
  const sky = dot(facing, up).mul(0.5).add(0.5);
  const sunned = saturate(dot(facing, sun).mul(0.6).add(0.4));
  const white = vec3(SKYLIT.r, SKYLIT.g, SKYLIT.b).mul(mix(float(0.55), float(1), sky))
    .add(vec3(SUNLIT.r, SUNLIT.g, SUNLIT.b).sub(vec3(SKYLIT.r, SKYLIT.g, SKYLIT.b)).mul(sunned));
  // Not every drop catches the light alike: some glint, some are only grey water.
  const catches = mix(float(0.4), float(1.25), vSeed.mul(7.31).fract());
  material.colorNode = mix(white, vec3(GLINT.r, GLINT.g, GLINT.b).mul(catches), vDrop);

  const sprite = new THREE.Sprite(material);
  sprite.name = 'spray';
  sprite.count = most;
  sprite.frustumCulled = false;
  sprite.castShadow = false;

  let next = 0;
  let time = 0;
  // When the last bit thrown is over: after that the clock can start again from nothing.
  let over = 0;
  let touched = false;

  return {
    object: sprite,
    // True while anything is in the air.
    get active() {
      return time < over;
    },

    // Which way the sun is, world space, a unit vector toward it.
    lit(direction) {
      sunWay.value.copy(direction);
    },

    /**
     * Throw one bit of water from (x, y, z) at (vx, vy, vz), m and m/s. size: its radius,
     * m. life: how long it lasts if it does not reach the water first, s. kind: WATER,
     * DROP or MIST. drag: how the air slows it, 1/s. after: it starts this long from now.
     * pace: how fast its time runs, 1 as it truly would: at 0.5 it flies the same path and
     * takes twice as long over it. speeds, life and drag are in its own time.
     */
    throw(x, y, z, vx, vy, vz, size, life, kind = WATER, drag = 1, after = 0, pace = 1) {
      // Nothing in the air: start the clock again, so its numbers stay small and exact.
      if (time >= over && time > 60) {
        time = 0;
        for (let i = 0; i < most; i += 1) start.array[i * 4 + 3] = -1e6;
      }
      const i = next * 4;
      next = (next + 1) % most;
      start.array[i] = x; start.array[i + 1] = y; start.array[i + 2] = z; start.array[i + 3] = time + after;
      going.array[i] = vx; going.array[i + 1] = vy; going.array[i + 2] = vz; going.array[i + 3] = size;
      kindOf.array[i] = life; kindOf.array[i + 1] = Math.random(); kindOf.array[i + 2] = kind; kindOf.array[i + 3] = drag;
      paceOf.array[next === 0 ? most - 1 : next - 1] = pace;
      over = Math.max(over, time + after + life / pace);
      touched = true;
    },

    // Once a frame.
    update(dt) {
      time += dt;
      now.value = time;
      sprite.visible = time < over;
      if (touched) {
        touched = false;
        start.needsUpdate = true;
        going.needsUpdate = true;
        kindOf.needsUpdate = true;
        paceOf.needsUpdate = true;
      }
    },

    dispose() {
      material.dispose();
    },
  };
}
