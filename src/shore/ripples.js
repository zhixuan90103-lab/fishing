/**
 * Rings on the water, put on the sea: the surface itself rises, falls and tilts with them.
 *
 * Owns: handing the rings in rippleField.js to the water's shader, and the same ring
 * written for the shader.
 * Does not own: the rings (rippleField.js), who hits the water (the caller), or the sea's
 * look: colour, waves, haze and light are minamo's and are not touched. This only adds a
 * height and a tilt to the surface the sea already draws.
 * Design: docs/SPLASH.md section 9.
 *
 * The tilt is worked out at every pixel from the rings themselves, not from a picture of
 * them, so a ring is as sharp 30 m off as it is at the boat. The height moves the sea's
 * own mesh where the mesh is fine enough to show it, which is near the boat; further off
 * a few centimetres are under a pixel and only the tilt is seen.
 *
 * `ringAt` below must stay the same function as ringAt in rippleField.js.
 */

import * as THREE from 'three/webgpu';
import {
  Fn, If, Loop, cos, exp, float, int, length, max, saturate, select, sin, uniform, uniformArray, vec3,
} from 'three/tsl';
import { ARM_WIDE, BEHIND, MIDDLE, MOST, ROUND, createRippleField } from './rippleField.js';

const TWO_PI = Math.PI * 2;

export function createRipples() {
  const field = createRippleField();
  const rings = Array.from({ length: MOST }, () => new THREE.Vector4());
  const ringsNode = uniformArray(rings);
  // How far apart its crests are, the way the thing that left it was going, its lean.
  const shapes = Array.from({ length: MOST }, () => new THREE.Vector4(1, 0, 1, ROUND));
  const shapesNode = uniformArray(shapes);
  const count = uniform(0, 'int');

  // At a place on the water: (rise per metre along x, along z, height), all rings added.
  // spacing: how far apart the mesh's points are there, m, where the height is to move
  // them: a ring the mesh is too coarse to carry adds no height. 0 where only the tilt
  // is wanted.
  const at = Fn(([xz, spacing]) => {
    const sum = vec3(0).toVar();
    Loop({ start: int(0), end: count, type: 'int', condition: '<' }, ({ i }) => {
      const ring = ringsNode.element(i);
      const shape = shapesNode.element(i);
      const apart = shape.x;
      const d = xz.sub(ring.xy);
      const r = length(d);
      const u = ring.z.sub(r).div(apart);
      If(u.greaterThan(0), () => {
        const fall = exp(float(1).sub(u.div(BEHIND)));
        const tall = u.div(BEHIND).mul(fall);
        const wave = sin(u.mul(TWO_PI));
        const dWave = fall.div(BEHIND).mul(float(1).sub(u.div(BEHIND))).mul(wave).add(tall.mul(TWO_PI).mul(cos(u.mul(TWO_PI))));
        const r2 = r.mul(r);
        const m2 = apart.mul(apart).mul(MIDDLE * MIDDLE);
        const flat = r2.div(r2.add(m2));
        const dFlat = r.mul(2).mul(m2).div(r2.add(m2).mul(r2.add(m2)));
        const carried = saturate(float(2).sub(spacing.div(apart.div(4))));
        const whole = ring.w.mul(flat).mul(tall).mul(wave);
        const outward = ring.w.mul(dFlat.mul(tall).mul(wave).sub(flat.mul(dWave).div(apart)));
        const dir = d.div(max(r, 1e-4));
        // A piece of wake goes out to the two sides only (armAt in rippleField.js).
        const round = shape.w.greaterThan(ROUND - 1);
        const along = dir.x.mul(shape.y).add(dir.y.mul(shape.z));
        const off = along.add(shape.w).div(ARM_WIDE);
        const armed = exp(off.mul(off).negate());
        const share = select(round, float(1), armed);
        const turn = select(round, float(0), whole.mul(armed).mul(off).mul(-2 / ARM_WIDE).div(max(r, 1e-4)));
        sum.addAssign(vec3(
          dir.x.mul(outward).mul(share).add(turn.mul(shape.y.sub(along.mul(dir.x)))),
          dir.y.mul(outward).mul(share).add(turn.mul(shape.z.sub(along.mul(dir.y)))),
          whole.mul(share).mul(carried),
        ));
      });
    });
    return sum;
  });

  return {
    field,
    // For the water's material: what the rings add at a place on the water.
    at,
    // The water was hit at (x, z), this hard: 0 nothing to 1 the hardest a thrown lure
    // hits, by a thing of this weight, kg, this far under the water, m, or on it.
    poke(x, z, strength, weight, depth) {
      field.poke(x, z, strength, weight, depth);
    },
    // A thing going along the water leaves a piece of its wake at (x, z): the way it is
    // going, a unit, and how fast, m/s.
    trail(x, z, strength, weight, dirX, dirZ, speed, depth, taller) {
      field.trail(x, z, strength, weight, dirX, dirZ, speed, depth, taller);
    },

    // Once a frame, before the water is drawn.
    update(dt) {
      field.step(dt);
      count.value = field.count;
      for (let i = 0; i < field.count; i += 1) {
        rings[i].fromArray(field.data, i * 4);
        shapes[i].fromArray(field.shape, i * 4);
      }
    },
  };
}
