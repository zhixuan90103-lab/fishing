/**
 * What thrown water looks like: the one material for the splash and for the spray of a
 * wake.
 *
 * Owns: the colour of water in the air, how much shows through it, and the shape a drop
 * of it is drawn in.
 * Does not own: the shapes (splash.js, wake.js) or the sea's own look, which is not
 * touched.
 * Design: docs/SPLASH.md section 4.
 *
 * Water in the air is clear. What is seen of it is what it throws back: looked at square
 * on, mostly what is behind it, a little greyer and bluer; at its edges, where it is seen
 * at a slant, the sky, bright. So a sheet of water is a bright edge round a faint middle,
 * and stood on edge it is bright all over. A drop is too small for that: it is a speck
 * of the sky's light. Its upper side is lit by the sky and its under
 * side by the sea.
 * Until 2026-11-25 it was one flat white at half strength: it read as paper laid on the
 * water.
 */

import * as THREE from 'three/webgpu';
import {
  abs, dot, float, mix, normalView, normalWorld, positionViewDirection, pow, uniform, vec3,
} from 'three/tsl';

// Scene-linear. The post pass applies an exposure well under 1, so the sky's glint is
// set over white. The body is the sea seen through a little water, and darker underneath.
const GLINT = new THREE.Color(1.5, 1.55, 1.6);
const BODY = new THREE.Color(0.42, 0.58, 0.66);
const UNDER = 0.55;
// How much shows through it, 0 nothing there to 1 solid: square on, and at its edges.
const THIN = 0.22;
const EDGE = 0.9;
// How quickly the edge comes on toward the rim: higher is a narrower rim.
const RIM = 1.6;

// A drop is too small to show a rim round a clear middle, and drawn that way it is a
// bubble. It is a speck of light: this much shows through its middle.
const SPECK = 0.75;

// A drop is drawn long, along the way it is going: this many times as long as it is
// wide standing still, and STREAKS more for each m/s it is making. A round drop with a
// bright edge reads as a bubble.
const DROP_LONG = 1.4;
const STREAKS = 0.9;

const along = new THREE.Vector3();
const upright = new THREE.Vector3(0, 1, 0);
const turned = new THREE.Quaternion();
const where = new THREE.Vector3();
const sized = new THREE.Vector3();

/**
 * Write into `matrix` a drop of this radius at (x, y, z) going at (vx, vy, vz): a unit
 * ball drawn out along its way. A radius of 0 is no drop.
 */
export function placeDrop(matrix, x, y, z, vx, vy, vz, radius) {
  const speed = Math.hypot(vx, vy, vz);
  if (speed > 1e-6) turned.setFromUnitVectors(upright, along.set(vx / speed, vy / speed, vz / speed));
  else turned.identity();
  return matrix.compose(where.set(x, y, z), turned, sized.set(radius, radius * (DROP_LONG + STREAKS * speed), radius));
}

/**
 * double: drawn from both sides, for a sheet. speck: a drop, bright right through.
 * Returns the material and setFade(0 to 1).
 */
export function createSprayMaterial(double = false, speck = false) {
  const material = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: double ? THREE.DoubleSide : THREE.FrontSide });
  const fade = uniform(1);
  const rim = pow(float(1).sub(abs(dot(normalView, positionViewDirection))), RIM);
  // Lit from above by the sky, from below by the sea.
  const lit = mix(float(UNDER), float(1), normalWorld.y.mul(0.5).add(0.5));
  const glint = vec3(GLINT.r, GLINT.g, GLINT.b);
  const body = vec3(BODY.r, BODY.g, BODY.b).mul(lit);
  // A speck is half sky all through, and all sky at its edge.
  material.colorNode = mix(speck ? mix(body, glint, float(0.5)) : body, glint, rim);
  material.opacityNode = mix(float(speck ? SPECK : THIN), float(EDGE), rim).mul(fade);
  return {
    material,
    // 1 all there, 0 gone.
    setFade(value) {
      fade.value = value;
    },
    dispose() {
      material.dispose();
    },
  };
}
