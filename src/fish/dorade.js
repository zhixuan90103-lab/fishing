// Bream Fish (Dorade Royale) by BlueMesh, CC BY.
// https://sketchfab.com/3d-models/bream-fish-dorade-royale-a3d0e1a597794a9bb74739a13cfc8b77
//
// The file is KHR_materials_pbrSpecularGlossiness. Three r186 does not load that
// extension, so the albedo never arrives and metalness stays 1. Texture 2 is a
// cyan mask, not occlusion and not a normal map. There is no normal texture.

import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { texture, float } from 'three/tsl';
import { toNodeMaterial } from '../shore/minamo/scene/world.js';

// Spine joints from behind the head to the tail root. The clip swings these by 1 to 8
// degrees, all in phase, so the body reads as a stiff board. poseSpine adds a wave that
// travels toward the tail on top of the clip.
// [bone, swing in degrees at drive 1, phase lag, share of the turn bend]
const DEG = Math.PI / 180;
const SPINE = [
  ['Bone001_Armature', 1.6, 0.25, 0.14],
  ['Bone002_Armature', 3.2, 0.55, 0.2],
  ['Bone003_Armature', 4.6, 0.85, 0.22],
  ['Bone004_Armature', 6, 1.15, 0.2],
  ['Bone005_Armature', 7, 1.45, 0.14],
  ['Bone006_Armature', 8.5, 1.75, 0.1],
];
// The dorsal fin and the belly hang off the head bone, not the spine. Each of these
// copies the spine joint at the same station, or the fin stays straight over a bent back.
const FOLLOW = [
  ['Bone020_Armature', 0],
  ['Bone026_Armature', 0],
  ['Bone027_Armature', 1],
  ['Bone028_Armature', 2],
  ['Bone029_Armature', 3],
  ['Bone030_Armature', 4],
];
const CLIP_BEATS = 2;
const spineQ = new THREE.Quaternion();
const spineUp = new THREE.Vector3();

function rigSpine(fish) {
  fish.holder.updateMatrixWorld(true);
  const holderQ = fish.holder.getWorldQuaternion(new THREE.Quaternion()).invert();
  const joint = (name, station) => {
    const bone = fish.holder.getObjectByName(name);
    if (!bone) return null;
    // The fish's up axis in this bone's own frame. Bending is always about that.
    const q = holderQ.clone().multiply(bone.getWorldQuaternion(new THREE.Quaternion()));
    const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(q.invert()).normalize();
    return { bone, axis, station, base: bone.quaternion.clone(), last: bone.quaternion.clone() };
  };
  fish.spine = [
    ...SPINE.map(([name], i) => joint(name, i)),
    ...FOLLOW.map(([name, station]) => joint(name, station)),
  ].filter(Boolean);
  fish.beat = (Math.PI * 2 * CLIP_BEATS) / (fish.action.getClip().duration || 1);
  return fish;
}

// Call after mixer.update. drive scales the tail beat (0 is a stiff glide, 1 is a
// working stroke). bend is the whole-body curve in radians, positive when the fish
// turns to its left (toward +X with the head on +Z).
// The mixer only writes a bone when its track value changes, so the clip pose is
// tracked here and the wave is never stacked on its own last output.
export function poseSpine(fish, drive, bend) {
  const phase = fish.action.time * fish.beat;
  for (let i = 0; i < fish.spine.length; i++) {
    const s = fish.spine[i];
    const row = SPINE[s.station];
    if (!s.bone.quaternion.equals(s.last)) s.base.copy(s.bone.quaternion);
    const angle = row[1] * DEG * drive * Math.cos(phase - row[2]) - row[3] * bend;
    spineQ.setFromAxisAngle(spineUp.copy(s.axis), angle);
    s.bone.quaternion.copy(s.base).multiply(spineQ);
    s.last.copy(s.bone.quaternion);
  }
}

export async function loadDorade(length = 1) {
  const gltf = await new GLTFLoader().loadAsync('./assets/models/dorade-royale.glb');
  const diffuse = await gltf.parser.getDependency('texture', 0);
  const specGloss = await gltf.parser.getDependency('texture', 1);
  diffuse.colorSpace = THREE.SRGBColorSpace;
  diffuse.flipY = false;
  specGloss.flipY = false;

  const root = gltf.scene;
  const lights = [];
  root.traverse((o) => { if (o.isLight) lights.push(o); });
  for (const light of lights) light.removeFromParent();

  const gloss = texture(specGloss).a;
  const roughnessNode = float(1).sub(gloss.mul(0.55));

  root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = false;
    o.receiveShadow = false;
    o.frustumCulled = false;
    const src = o.material;
    const mat = toNodeMaterial(src);
    mat.map = diffuse;
    mat.normalMap = null;
    mat.aoMap = null;
    mat.metalness = 0;
    mat.metalnessMap = null;
    mat.roughnessMap = null;
    // glTF is double sided. The body is a thick shell, and from above both
    // flanks face the camera, so it reads as two fish. Rocks are front-sided.
    mat.transparent = false;
    mat.opacity = 1;
    mat.alphaTest = 0.4;
    mat.depthWrite = true;
    mat.side = THREE.FrontSide;
    o.material = mat;
  });

  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const span = Math.max(size.x, size.y, size.z) || 1;
  root.scale.setScalar(length / span);
  root.updateMatrixWorld(true);
  box.setFromObject(root);
  root.position.sub(box.getCenter(new THREE.Vector3()));

  const holder = new THREE.Group();
  holder.add(root);
  const mixer = new THREE.AnimationMixer(root);
  const action = mixer.clipAction(gltf.animations[0]);
  action.play();
  return rigSpine({ holder, mixer, action, roughnessNode });
}

// One GLB load. Clones share geometry and materials. Each fish gets its own skeleton and mixer.
// acquire / release only move objects on the free list. They do not load, clone, or dispose.
export function createDoradePool(template, capacity) {
  const clip = template.action.getClip();
  const free = [];
  for (let i = 0; i < capacity; i++) {
    const holder = cloneSkinned(template.holder);
    holder.name = 'dorade';
    holder.visible = false;
    const root = holder.children[0];
    const mixer = new THREE.AnimationMixer(root);
    const action = mixer.clipAction(clip);
    action.play();
    action.paused = true;
    free.push(rigSpine({ holder, mixer, action, active: false }));
  }
  return {
    acquire() {
      const fish = free.pop();
      if (!fish) return null;
      fish.active = true;
      fish.holder.visible = true;
      fish.action.paused = false;
      return fish;
    },
    release(fish) {
      if (!fish || !fish.active) return;
      fish.active = false;
      fish.action.paused = true;
      fish.holder.visible = false;
      fish.holder.removeFromParent();
      free.push(fish);
    },
  };
}
