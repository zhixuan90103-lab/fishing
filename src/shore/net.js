/**
 * The landing net: a hoop, a bag of mesh under it, and a handle.
 *
 * Owns: the model, and putting it somewhere with its handle pointing a given way.
 * Does not own: where it goes or when (src/play/scoop.js and fishing.js), the fish, or
 * any fishing rule. Modelled in code, no outside assets. Design: docs/NET.md.
 *
 * Local frame: the origin is the middle of the hoop. +Y is up, out of the bag's opening.
 * The handle runs along +X. The hoop always lies level.
 * Units: metres.
 */

import * as THREE from 'three/webgpu';

// The hoop's radius and the thickness of its rim.
const HOOP_RADIUS = 0.23;
const RIM = 0.007;
// How deep the bag hangs under the hoop. A 0.45 m fish hung by the mouth fits.
const BAG_DEPTH = 0.62;
// The bag's outline from the rim down: [radius as a share of the hoop's, depth as a share
// of BAG_DEPTH]. Change the bag's shape here.
const BAG = [[1, 0], [0.97, 0.18], [0.88, 0.42], [0.7, 0.68], [0.42, 0.9], [0.12, 1]];
// Meshes round the bag and down it. More is a finer net.
const AROUND = 18;
// The handle: its length, its radius, and how far it droops below level, radians.
const HANDLE = 1.3;
const HANDLE_RADIUS = 0.011;
const HANDLE_DROOP = 0.3;
// Scene-linear colours. The mesh is drawn as thin lines.
const MESH_COLOR = 0x1d2a24;
const FRAME_COLOR = 0x2a2e31;
const GRIP_COLOR = 0x101112;

export function createNet() {
  const object = new THREE.Group();
  object.name = 'landing-net';
  object.visible = false;

  const frame = new THREE.MeshStandardMaterial({ color: FRAME_COLOR, roughness: 0.45, metalness: 0.6 });
  const grip = new THREE.MeshStandardMaterial({ color: GRIP_COLOR, roughness: 0.9, metalness: 0 });
  const twine = new THREE.LineBasicMaterial({ color: MESH_COLOR });

  const hoopGeo = new THREE.TorusGeometry(HOOP_RADIUS, RIM, 8, 40);
  const hoop = new THREE.Mesh(hoopGeo, frame);
  hoop.rotation.x = Math.PI / 2;
  object.add(hoop);

  // The bag: the outline turned round the hoop's axis, drawn as its edges.
  const outline = BAG.map(([r, d]) => new THREE.Vector2(r * HOOP_RADIUS, -d * BAG_DEPTH));
  const lathe = new THREE.LatheGeometry(outline, AROUND);
  const bagGeo = new THREE.WireframeGeometry(lathe);
  lathe.dispose();
  const bag = new THREE.LineSegments(bagGeo, twine);
  bag.frustumCulled = false;
  object.add(bag);

  // The handle leaves the rim along +X and droops a little.
  const arm = new THREE.Group();
  arm.position.set(HOOP_RADIUS, 0, 0);
  arm.rotation.z = -HANDLE_DROOP;
  const shaftGeo = new THREE.CylinderGeometry(HANDLE_RADIUS, HANDLE_RADIUS, HANDLE, 10);
  const shaft = new THREE.Mesh(shaftGeo, frame);
  shaft.rotation.z = -Math.PI / 2;
  shaft.position.x = HANDLE / 2;
  const gripGeo = new THREE.CylinderGeometry(HANDLE_RADIUS * 1.5, HANDLE_RADIUS * 1.5, HANDLE * 0.3, 10);
  const hand = new THREE.Mesh(gripGeo, grip);
  hand.rotation.z = -Math.PI / 2;
  hand.position.x = HANDLE * 0.85;
  arm.add(shaft, hand);
  object.add(arm);

  return {
    // Add to the scene root.
    object,
    // How deep the bag is, for whoever puts a fish in it.
    depth: BAG_DEPTH,

    // The middle of the hoop at (x, y, z), world space, the handle running along the
    // level direction (hx, hz). stretch: how long the bag is pulled, 1 at rest. rock: how
    // far the bag swings under the hoop, radians, across the handle.
    place(x, y, z, hx, hz, stretch = 1, rock = 0) {
      object.visible = true;
      object.position.set(x, y, z);
      object.rotation.y = Math.atan2(-hz, hx);
      bag.scale.y = stretch;
      bag.rotation.x = rock;
    },
    hide() {
      object.visible = false;
    },

    dispose() {
      hoopGeo.dispose();
      bagGeo.dispose();
      shaftGeo.dispose();
      gripGeo.dispose();
      frame.dispose();
      grip.dispose();
      twine.dispose();
    },
  };
}
