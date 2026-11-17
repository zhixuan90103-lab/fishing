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
  addReel(root, dark, metal);
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
  const cap = sleeve(0.017, 0.012, 0, seatMat);
  root.add(rear, seat, fore, cap);
}

function smoother(t) {
  const x = THREE.MathUtils.clamp(t, 0, 1);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

function crankGeometry(hang) {
  const y = -0.016;
  const hubInner = 0.016;
  const joint = new THREE.Vector3(hubInner + 0.01, y, hang);
  const armRoot = joint.clone().add(new THREE.Vector3(0.008, 0, 0));
  const armEnd = armRoot.clone().add(new THREE.Vector3(0.0056, 0, 0.0315));
  const gripJoint = armEnd.clone().add(new THREE.Vector3(0.008, 0, 0));
  const gripEnd = gripJoint.clone().add(new THREE.Vector3(0.0175, 0, 0));
  const stations = [
    { p: new THREE.Vector3(hubInner, y, hang), r: 0.009 },
    { p: joint.clone(), r: 0.009 },
    { p: armRoot, r: 0.0055 },
    { p: armEnd, r: 0.0055 },
    { p: armEnd.clone().lerp(gripJoint, 0.5), r: 0.0035 },
    { p: gripJoint, r: 0.0055 },
    { p: gripJoint.clone().lerp(gripEnd, 0.4), r: 0.0075 },
    { p: gripEnd, r: 0.0075 },
  ];

  const samples = [];
  const push = (p, r) => {
    const last = samples[samples.length - 1];
    if (last && last.p.distanceTo(p) < 1e-5) return;
    samples.push({ p: p.clone(), r });
  };
  const pushLine = (a, b, ra, rb, steps) => {
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      push(a.clone().lerp(b, t), ra + (rb - ra) * smoother(t));
    }
  };
  const cuts = stations.map((station, i) => {
    if (i === 0 || i === stations.length - 1) return null;
    const a = stations[i - 1].p;
    const b = station.p;
    const c = stations[i + 1].p;
    const d1 = b.clone().sub(a).normalize();
    const d2 = c.clone().sub(b).normalize();
    const phi = Math.acos(THREE.MathUtils.clamp(d1.dot(d2), -1, 1));
    if (phi < 0.08) return null;
    const t = Math.min(0.007 / Math.tan(phi / 2), a.distanceTo(b) * 0.45, b.distanceTo(c) * 0.45);
    const p1 = b.clone().addScaledVector(d1, -t);
    const p2 = b.clone().addScaledVector(d2, t);
    const bisector = d1.clone().negate().add(d2).normalize();
    const center = b.clone().addScaledVector(bisector, t / Math.sin(phi / 2));
    return { p1, p2, center, start: p1.clone().sub(center), end: p2.clone().sub(center) };
  });
  for (let i = 0; i < stations.length - 1; i += 1) {
    const from = cuts[i] ? cuts[i].p2 : stations[i].p;
    const to = cuts[i + 1] ? cuts[i + 1].p1 : stations[i + 1].p;
    pushLine(from, to, stations[i].r, stations[i + 1].r, 6);
    const cut = cuts[i + 1];
    if (!cut) continue;
    const axis = new THREE.Vector3().crossVectors(cut.start, cut.end).normalize();
    const ang = cut.start.angleTo(cut.end);
    for (let s = 1; s <= 8; s += 1) {
      push(cut.start.clone().applyAxisAngle(axis, ang * (s / 8)).add(cut.center), stations[i + 1].r);
    }
  }

  const radial = 16;
  const up = new THREE.Vector3(0, 1, 0);
  const rings = samples.length;
  const positions = [];
  const indices = [];
  const tangents = samples.map((s, i) => {
    const prev = samples[Math.max(0, i - 1)].p;
    const next = samples[Math.min(rings - 1, i + 1)].p;
    return next.clone().sub(prev).normalize();
  });
  for (let i = 0; i < rings; i += 1) {
    const side = new THREE.Vector3().crossVectors(up, tangents[i]).normalize();
    const lift = new THREE.Vector3().crossVectors(tangents[i], side).normalize();
    for (let k = 0; k < radial; k += 1) {
      const a = (k / radial) * Math.PI * 2;
      const p = samples[i].p.clone()
        .addScaledVector(side, Math.cos(a) * samples[i].r)
        .addScaledVector(lift, Math.sin(a) * samples[i].r);
      positions.push(p.x, p.y, p.z);
    }
  }
  for (let i = 0; i < rings - 1; i += 1) {
    for (let k = 0; k < radial; k += 1) {
      const k1 = (k + 1) % radial;
      const a = i * radial + k;
      const b = i * radial + k1;
      const c = (i + 1) * radial + k;
      const d = (i + 1) * radial + k1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const startCenter = positions.length / 3;
  positions.push(samples[0].p.x, samples[0].p.y, samples[0].p.z);
  for (let k = 0; k < radial; k += 1) {
    const k1 = (k + 1) % radial;
    indices.push(k, k1, startCenter);
  }
  const tip = samples[rings - 1].p;
  const tipDir = tangents[rings - 1];
  const capRings = 6;
  const capStart = positions.length / 3;
  for (let i = 1; i <= capRings; i += 1) {
    const u = i / capRings;
    const ang = u * Math.PI / 2;
    const along = Math.sin(ang) * samples[rings - 1].r;
    const rad = Math.cos(ang) * samples[rings - 1].r;
    const center = tip.clone().addScaledVector(tipDir, along);
    const side = new THREE.Vector3().crossVectors(up, tipDir).normalize();
    const lift = new THREE.Vector3().crossVectors(tipDir, side).normalize();
    for (let k = 0; k < radial; k += 1) {
      const a = (k / radial) * Math.PI * 2;
      const p = center.clone()
        .addScaledVector(side, Math.cos(a) * rad)
        .addScaledVector(lift, Math.sin(a) * rad);
      positions.push(p.x, p.y, p.z);
    }
  }
  const base = (rings - 1) * radial;
  for (let k = 0; k < radial; k += 1) {
    const k1 = (k + 1) % radial;
    indices.push(base + k, capStart + k, base + k1, base + k1, capStart + k, capStart + k1);
  }
  for (let i = 0; i < capRings - 1; i += 1) {
    for (let k = 0; k < radial; k += 1) {
      const k1 = (k + 1) % radial;
      const a = capStart + i * radial + k;
      const b = capStart + i * radial + k1;
      const c = capStart + (i + 1) * radial + k;
      const d = capStart + (i + 1) * radial + k1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const nose = positions.length / 3;
  const noseP = tip.clone().addScaledVector(tipDir, samples[rings - 1].r);
  positions.push(noseP.x, noseP.y, noseP.z);
  const noseRing = capStart + (capRings - 1) * radial;
  for (let k = 0; k < radial; k += 1) {
    indices.push(noseRing + k, nose, noseRing + (k + 1) % radial);
  }

  const geometry = new THREE.BufferGeometry();
  for (let i = 0; i < indices.length; i += 3) {
    const swap = indices[i + 1];
    indices[i + 1] = indices[i + 2];
    indices[i + 2] = swap;
  }
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function addReel(root, dark, metal) {
  // From the butt the camera looks toward the tip. The spool's rear face must sit
  // inside the rotor, or that face reads as a white disk. The lip stays at the tip end.
  const reel = new THREE.Group();
  reel.name = 'reel';
  const hang = 0.046;
  reel.position.set(0, REAR_GRIP + SEAT * 0.4, 0.013);

  const foot = new THREE.Mesh(new THREE.BoxGeometry(0.011, 0.052, 0.005), dark);
  foot.position.set(0, 0, 0.0025);

  const stem = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.02, 0.028), dark);
  stem.position.set(0, -0.01, 0.018);

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.022, 18, 14), dark);
  body.scale.set(0.9, 1.05, 0.82);
  body.position.set(0, -0.018, hang);

  const rotor = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.024, 0.02, 20), dark);
  rotor.position.set(0, 0.006, hang);

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.012, 20), dark);
  barrel.position.set(0, 0.016, hang);
  const lip = new THREE.Mesh(new THREE.CylinderGeometry(0.0235, 0.0235, 0.0025, 24), dark);
  lip.position.set(0, 0.024, hang);
  const drag = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.005, 14), dark);
  drag.position.set(0, 0.028, hang);

  const bail = new THREE.Mesh(
    new THREE.TorusGeometry(0.027, 0.002, 8, 24, Math.PI * 1.35),
    dark,
  );
  bail.rotation.x = Math.PI / 2;
  bail.position.set(0, 0.012, hang);

  // One swept crank: hub, both joint balls, arm and grip. Radius changes
  // with a smoothstep so the old mesh seams do not show.
  const crank = new THREE.Mesh(crankGeometry(hang), dark);
  reel.add(foot, stem, body, rotor, barrel, lip, drag, bail, crank);
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
