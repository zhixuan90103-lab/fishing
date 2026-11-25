/**
 * Foam left lying on the water where it was broken: a white patch that spreads, breaks
 * into pieces and is gone.
 *
 * Owns: drawing those patches, and how each spreads and breaks up over its life.
 * Does not own: what broke the water or how wide the patch is (the caller: splash.js,
 * from splashSpray.js), the water in the air (sprayPool.js), or the sea. The sea's own
 * look is not touched: this is laid flat just over it.
 * Design: docs/SPLASH.md section 4.
 *
 * Broken water does not vanish when the spray comes down: for a second or two the place
 * is white, and that is half of what makes a splash read as water. A patch is a flat
 * disc eaten into from its edge and through its middle, so it is lace and not a plate.
 *
 * Nothing is integrated: a patch is given where and when, and the rest is a formula of
 * the time. It is see-through, so it goes in the scene startShore.js draws after the
 * water. It tests depth and writes none.
 *
 * World space. Metres, seconds.
 */

import * as THREE from 'three/webgpu';
import {
  float, instancedDynamicBufferAttribute, length, max, mix, mx_fractal_noise_float, positionGeometry, saturate,
  smoothstep, sqrt, step, uniform, uv, varying, vec2, vec3, cos, sin,
} from 'three/tsl';

// How far over the still water it lies, m: clear of the small waves.
const OVER = 0.035;
// It spreads to this many times as wide over its life.
const SPREADS = 1.7;
// Scene-linear, over white: the post pass applies an exposure well under 1.
const WHITE = new THREE.Color(1.5, 1.56, 1.6);
// How solid it is where it is thickest.
const SOLID = 0.5;
// How fine its lace is: pieces to a patch across.
const LACE = 9;

/** most: how many patches can lie on the water at once. One more takes the place of the oldest. */
export function createFoamPatch(most = 24) {
  // Where and when; how wide, how long, a number of its own.
  const where = new THREE.InstancedBufferAttribute(new Float32Array(most * 4), 4);
  const how = new THREE.InstancedBufferAttribute(new Float32Array(most * 4), 4);
  for (const it of [where, how]) it.setUsage(THREE.DynamicDrawUsage);
  for (let i = 0; i < most; i += 1) { where.array[i * 4 + 3] = -1e6; how.array[i * 4 + 1] = 1; }

  const now = uniform(0);
  const A = instancedDynamicBufferAttribute(where, 'vec4');
  const B = instancedDynamicBufferAttribute(how, 'vec4');
  const age = now.sub(A.w);
  const life = max(B.y, 1e-3);
  const through = saturate(age.div(life));
  const there = step(0, age).mul(step(age, life));
  const wide = B.x.mul(mix(float(1), float(SPREADS), sqrt(through))).mul(there);
  // Each patch is turned its own way.
  const turn = B.z.mul(6.283);
  const flat = positionGeometry.xy.mul(wide).mul(2);
  const turned = vec2(flat.x.mul(cos(turn)).sub(flat.y.mul(sin(turn))), flat.x.mul(sin(turn)).add(flat.y.mul(cos(turn))));

  const material = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide });
  material.positionNode = vec3(A.x.add(turned.x), A.y.add(OVER), A.z.add(turned.y));
  const vThrough = varying(through, 'vFoamThrough');
  const vSeed = varying(B.z, 'vFoamSeed');
  const p = uv().mul(2).sub(1);
  const r = length(p);
  // Thick in the middle, thin at the edge, and eaten through more and more as it ages.
  const lace = mx_fractal_noise_float(vec3(p.mul(LACE * 0.5).add(vSeed.mul(53)), vSeed.mul(17).add(vThrough.mul(0.6))), 3).mul(0.5).add(0.5);
  const thick = saturate(float(1).sub(r.mul(r))).mul(0.5).add(lace.mul(0.8));
  const cut = mix(float(0.5), float(1.2), vThrough);
  material.opacityNode = smoothstep(cut, cut.add(0.5), thick).mul(smoothstep(1, 0.8, r)).mul(SOLID).mul(smoothstep(1, 0.6, vThrough));
  material.colorNode = vec3(WHITE.r, WHITE.g, WHITE.b).mul(mix(float(0.82), float(1), lace));

  const shape = new THREE.PlaneGeometry(1, 1);
  const mesh = new THREE.Mesh(shape, material);
  mesh.name = 'foam';
  mesh.count = most;
  mesh.frustumCulled = false;
  mesh.castShadow = false;

  let next = 0;
  let time = 0;
  let over = 0;
  let touched = false;

  return {
    object: mesh,
    // True while any foam is left.
    get active() {
      return time < over;
    },

    // Leave a patch at (x, z): radius m across at first, gone after life s.
    lay(x, z, radius, life) {
      if (time >= over && time > 60) {
        time = 0;
        for (let i = 0; i < most; i += 1) where.array[i * 4 + 3] = -1e6;
      }
      const i = next * 4;
      next = (next + 1) % most;
      where.array[i] = x; where.array[i + 1] = 0; where.array[i + 2] = z; where.array[i + 3] = time;
      how.array[i] = radius; how.array[i + 1] = life; how.array[i + 2] = Math.random(); how.array[i + 3] = 0;
      over = Math.max(over, time + life);
      touched = true;
    },

    // Once a frame.
    update(dt) {
      time += dt;
      now.value = time;
      mesh.visible = time < over;
      if (touched) {
        touched = false;
        where.needsUpdate = true;
        how.needsUpdate = true;
      }
    },

    dispose() {
      shape.dispose();
      material.dispose();
    },
  };
}
