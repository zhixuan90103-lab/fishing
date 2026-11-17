/**
 * First-person spinning lure rod.
 * The blank is one skinned shaft from butt to tip. Grip and reel seat are sleeves on that axis.
 * Local +Y runs butt to tip. Local +Z is the underside: guides and the spinning reel hang there.
 * The reel is its own model in reel.js. Here it is only seated on the reel seat.
 */

import * as THREE from 'three/webgpu';
import { createSpinningReel } from './reel.js';

const LENGTH = 2.13;
const REAR_GRIP = 0.2;
const SEAT = 0.1;
const FORE_GRIP = 0.04;
const SEAT_RADIUS = 0.012;
const BONES = 18;
const RINGS = 64;
const RADIAL = 12;

const REST_BEND = 0.06;

// Camera-space mount, metres and degrees.
export const ROD_POSE = {
  x: 0.1,
  y: -0.32,
  z: -0.42,
  aimUp: 30,
  aimSide: -4,
  roll: 0,
};

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
  const reel = createSpinningReel();
  reel.object.position.set(0, REAR_GRIP + SEAT * 0.5, SEAT_RADIUS);
  root.add(reel.object);
  addGuides(bones, seg, metal);

  const pose = { ...ROD_POSE };
  const blankDir = new THREE.Vector3();
  const down = new THREE.Vector3();
  const side = new THREE.Vector3();
  const rollQ = new THREE.Quaternion();
  const basis = new THREE.Matrix4();
  function applyPose() {
    aimDirection(pose.aimUp, pose.aimSide, blankDir);
    down.set(0, -1, 0).addScaledVector(blankDir, -down.dot(blankDir));
    if (down.lengthSq() < 1e-8) down.set(0, 0, 1);
    down.normalize();
    if (pose.roll) {
      rollQ.setFromAxisAngle(blankDir, pose.roll * Math.PI / 180);
      down.applyQuaternion(rollQ);
    }
    side.crossVectors(blankDir, down).normalize();
    root.quaternion.setFromRotationMatrix(basis.makeBasis(side, blankDir, down));
    root.position.set(pose.x, pose.y, pose.z);
  }
  applyPose();
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
    // rotor, spool and handle groups, each on its own axis. See reel.js.
    reel,
    // Camera space, metres and degrees. aimUp rises off the view axis, aimSide yaws it, roll spins the reel around the blank.
    setPose(next) {
      Object.assign(pose, next);
      applyPose();
    },
    update(dt, swingRate) {
      const target = REST_BEND + Math.min(Math.abs(swingRate) * 0.0018, 0.45);
      const acc = (target - bend) * 90 - vel * 9;
      vel += acc * dt;
      bend += vel * dt;
      applyBend(bend);
    },
    dispose() {
      reel.dispose();
      root.traverse((obj) => { if (obj.geometry) obj.geometry.dispose(); });
      for (const m of [blankMat, cork, seatMat, metal]) m.dispose();
    },
  };
}

function aimDirection(aimUpDeg, aimSideDeg, target) {
  const aimUp = aimUpDeg * Math.PI / 180;
  const aimSide = aimSideDeg * Math.PI / 180;
  return target.set(
    Math.sin(aimSide) * Math.cos(aimUp),
    Math.sin(aimUp),
    -Math.cos(aimSide) * Math.cos(aimUp),
  ).normalize();
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
  const seat = sleeve(SEAT_RADIUS, SEAT, REAR_GRIP, seatMat);
  const fore = sleeve(0.013, FORE_GRIP, REAR_GRIP + SEAT, cork);
  const cap = sleeve(0.017, 0.012, -0.003, seatMat);
  root.add(rear, seat, fore, cap);
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
