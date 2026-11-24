/**
 * First-person spinning lure rod: the model, and the one place its parts are put together.
 *
 * Owns: the blank, grip, reel seat and guides as geometry, the bones, and laying the bones
 * along the curve each frame.
 * Does not own: where the rod sits and how it trails the view (rodHold.js), how the blank
 * moves (rodFlex.js), what the blank is made of (rodBeam.js), the reel (reel.js), or any
 * fishing rule.
 *
 * The blank is one skinned shaft from butt to tip. Grip and reel seat are sleeves on that axis.
 * Local +Y runs butt to tip. Local +Z is the underside: guides and the spinning reel hang there.
 *
 * Each frame: the hold places the root and says where the grip is, the flex moves the
 * blank from that, the bones are laid along the flex's curve.
 */

import * as THREE from 'three/webgpu';
import { createSpinningReel } from './reel.js';
import { createRodFlex } from './rodFlex.js';
import { ROD_POSE, createRodHold } from './rodHold.js';

export { ROD_POSE };

const LENGTH = 2.13;
const REAR_GRIP = 0.2;
const SEAT = 0.1;
const FORE_GRIP = 0.04;
const SEAT_RADIUS = 0.012;
const BONES = 18;
const RINGS = 64;
const RADIAL = 12;

// Where the hand holds it, metres up from the butt: the middle of the rear grip.
const HAND_AT = REAR_GRIP * 0.5;

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
  const rings = addGuides(bones, seg, metal);

  root.traverse((obj) => {
    obj.frustumCulled = false;
  });

  const hold = createRodHold(root, HAND_AT);
  const count = bones.length;
  const flex = createRodFlex({
    length: LENGTH,
    nodes: count,
    rigidBelow: REAR_GRIP + SEAT + FORE_GRIP,
  });
  const pos = Array.from({ length: count }, () => new THREE.Vector3());
  const curve = new Float64Array(count * 3);
  const dir = new THREE.Vector3();
  const localDir = new THREE.Vector3();
  const axisX = new THREE.Vector3();
  const axisZ = new THREE.Vector3();
  const boneBasis = new THREE.Matrix4();
  const parentQ = new THREE.Quaternion();
  const invQ = new THREE.Quaternion();
  const tetherWorld = new THREE.Vector3();
  const tetherBend = new THREE.Vector3();
  let tetherLength = 0;
  let tetherStiffness = 0;
  let tetherOn = false;
  // What the tether is tied to, when that is a weight hanging on the line: it is moved
  // with the blank. null: a place in the world.
  let rider = null;
  const riderSpeed = new THREE.Vector3();

  // The flex gives each node relative to the butt, in the axes it was driven with.
  // Bring that into the rod's own frame, then out through the real transform.
  function layBlank() {
    flex.shape(hold.grip.axis, curve);
    invQ.copy(hold.grip.quaternion).invert();
    for (let i = 0; i < count; i += 1) {
      pos[i].set(curve[i * 3], curve[i * 3 + 1], curve[i * 3 + 2]).applyQuaternion(invQ);
      pos[i].applyMatrix4(root.matrixWorld);
    }
  }

  // Point each bone's local +Y along the solved segment. Local +Z stays the underside.
  function poseBones() {
    mesh.updateWorldMatrix(true, false);
    mesh.getWorldQuaternion(parentQ);
    for (let i = 0; i < count; i += 1) {
      if (i < count - 1) dir.copy(pos[i + 1]).sub(pos[i]);
      else dir.copy(pos[i]).sub(pos[i - 1]);
      if (dir.lengthSq() < 1e-10) dir.set(0, 1, 0);
      invQ.copy(parentQ).invert();
      localDir.copy(dir).applyQuaternion(invQ).normalize();
      axisZ.set(0, 0, 1).addScaledVector(localDir, -axisZ.dot(localDir));
      if (axisZ.lengthSq() < 1e-8) axisZ.set(1, 0, 0);
      axisZ.normalize();
      axisX.crossVectors(localDir, axisZ).normalize();
      bones[i].quaternion.setFromRotationMatrix(boneBasis.makeBasis(axisX, localDir, axisZ));
      parentQ.multiply(bones[i].quaternion);
    }
  }

  return {
    object: root,
    // rotor, spool and handle groups, each on its own axis. See reel.js.
    reel,
    // Where the rod sits in the view's space. Any of the ROD_POSE fields.
    setPose(next) {
      hold.setPose(next);
      flex.settle();
    },
    // The phone's aim in the view's space, degrees: lift, turn to the left, and lean
    // about the view axis. Does not settle the bend, so a fast lift whips the blank.
    setAim(pitch, yaw, roll) {
      hold.setAim(pitch, yaw, roll);
    },
    // How hard the hand is working against a pull, 0 to 1. The hand is drawn toward the
    // far end of the line, the rod tips that way and shakes: see rodHold.js. Gameplay
    // says how hard and eases it, this only shows it.
    setStrain(effort) {
      hold.setStrain(effort);
    },
    // Extra mass on the tip itself, kg. Trial only: the settings panel's slider. A lure or
    // a fish hanging on the line weighs on the rod through the line, not through this.
    setTipLoad(kg) {
      flex.setTipLoad(kg);
    },
    // A steady pull on the tip, world space, newtons. Only the part across the blank bends
    // it. A fishing line does not come through here: its pull has to follow the tip, so it
    // uses setTipTether.
    setTipForce(force) {
      flex.setTipForce(force.x, force.y, force.z);
    },
    // Tie the tip to a world point with `length` metres of line that pulls `stiffness`
    // newtons per metre of stretch and nothing while slack. null unties it. The point is
    // remembered in world space and moved into the bend's frame at the start of each step.
    // weight: what is at that point, if it is a weight hanging on the line and not
    // something that holds its place: x, y, z, vx, vy, vz in the world, and advance()
    // (lureMove.js). The rod then moves it, in step with the blank, and leaves it where
    // it has got to.
    setTipTether(point, length, stiffness, weight = null) {
      if (!point) {
        tetherOn = false;
        rider = null;
        flex.clearTipTether();
        return;
      }
      tetherOn = true;
      rider = weight;
      tetherWorld.copy(point);
      tetherLength = length;
      tetherStiffness = stiffness;
    },
    // How hard the tether pulls right now, newtons.
    get tipTension() {
      return flex.tension;
    },
    // Where the tip of the rod would be with the blank straight, world space, into `out`:
    // the tip without the bend, the nod and the whip. For whoever needs to know where the
    // rod is and must not be shaken by it (the view). Valid after update().
    steadyTip(out) {
      return out.copy(hold.grip.axis).multiplyScalar(LENGTH).add(hold.grip.butt);
    },
    // How many points linePath() gives.
    lineStops: rings.length + 1,
    // Where the line runs along the rod, world space: the reel's line roller, then every
    // guide ring from the stripper to the tip-top. Fills `out`, an array of Vector3.
    // Call after update().
    linePath(out) {
      root.updateMatrixWorld(true);
      reel.lineRoller.getWorldPosition(out[0]);
      for (let i = 0; i < rings.length; i += 1) rings[i].getWorldPosition(out[i + 1]);
    },
    update(dt) {
      if (rider) tetherWorld.set(rider.x, rider.y, rider.z);
      hold.setPull(tetherOn ? tetherWorld : null);
      hold.carry(dt);
      if (tetherOn) {
        hold.intoBend(tetherWorld, tetherBend);
        flex.setTipTether(tetherBend.x, tetherBend.y, tetherBend.z, tetherLength, tetherStiffness);
      }
      if (rider) {
        // The weight is moved in the bend's frame with the blank, then put back in the world.
        hold.turnIntoBend(riderSpeed.set(rider.vx, rider.vy, rider.vz));
        rider.x = tetherBend.x; rider.y = tetherBend.y; rider.z = tetherBend.z;
        rider.vx = riderSpeed.x; rider.vy = riderSpeed.y; rider.vz = riderSpeed.z;
        flex.step(dt, hold.grip.butt, hold.grip.axis, rider);
        hold.outOfBend(tetherBend.set(rider.x, rider.y, rider.z), tetherWorld);
        hold.turnOutOfBend(riderSpeed.set(rider.vx, rider.vy, rider.vz));
        rider.x = tetherWorld.x; rider.y = tetherWorld.y; rider.z = tetherWorld.z;
        rider.vx = riderSpeed.x; rider.vy = riderSpeed.y; rider.vz = riderSpeed.z;
      } else flex.step(dt, hold.grip.butt, hold.grip.axis);
      layBlank();
      poseBones();
    },
    dispose() {
      reel.dispose();
      root.traverse((obj) => { if (obj.geometry) obj.geometry.dispose(); });
      for (const m of [blankMat, cork, seatMat, metal]) m.dispose();
    },
  };
}

// Blank radius along the shaft, 0 at the butt and 1 at the tip. Guides stand on this.
function blankRadius(t) {
  return THREE.MathUtils.lerp(0.008, 0.0015, t);
}

function blankGeometry(boneCount) {
  const positions = [];
  const indices = [];
  const skinIndex = [];
  const skinWeight = [];
  for (let i = 0; i < RINGS; i += 1) {
    const t = i / (RINGS - 1);
    const y = LENGTH * t;
    const radius = blankRadius(t);
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

// Returns the rings in the order the line passes them: stripper first, tip-top last.
function addGuides(bones, seg, metal) {
  const rings = [];
  // 7 ft spinning train, measured from the tip. Last entry is the stripper.
  const fromTip = [0, 0.086, 0.178, 0.292, 0.435, 0.594, 0.772, 0.972, 1.2];
  const ringRadius = [0.0035, 0.0038, 0.0042, 0.0046, 0.0052, 0.006, 0.007, 0.008, 0.009];
  const gripEnd = REAR_GRIP + SEAT + FORE_GRIP;
  for (let g = 0; g < fromTip.length; g += 1) {
    const along = LENGTH - fromTip[g];
    if (along < gripEnd) continue;
    const index = Math.min(bones.length - 1, Math.round(along / seg));
    const t = along / LENGTH;
    const radiusOnBlank = blankRadius(t);
    const guide = new THREE.Group();
    guide.position.y = along - index * seg;
    const radius = ringRadius[g];
    const footLen = radius + 0.0016;
    const foot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0008, 0.001, footLen, 6),
      metal,
    );
    foot.rotation.x = Math.PI / 2;
    foot.position.z = radiusOnBlank + footLen * 0.5;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.0011, 8, 16),
      metal,
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.z = radiusOnBlank + footLen;
    guide.add(foot, ring);
    bones[index].add(guide);
    rings.unshift(ring);
  }
  return rings;
}
