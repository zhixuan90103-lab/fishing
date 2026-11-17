/**
 * The lure: one small minnow plug with a treble hook under it.
 *
 * Owns: the model, and putting it at a point with its nose along a direction.
 * Does not own: where it goes or how it moves (lureMove.js), the line (line.js), or any
 * fishing rule. It is tied to nothing: the caller places it where the line ends.
 * Design: docs/LURE.md.
 *
 * Local space: the origin is the line tie at the nose. +Z is the way the nose points,
 * so the body runs back along -Z. +Y is its back, the hook hangs on -Y.
 * Everything is built in code. Units: metres.
 */

import * as THREE from 'three/webgpu';

// Nose to tail root, and the body's half height and half width at its thickest.
const LENGTH = 0.09;
const HALF_HEIGHT = 0.011;
const HALF_WIDTH = 0.0065;
// Body outline from nose to tail, [distance back as a share of LENGTH, share of full girth].
const OUTLINE = [
  [0, 0.12], [0.05, 0.5], [0.16, 0.86], [0.32, 1], [0.5, 0.94], [0.7, 0.7], [0.88, 0.4], [1, 0.2],
];
const TAIL_LENGTH = 0.018;
const TAIL_SPREAD = 0.014;
// The body swings side to side about the nose as it swims: one full beat per this many
// metres swum, by this angle either way, radians.
const WIGGLE_EVERY = 0.16;
const WIGGLE_ANGLE = 0.22;
const HOOK_AT = 0.5;
const HOOK_SIZE = 0.007;

const BACK = new THREE.Color(0x2f5d6b);
const BELLY = new THREE.Color(0xe9eef0);

export function createLure() {
  const object = new THREE.Group();
  object.name = 'lure';
  // The swimming body, turned about the nose inside the placed object.
  const body = new THREE.Group();
  object.add(body);

  const skin = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.28, metalness: 0.55 });
  const fin = new THREE.MeshStandardMaterial({ color: 0xc8d3d6, roughness: 0.5, metalness: 0.2, side: THREE.DoubleSide });
  const steel = new THREE.MeshStandardMaterial({ color: 0xbfc4c8, roughness: 0.3, metalness: 0.9 });

  // Turned about Y, then laid back along -Z and squeezed to a fish's cross-section.
  const hull = new THREE.LatheGeometry(
    OUTLINE.map(([at, girth]) => new THREE.Vector2(girth, -at * LENGTH)), 14,
  );
  hull.rotateX(Math.PI / 2);
  hull.scale(HALF_WIDTH, HALF_HEIGHT, 1);
  const p = hull.attributes.position;
  const colors = new Float32Array(p.count * 3);
  const mix = new THREE.Color();
  for (let i = 0; i < p.count; i += 1) {
    const up = THREE.MathUtils.smoothstep(p.getY(i) / HALF_HEIGHT, -0.1, 0.7);
    mix.copy(BELLY).lerp(BACK, up).toArray(colors, i * 3);
  }
  hull.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  hull.computeVertexNormals();
  body.add(new THREE.Mesh(hull, skin));

  const tail = new THREE.BufferGeometry();
  tail.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    0, 0, -LENGTH * 0.96,
    0, TAIL_SPREAD, -LENGTH - TAIL_LENGTH,
    0, -TAIL_SPREAD, -LENGTH - TAIL_LENGTH,
  ]), 3));
  tail.computeVertexNormals();
  body.add(new THREE.Mesh(tail, fin));

  // Three bends of wire under the belly, a third of a turn apart.
  const bend = new THREE.TorusGeometry(HOOK_SIZE, 0.0006, 5, 12, Math.PI * 1.25);
  for (let i = 0; i < 3; i += 1) {
    const hook = new THREE.Mesh(bend, steel);
    hook.rotation.set(0, (i * Math.PI * 2) / 3, Math.PI * 0.9);
    hook.position.set(0, -HALF_HEIGHT - HOOK_SIZE * 1.4, -LENGTH * HOOK_AT);
    body.add(hook);
  }

  object.traverse((o) => {
    o.frustumCulled = false;
    o.castShadow = false;
  });

  const nose = new THREE.Vector3();
  const side = new THREE.Vector3();
  const back = new THREE.Vector3();
  const basis = new THREE.Matrix4();

  return {
    // Add to the scene root. World space, like the line.
    object,
    // Nose to tail root, metres.
    length: LENGTH,

    /**
     * Put the line tie at (x, y, z) with the nose along (nx, ny, nz), any length.
     * swum is the distance it has swum so far, metres: the body beats with it, so it
     * swims while it moves and holds still when it stops.
     */
    place(x, y, z, nx, ny, nz, swum) {
      object.position.set(x, y, z);
      nose.set(nx, ny, nz);
      if (nose.lengthSq() < 1e-10) nose.set(0, 1, 0);
      nose.normalize();
      // Back stays as near to world up as the nose allows.
      back.set(0, 1, 0).addScaledVector(nose, -nose.y);
      if (back.lengthSq() < 1e-6) back.set(0, 0, -1).addScaledVector(nose, nose.z);
      back.normalize();
      side.crossVectors(back, nose);
      object.quaternion.setFromRotationMatrix(basis.makeBasis(side, back, nose));
      body.rotation.y = Math.sin((swum / WIGGLE_EVERY) * Math.PI * 2) * WIGGLE_ANGLE;
    },

    dispose() {
      hull.dispose();
      tail.dispose();
      bend.dispose();
      for (const m of [skin, fin, steel]) m.dispose();
    },
  };
}
