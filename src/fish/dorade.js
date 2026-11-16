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
  return { holder, mixer, action, roughnessNode };
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
    free.push({ holder, mixer, action, active: false });
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
