/**
 * First-person spinning lure rod.
 * The blank is one skinned shaft from butt to tip. Grip and reel seat are sleeves on that axis.
 * Local +Y runs butt to tip. Local +Z is the underside: guides and the spinning reel hang there.
 */

import * as THREE from 'three/webgpu';

const LENGTH = 2.13;
const REAR_GRIP = 0.2;
const SEAT = 0.1;
const FORE_GRIP = 0.04;
const BONES = 18;
const RINGS = 64;
const RADIAL = 12;

const REST_BEND = 0.06;

export function createSpinningRod() {
  const root = new THREE.Group();
  root.name = 'spinning-rod';

  const blankMat = new THREE.MeshStandardMaterial({
    color: 0x1a1e22,
    roughness: 0.4,
    metalness: 0.06,
  });
  const cork = new THREE.MeshStandardMaterial({
    color: 0xc6a36a,
    roughness: 0.86,
    metalness: 0,
  });
  const seatMat = new THREE.MeshStandardMaterial({
    color: 0x2c261e,
    roughness: 0.5,
    metalness: 0.12,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: 0x1a1c1e,
    roughness: 0.42,
    metalness: 0.35,
  });
  const metal = new THREE.MeshStandardMaterial({
    color: 0xf2f4f5,
    roughness: 0.32,
    metalness: 0.45,
    side: THREE.DoubleSide,
  });

  const bones = [];
  let parent = root;
  const seg = LENGTH / (BONES - 1);
  for (let i = 0; i < BONES; i += 1) {
    const bone = new THREE.Bone();
    bone.name = `blank-${i}`;
    bone.position.y = i === 0 ? 0 : seg;
    parent.add(bone);
    bones.push(bone);
    parent = bone;
  }

  const geometry = blankGeometry(bones.length);
  const mesh = new THREE.SkinnedMesh(geometry, blankMat);
  mesh.name = 'blank';
  const skeleton = new THREE.Skeleton(bones);
  root.add(mesh);
  mesh.add(bones[0]);
  mesh.bind(skeleton);
  addSleeves(root, cork, seatMat);
  addReel(root, dark);
  addGuides(bones, seg, metal);

  const blankDir = new THREE.Vector3(-0.12, 0.5, -0.86).normalize();
  const down = new THREE.Vector3(0, -1, 0);
  down.addScaledVector(blankDir, -down.dot(blankDir)).normalize();
  const side = new THREE.Vector3().crossVectors(blankDir, down).normalize();
  root.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(side, blankDir, down));
  root.position.set(0.08, -0.14, -0.42);
  root.traverse((obj) => {
    obj.frustumCulled = false;
  });

  let bend = REST_BEND;
  let vel = 0;

  function applyBend(amount) {
    const steps = bones.length - 1;
    const gripEnd = (REAR_GRIP + SEAT + FORE_GRIP) / LENGTH;
    for (let i = 0; i < bones.length; i += 1) {
      const t = i / steps;
      const flex = Math.max(0, (t - gripEnd) / (1 - gripEnd));
      bones[i].rotation.x = (amount * flex * flex) / steps;
    }
  }
  applyBend(bend);

  return {
    object: root,
    update(dt, swingRate) {
      const target = REST_BEND + Math.min(Math.abs(swingRate) * 0.0018, 0.45);
      const acc = (target - bend) * 90 - vel * 9;
      vel += acc * dt;
      bend += vel * dt;
      applyBend(bend);
    },
    dispose() {
      geometry.dispose();
      blankMat.dispose();
      cork.dispose();
      seatMat.dispose();
      dark.dispose();
      metal.dispose();
      root.traverse((obj) => {
        if (obj.geometry && obj.geometry !== geometry) obj.geometry.dispose();
        const mat = obj.material;
        if (mat && mat !== blankMat && mat !== cork && mat !== seatMat && mat !== dark && mat !== metal) {
          mat.dispose();
        }
      });
    },
  };
}

function blankGeometry(boneCount) {
  const positions = [];
  const indices = [];
  const skinIndex = [];
  const skinWeight = [];
  for (let i = 0; i < RINGS; i += 1) {
    const t = i / (RINGS - 1);
    const y = LENGTH * t;
    const radius = THREE.MathUtils.lerp(0.008, 0.0015, t);
    const u = t * (boneCount - 1);
    const i0 = Math.min(boneCount - 2, Math.floor(u));
    const f = u - i0;
    const w1 = f * f * (3 - 2 * f);
    for (let k = 0; k < RADIAL; k += 1) {
      const a = (k / RADIAL) * Math.PI * 2;
      positions.push(Math.cos(a) * radius, y, Math.sin(a) * radius);
      skinIndex.push(i0, i0 + 1, 0, 0);
      skinWeight.push(1 - w1, w1, 0, 0);
    }
  }
  for (let i = 0; i < RINGS - 1; i += 1) {
    for (let k = 0; k < RADIAL; k += 1) {
      const a = i * RADIAL + k;
      const b = i * RADIAL + ((k + 1) % RADIAL);
      const c = a + RADIAL;
      const d = b + RADIAL;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeight, 4));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function sleeve(radius, length, y0, material) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 16), material);
  mesh.position.y = y0 + length * 0.5;
  return mesh;
}

function addSleeves(root, cork, seatMat) {
  const rear = sleeve(0.016, REAR_GRIP, 0, cork);
  const seat = sleeve(0.012, SEAT, REAR_GRIP, seatMat);
  const fore = sleeve(0.013, FORE_GRIP, REAR_GRIP + SEAT, cork);
  const cap = sleeve(0.017, 0.012, -0.003, seatMat);
  root.add(rear, seat, fore, cap);
}

function lathe(points, segments = 28) {
  return new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)), segments);
}

function alongX(mesh) {
  mesh.rotation.z = -Math.PI / 2;
  return mesh;
}

function footAndStem() {
  // Side profile: u runs along the rod, v runs down from the seat.
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

function bailWire(radius, y, lean) {
  // Half circle between the two rotor arm tips, leaning forward over the spool lip.
  const dir = new THREE.Vector3(0, Math.sin(lean), -Math.cos(lean));
  const points = [];
  for (let i = 0; i <= 28; i += 1) {
    const a = (i / 28) * Math.PI;
    points.push(new THREE.Vector3(Math.cos(a) * radius, y, 0).addScaledVector(dir, Math.sin(a) * radius));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 56, 0.0011, 8, false);
}

function addReel(root, dark) {
  // Spinning reel, about a 2500 size. The main shaft is parallel to the blank and
  // hangs below the seat. Body, rotor, spool and handle each have their own pivot:
  // rotor turns about Y, spool slides along Y, handle turns about X.
  const steel = new THREE.MeshStandardMaterial({ color: 0xc9cdd1, roughness: 0.28, metalness: 0.9 });
  const spoolMat = new THREE.MeshStandardMaterial({ color: 0xaeb3b8, roughness: 0.34, metalness: 0.85 });
  const lineMat = new THREE.MeshStandardMaterial({ color: 0xd3dcc6, roughness: 0.78, metalness: 0 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x141516, roughness: 0.9, metalness: 0 });

  const reel = new THREE.Group();
  reel.name = 'reel';
  const hang = 0.046;
  reel.position.set(0, REAR_GRIP + SEAT * 0.5, 0.012);

  reel.add(new THREE.Mesh(footAndStem(), dark));

  // Gear housing: a rounded disc whose axis is the handle axis.
  const bodyY = -0.021;
  const bodyZ = hang + 0.003;
  const body = alongX(new THREE.Mesh(lathe([
    [0, -0.0118], [0.013, -0.0118], [0.0185, -0.0098], [0.0212, -0.0055],
    [0.0212, 0.0055], [0.0185, 0.0098], [0.013, 0.0118], [0, 0.0118],
  ], 32), dark));
  body.position.set(0, bodyY, bodyZ);
  body.scale.set(1.12, 1, 1);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.0145, 0.012, 0.022, 24), dark);
  neck.position.set(0, -0.005, hang);
  const sideCap = alongX(new THREE.Mesh(new THREE.CylinderGeometry(0.0065, 0.0075, 0.003, 20), dark));
  sideCap.position.set(-0.013, bodyY, bodyZ);
  reel.add(body, neck, sideCap);

  // Rotor: cup behind the spool, two arms beside it, bail wire between the arm tips.
  const rotor = new THREE.Group();
  rotor.name = 'reel-rotor';
  rotor.position.z = hang;
  rotor.add(new THREE.Mesh(lathe([
    [0.012, 0.004], [0.0245, 0.0062], [0.0262, 0.0095], [0.0262, 0.019],
    [0.0238, 0.0212], [0.021, 0.0212], [0.021, 0.03], [0, 0.03],
  ]), dark));
  const armTipY = 0.041;
  const armX = 0.0292;
  for (const sign of [1, -1]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.0058, 0.025, 6, 14), dark);
    arm.scale.set(0.52, 1, 1);
    arm.position.set(sign * armX, 0.0265, 0);
    const pivot = alongX(new THREE.Mesh(new THREE.CylinderGeometry(0.0056, 0.0056, 0.0042, 18), dark));
    pivot.position.set(sign * (armX + 0.0035), armTipY, 0);
    rotor.add(arm, pivot);
  }
  const bailRadius = armX + 0.0052;
  const lean = 0.72;
  rotor.add(new THREE.Mesh(bailWire(bailRadius, armTipY, lean), steel));
  // Line roller sits where the wire leaves the first arm.
  const roller = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.0048, 14), steel);
  roller.position.set(bailRadius - 0.0006, armTipY + 0.0052 * Math.sin(lean), -0.0052 * Math.cos(lean));
  roller.rotation.x = lean - Math.PI / 2;
  const rollerCap = new THREE.Mesh(new THREE.SphereGeometry(0.0038, 12, 10), dark);
  rollerCap.position.copy(roller.position);
  rollerCap.position.y += 0.0042 * Math.sin(lean);
  rollerCap.position.z -= 0.0042 * Math.cos(lean);
  rotor.add(roller, rollerCap);

  // Spool: skirt over the rotor, line between two flanges, drag knob on the front.
  const spool = new THREE.Group();
  spool.name = 'reel-spool';
  spool.position.z = hang;
  spool.add(new THREE.Mesh(lathe([
    [0.0222, 0.0228], [0.0243, 0.0232], [0.0243, 0.0322], [0.025, 0.0332],
    [0.025, 0.0344], [0.017, 0.0344], [0.017, 0.0476], [0.025, 0.0476],
    [0.0254, 0.0486], [0.0246, 0.0497], [0.0195, 0.0504], [0.0165, 0.0488], [0, 0.0488],
  ], 36), spoolMat));
  spool.add(new THREE.Mesh(lathe([
    [0.017, 0.0345], [0.0221, 0.0347], [0.0228, 0.041], [0.0221, 0.0473], [0.017, 0.0475],
  ], 36), lineMat));
  spool.add(new THREE.Mesh(lathe([
    [0.0118, 0.0486], [0.0118, 0.0552], [0.0106, 0.057], [0, 0.0574],
  ], 24), dark));
  const dragBar = new THREE.Mesh(new THREE.BoxGeometry(0.019, 0.0032, 0.0042), dark);
  dragBar.position.y = 0.0585;
  spool.add(dragBar);

  // Handle on the angler's left: shaft out of the body, flat arm, paddle knob.
  const handle = new THREE.Group();
  handle.name = 'reel-handle';
  handle.position.set(0, bodyY, bodyZ);
  handle.rotation.x = 0.7;
  const boss = alongX(new THREE.Mesh(new THREE.CylinderGeometry(0.0052, 0.0078, 0.006, 18), dark));
  boss.position.x = 0.0145;
  const shaft = alongX(new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.014, 12), steel));
  shaft.position.x = 0.023;
  const armLength = 0.05;
  const armOut = 0.006;
  const armFrom = new THREE.Vector3(0.029, 0, 0);
  const armTo = new THREE.Vector3(0.029 + armOut, 0, armLength);
  const crank = new THREE.Mesh(new THREE.CapsuleGeometry(0.0042, armFrom.distanceTo(armTo), 6, 12), steel);
  crank.scale.set(0.45, 1, 1);
  crank.position.copy(armFrom).lerp(armTo, 0.5);
  crank.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), armTo.clone().sub(armFrom).normalize());
  const knobStem = alongX(new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0022, 0.008, 10), steel));
  knobStem.position.set(armTo.x + 0.004, 0, armTo.z);
  const knob = alongX(new THREE.Mesh(lathe([
    [0, 0], [0.0048, 0.0006], [0.0046, 0.005], [0.0078, 0.013], [0.0088, 0.021],
    [0.0074, 0.0275], [0.004, 0.0306], [0, 0.0312],
  ], 20), rubber));
  knob.scale.set(1, 1, 0.62);
  knob.position.set(armTo.x + 0.006, 0, armTo.z);
  handle.add(boss, shaft, crank, knobStem, knob);

  reel.add(rotor, spool, handle);
  root.add(reel);
}

function addGuides(bones, seg, metal) {
  // 7 ft spinning train, measured from the tip. Last entry is the stripper.
  const fromTip = [0, 0.086, 0.178, 0.292, 0.435, 0.594, 0.772, 0.972, 1.2];
  const ringRadius = [0.0035, 0.0038, 0.0042, 0.0046, 0.0052, 0.006, 0.007, 0.008, 0.009];
  const gripEnd = REAR_GRIP + SEAT + FORE_GRIP;
  for (let g = 0; g < fromTip.length; g += 1) {
    const along = LENGTH - fromTip[g];
    if (along < gripEnd) continue;
    const index = Math.min(bones.length - 1, Math.round(along / seg));
    const t = along / LENGTH;
    const blankRadius = THREE.MathUtils.lerp(0.008, 0.0015, t);
    const guide = new THREE.Group();
    guide.position.y = along - index * seg;
    const radius = ringRadius[g];
    const footLen = radius + 0.0016;
    const foot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0008, 0.001, footLen, 6),
      metal,
    );
    foot.rotation.x = Math.PI / 2;
    foot.position.z = blankRadius + footLen * 0.5;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.0011, 8, 16),
      metal,
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.z = blankRadius + footLen;
    guide.add(foot, ring);
    bones[index].add(guide);
  }
}
