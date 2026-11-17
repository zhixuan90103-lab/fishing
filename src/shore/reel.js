/**
 * Spinning reel, about a 2500 size.
 *
 * Reel space: origin where the foot meets the seat. +Y points to the rod tip, +Z hangs
 * away from the rod, +X is the angler's left, where the handle is. The main shaft is
 * parallel to the rod at z = SHAFT_DROP.
 *
 * Four parts, each a group whose origin sits on its own axis, so it can be driven
 * without knowing the geometry:
 *   frame    foot, stem, gear housing. Fixed.
 *   rotor    cup, two arms, bail wire, line roller. Turns about Y.
 *   spool    skirt, line, drag knob. Slides along Y.
 *   handle   shaft, crank, knob. Turns about X.
 * wind(metres) turns them together for that much line coming in.
 */

import * as THREE from 'three/webgpu';

const SHAFT_DROP = 0.046;
// Gear housing centre, which is also the handle axis.
const HOUSING_Y = -0.021;
const HOUSING_Z = SHAFT_DROP + 0.003;
// Rotor arms: how far out they sit, and where their tips (the bail pivots) are.
const ARM_X = 0.0292;
const ARM_TIP_Y = 0.041;
// The bail wire leans forward over the spool lip by this angle.
const BAIL_LEAN = 0.72;
const BAIL_RADIUS = ARM_X + 0.0052;
// Handle at rest: pointing down and back toward the angler.
const HANDLE_REST = 0.7;
const CRANK_LENGTH = 0.05;
const CRANK_FLARE = 0.006;

// Line wound per turn of the handle, metres. Lower spins everything faster for the same line.
const LINE_PER_TURN = 0.72;
// Turns of the rotor per turn of the handle.
const GEAR_RATIO = 5.2;
// The spool slides this far each way, metres, once back and forth per SPOOL_EVERY handle turns.
const SPOOL_STROKE = 0.004;
const SPOOL_EVERY = 2;

export function createSpinningReel() {
  const mats = {
    body: new THREE.MeshStandardMaterial({ color: 0x1a1c1e, roughness: 0.42, metalness: 0.35 }),
    steel: new THREE.MeshStandardMaterial({ color: 0xc9cdd1, roughness: 0.28, metalness: 0.9 }),
    spool: new THREE.MeshStandardMaterial({ color: 0xaeb3b8, roughness: 0.34, metalness: 0.85 }),
    line: new THREE.MeshStandardMaterial({ color: 0xd3dcc6, roughness: 0.78, metalness: 0 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x141516, roughness: 0.9, metalness: 0 }),
  };

  const object = new THREE.Group();
  object.name = 'reel';
  const frame = buildFrame(mats);
  const rotor = buildRotor(mats);
  const spool = buildSpool(mats);
  const handle = buildHandle(mats);
  object.add(...frame, rotor, spool, handle);

  const spoolRest = spool.position.y;
  // Handle turns so far, radians.
  let turned = 0;

  return {
    object,
    rotor,
    spool,
    handle,
    // Wind in this much line, metres: the handle and rotor turn, the spool slides back
    // and forth to lay it. Line running out freely (a cast) does not come through here.
    wind(metres) {
      if (!metres) return;
      turned += (metres / LINE_PER_TURN) * Math.PI * 2;
      handle.rotation.x = HANDLE_REST + turned;
      rotor.rotation.y = turned * GEAR_RATIO;
      spool.position.y = spoolRest + SPOOL_STROKE * Math.sin(turned / SPOOL_EVERY);
    },
    // Where the line turns from the spool toward the guides. It rides on the rotor.
    lineRoller: rotor.getObjectByName('reel-line-roller'),
    dispose() {
      object.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
      for (const m of Object.values(mats)) m.dispose();
    },
  };
}

// ---------------- parts

function buildFrame(mats) {
  const footStem = new THREE.Mesh(footAndStemGeometry(), mats.body);

  // Gear housing: a rounded disc whose axis is the handle axis.
  const housing = alongX(new THREE.Mesh(lathe([
    [0, -0.0118], [0.013, -0.0118], [0.0185, -0.0098], [0.0212, -0.0055],
    [0.0212, 0.0055], [0.0185, 0.0098], [0.013, 0.0118], [0, 0.0118],
  ], 32), mats.body));
  housing.position.set(0, HOUSING_Y, HOUSING_Z);
  housing.scale.set(1.12, 1, 1);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.0145, 0.012, 0.022, 24), mats.body);
  neck.position.set(0, -0.005, SHAFT_DROP);
  const sideCap = alongX(new THREE.Mesh(new THREE.CylinderGeometry(0.0065, 0.0075, 0.003, 20), mats.body));
  sideCap.position.set(-0.013, HOUSING_Y, HOUSING_Z);
  return [footStem, housing, neck, sideCap];
}

function buildRotor(mats) {
  const rotor = new THREE.Group();
  rotor.name = 'reel-rotor';
  rotor.position.z = SHAFT_DROP;
  // Cup behind the spool. Its narrow front end runs up inside the spool skirt.
  rotor.add(new THREE.Mesh(lathe([
    [0.012, 0.004], [0.0245, 0.0062], [0.0262, 0.0095], [0.0262, 0.019],
    [0.0238, 0.0212], [0.021, 0.0212], [0.021, 0.03], [0, 0.03],
  ]), mats.body));
  for (const sign of [1, -1]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.0058, 0.025, 6, 14), mats.body);
    arm.scale.set(0.52, 1, 1);
    arm.position.set(sign * ARM_X, 0.0265, 0);
    const pivot = alongX(new THREE.Mesh(new THREE.CylinderGeometry(0.0056, 0.0056, 0.0042, 18), mats.body));
    pivot.position.set(sign * (ARM_X + 0.0035), ARM_TIP_Y, 0);
    rotor.add(arm, pivot);
  }
  rotor.add(new THREE.Mesh(bailWireGeometry(BAIL_RADIUS, ARM_TIP_Y, BAIL_LEAN), mats.steel));
  // Line roller sits where the wire leaves the first arm.
  const roller = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.0048, 14), mats.steel);
  roller.name = 'reel-line-roller';
  roller.position.set(BAIL_RADIUS - 0.0006, ARM_TIP_Y + 0.0052 * Math.sin(BAIL_LEAN), -0.0052 * Math.cos(BAIL_LEAN));
  roller.rotation.x = BAIL_LEAN - Math.PI / 2;
  const rollerCap = new THREE.Mesh(new THREE.SphereGeometry(0.0038, 12, 10), mats.body);
  rollerCap.position.copy(roller.position);
  rollerCap.position.y += 0.0042 * Math.sin(BAIL_LEAN);
  rollerCap.position.z -= 0.0042 * Math.cos(BAIL_LEAN);
  rotor.add(roller, rollerCap);
  return rotor;
}

function buildSpool(mats) {
  const spool = new THREE.Group();
  spool.name = 'reel-spool';
  spool.position.z = SHAFT_DROP;
  // Skirt over the rotor, rear flange, arbor, front lip, dished face.
  spool.add(new THREE.Mesh(lathe([
    [0.0222, 0.0228], [0.0243, 0.0232], [0.0243, 0.0322], [0.025, 0.0332],
    [0.025, 0.0344], [0.017, 0.0344], [0.017, 0.0476], [0.025, 0.0476],
    [0.0254, 0.0486], [0.0246, 0.0497], [0.0195, 0.0504], [0.0165, 0.0488], [0, 0.0488],
  ], 36), mats.spool));
  // Line wound between the two flanges.
  spool.add(new THREE.Mesh(lathe([
    [0.017, 0.0345], [0.0221, 0.0347], [0.0228, 0.041], [0.0221, 0.0473], [0.017, 0.0475],
  ], 36), mats.line));
  // Drag knob with its grip bar.
  spool.add(new THREE.Mesh(lathe([
    [0.0118, 0.0486], [0.0118, 0.0552], [0.0106, 0.057], [0, 0.0574],
  ], 24), mats.body));
  const dragBar = new THREE.Mesh(new THREE.BoxGeometry(0.019, 0.0032, 0.0042), mats.body);
  dragBar.position.y = 0.0585;
  spool.add(dragBar);
  return spool;
}

function buildHandle(mats) {
  // Built pointing along +Z, then turned to the rest angle.
  const handle = new THREE.Group();
  handle.name = 'reel-handle';
  handle.position.set(0, HOUSING_Y, HOUSING_Z);
  handle.rotation.x = HANDLE_REST;
  const boss = alongX(new THREE.Mesh(new THREE.CylinderGeometry(0.0052, 0.0078, 0.006, 18), mats.body));
  boss.position.x = 0.0145;
  const shaft = alongX(new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.014, 12), mats.steel));
  shaft.position.x = 0.023;
  const from = new THREE.Vector3(0.029, 0, 0);
  const to = new THREE.Vector3(0.029 + CRANK_FLARE, 0, CRANK_LENGTH);
  const crank = new THREE.Mesh(new THREE.CapsuleGeometry(0.0042, from.distanceTo(to), 6, 12), mats.steel);
  crank.scale.set(0.45, 1, 1);
  crank.position.copy(from).lerp(to, 0.5);
  crank.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
  const knobStem = alongX(new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0022, 0.008, 10), mats.steel));
  knobStem.position.set(to.x + 0.004, 0, to.z);
  // Paddle knob: a turned profile, flattened.
  const knob = alongX(new THREE.Mesh(lathe([
    [0, 0], [0.0048, 0.0006], [0.0046, 0.005], [0.0078, 0.013], [0.0088, 0.021],
    [0.0074, 0.0275], [0.004, 0.0306], [0, 0.0312],
  ], 20), mats.rubber));
  knob.scale.set(1, 1, 0.62);
  knob.position.set(to.x + 0.006, 0, to.z);
  handle.add(boss, shaft, crank, knobStem, knob);
  return handle;
}

// ---------------- geometry helpers

// Turned part about Y. Points are [radius, y], listed toward +Y so faces point outward.
function lathe(points, segments = 28) {
  return new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)), segments);
}

// Lay a part built about Y along X instead.
function alongX(mesh) {
  mesh.rotation.z = -Math.PI / 2;
  return mesh;
}

// Foot and stem are one casting: a T seen from the side, extruded across the rod.
function footAndStemGeometry() {
  // u runs along the rod, v runs down from the seat.
  const s = new THREE.Shape();
  s.moveTo(-0.031, 0.0005);
  s.lineTo(0.031, 0.0005);
  s.lineTo(0.031, 0.002);
  s.quadraticCurveTo(0.013, 0.0032, 0.008, 0.009);
  s.lineTo(-0.008, 0.036);
  s.lineTo(-0.026, 0.036);
  s.lineTo(-0.013, 0.009);
  s.quadraticCurveTo(-0.017, 0.0032, -0.031, 0.002);
  s.closePath();
  const depth = 0.007;
  const geometry = new THREE.ExtrudeGeometry(s, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.0015,
    bevelSize: 0.0012,
    bevelSegments: 3,
    curveSegments: 10,
  });
  geometry.translate(0, 0, -depth / 2);
  // Shape (u, v, depth) becomes reel (y, z, x).
  geometry.applyMatrix4(new THREE.Matrix4().makeBasis(
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, 0, 1),
    new THREE.Vector3(1, 0, 0),
  ));
  return geometry;
}

// Half circle between the two rotor arm tips, leaning forward over the spool lip.
function bailWireGeometry(radius, y, lean) {
  const dir = new THREE.Vector3(0, Math.sin(lean), -Math.cos(lean));
  const points = [];
  for (let i = 0; i <= 28; i += 1) {
    const a = (i / 28) * Math.PI;
    points.push(new THREE.Vector3(Math.cos(a) * radius, y, 0).addScaledVector(dir, Math.sin(a) * radius));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 56, 0.0011, 8, false);
}
