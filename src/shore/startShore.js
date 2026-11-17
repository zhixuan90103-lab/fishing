/**
 * Minamo shore (MIT, kanaworksai-hue/minamo) inside the portrait stage.
 * Water is the 3×256² FFT ocean. Rocks, sand and the shore camera stay.
 * The visible image is drawn to #shore-view at the design resolution.
 */

import * as THREE from 'three/webgpu';
import { params, applyUrl, QUALITY } from './minamo/params.js';
import { Ocean } from './minamo/ocean/ocean.js';
import { makeOceanNodes, updateOceanUniforms } from './minamo/ocean/oceanNodes.js';
import { makeWaterMaterial, makeRadialGrid } from './minamo/ocean/waterMaterial.js';
import { loadSky, buildWorld, SHADOW_LAYER } from './minamo/scene/world.js';
import { createShoreSchool } from '../fish/school.js';
import { ROD_POSE, createSpinningRod } from './rod.js';
import { createFishingLine } from './line.js';
import { createLure } from './lure.js';
import { createFishing } from '../play/fishing.js';
import { createPhoneLook } from './phoneLook.js';
import { PITCH_LIMIT, createAim } from './aim.js';
import { makeParticles } from './minamo/scene/particles.js';
import { Post } from './minamo/post/post.js';
import { LensDrops } from './minamo/post/lensDrops.js';

export async function startShore(container, hooks = {}) {
  if (!navigator.gpu) throw new Error('WebGPU unavailable');

  const query = applyUrl(params);
  if (!query.has('quality')) Object.assign(params, QUALITY.medium);
  // Calm water for the fishing spot. Land is +z, open sea is -z.
  params.windSpeed = 0.8;
  params.swellHeight = 0;
  params.choppiness = 0.02;
  params.foamStrength = 0.12;
  // JONSWAP at low wind is short and dense. Scale the whole spectrum down so the spot reads as a calm shore.
  params.waveScale = 0.22;
  params.autoExposure = false;
  params.exposure = 0.61;
  params.sunScale = 0.37;
  params.waterRoughness = 0.2;
  params.sss = 0.22;
  params.refractStrength = 1.32;
  params.bloom = 0.012;

  const renderer = new THREE.WebGPURenderer({ antialias: false, powerPreference: 'high-performance' });
  await renderer.init();
  if (!renderer.backend.isWebGPUBackend) throw new Error('WebGPU backend required');
  const device = renderer.backend.device;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.display = 'none';
  container.appendChild(renderer.domElement);

  const canvas = document.createElement('canvas');
  canvas.id = 'shore-view';
  canvas.style.position = 'absolute';
  canvas.style.inset = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.zIndex = '0';
  canvas.style.touchAction = 'none';
  const ui = container.querySelector('#ui-root');
  if (ui) container.insertBefore(canvas, ui);
  else container.appendChild(canvas);

  const ctx = canvas.getContext('webgpu');
  const format = navigator.gpu.getPreferredCanvasFormat();
  ctx.configure({
    device,
    format,
    alphaMode: 'opaque',
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
  });

  hooks.onStatus?.('loading sky…');
  const sky = await loadSky(params.hdri);
  const sun = sky.sun;
  const scene = new THREE.Scene();
  scene.background = sky.texture;
  scene.environment = sky.texture;

  const ocean = new Ocean(device, params);
  const O = makeOceanNodes(ocean, params);
  const external = (gpuTexture, float32 = false) => {
    const t = new THREE.ExternalTexture(gpuTexture);
    if (float32) {
      t.type = THREE.FloatType;
      t.format = THREE.RedFormat;
      t.minFilter = t.magFilter = THREE.NearestFilter;
    }
    return t;
  };
  const water = makeWaterMaterial(
    O,
    sky.texture,
    params,
    external(device.createTexture({ size: [1, 1], format: 'rgba16float', usage: GPUTextureUsage.TEXTURE_BINDING })),
    external(device.createTexture({ size: [1, 1], format: 'r32float', usage: GPUTextureUsage.TEXTURE_BINDING }), true),
  );
  const waterGrid = makeRadialGrid();
  const waterScenes = [water.backMaterial, water.material].map((m) => {
    const mesh = new THREE.Mesh(waterGrid, m);
    mesh.frustumCulled = false;
    return new THREE.Scene().add(mesh);
  });

  const sunLight = new THREE.DirectionalLight(0xffffff, 1);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  const sc = sunLight.shadow.camera;
  sc.left = -45; sc.right = 45; sc.top = 45; sc.bottom = -45; sc.near = 1; sc.far = 400;
  sunLight.shadow.bias = -0.0004;
  sunLight.shadow.normalBias = 0.03;
  sc.layers.enable(SHADOW_LAYER);
  scene.add(sunLight, sunLight.target);

  hooks.onStatus?.('loading shore…');
  const world = await buildWorld(scene, O, sky, params);
  const particles = makeParticles(O);
  scene.add(particles.mesh);
  // Bream Fish (Dorade Royale) by BlueMesh, CC BY.
  // https://sketchfab.com/3d-models/bream-fish-dorade-royale-a3d0e1a597794a9bb74739a13cfc8b77
  // Same materials as fish.html. Do not run them through underwaterize.
  // Swim rules: docs/FISH-SCHOOL.md
  const shoreSchool = await createShoreSchool(scene);

  const camera = new THREE.PerspectiveCamera(params.fov, 390 / 844, 0.05, 20000);
  camera.coordinateSystem = THREE.WebGPUCoordinateSystem;
  const tune = {
    fogNear: 0,
    fogFar: 180,
    fogColor: '#bdd7ea',
    windSpeed: params.windSpeed,
    swellHeight: params.swellHeight,
    choppiness: params.choppiness,
    foamStrength: params.foamStrength,
    roughness: params.waterRoughness,
    sss: params.sss,
    refract: params.refractStrength,
    exposure: params.exposure,
    sunScale: params.sunScale,
    x: 0,
    y: 1.7,
    z: 2,
    yaw: 100,
    pitch: -10,
    swimRate: 1,
    rodX: ROD_POSE.x,
    rodY: ROD_POSE.y,
    rodZ: ROD_POSE.z,
    rodAimUp: ROD_POSE.aimUp,
    rodAimSide: ROD_POSE.aimSide,
    rodRoll: ROD_POSE.roll,
    // Grams on the rod tip. Trial only: nothing hangs there yet.
    rodLoad: 0,
  };
  // Phone to view and rod: phoneLook reads the attitude, aim shares it out, and this file
  // only places the camera and hands the rod its part. docs/PHONE-LOOK.md.
  const phone = createPhoneLook();
  const aim = createAim(tune.yaw, tune.pitch);
  let phoneAsked = false;
  let phonePrimed = false;
  // Gameplay sets this for the whole cast. The finger does the same while it is down.
  let lookLocked = false;
  // Positive yaw turns toward the camera's left. The eye stays at the panel's position
  // and the horizon never rolls.
  const placeLook = (yawDeg, pitchDeg) => {
    const yaw = yawDeg * Math.PI / 180;
    const pitch = THREE.MathUtils.clamp(pitchDeg, -PITCH_LIMIT, PITCH_LIMIT) * Math.PI / 180;
    const fx = Math.sin(yaw) * Math.cos(pitch);
    const fy = Math.sin(pitch);
    const fz = Math.cos(yaw) * Math.cos(pitch);
    camera.up.set(0, 1, 0);
    camera.position.set(tune.x, tune.y, tune.z);
    camera.lookAt(tune.x + fx, tune.y + fy, tune.z + fz);
    camera.updateMatrixWorld();
  };
  // The phone as it is held right now looks along the panel's camera. Also the way back
  // to the default view after the sensor's heading has wandered.
  const recenter = () => {
    aim.reset(tune.yaw, tune.pitch);
    phone.recenter();
  };
  const applyCamera = () => {
    recenter();
    placeLook(aim.viewYaw, aim.viewPitch);
  };
  const applyPhone = (dt) => {
    if (!phone.active) return;
    if (!phonePrimed) {
      recenter();
      phonePrimed = true;
      if (phoneHint) phoneHint.remove();
    }
    phone.advance(dt);
    aim.step(phone.look(), pressing || lookLocked, dt);
    placeLook(aim.viewYaw, aim.viewPitch);
    rod.setAim(aim.rodPitch, aim.rodYaw, aim.rodRoll);
  };
  applyCamera();
  shoreSchool.place(tune);
  const rod = createSpinningRod();
  scene.add(camera);
  camera.add(rod.object);
  const applyRod = () => {
    rod.setPose({
      x: tune.rodX,
      y: tune.rodY,
      z: tune.rodZ,
      aimUp: tune.rodAimUp,
      aimSide: tune.rodAimSide,
      roll: tune.rodRoll,
    });
    rod.setTipLoad(tune.rodLoad / 1000);
  };
  const line = createFishingLine(rod);
  scene.add(line.object);
  const lure = createLure();
  scene.add(lure.object);
  // The cast: it alone says where the line ends, how much is out and when the view locks.
  const fishing = createFishing({
    rod,
    line,
    lure,
    lockLook(locked) { lookLocked = locked; },
  });
  let fishingBegun = false;
  // The panel's cast readout is refreshed every this many frames.
  const READOUT_EVERY = 6;
  let readoutIn = 0;
  const fishingInput = { finger: false, sensor: false, viewYaw: 0, aimPitch: 0 };
  const post = new Post(device, ocean, format);
  const drops = new LensDrops();

  let rt = null;
  let W = 0;
  let H = 0;
  let cssW = 390;
  let cssH = 844;

  function resize(w, h) {
    cssW = w;
    cssH = h;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rw = Math.max(64, Math.round(w * dpr * params.renderScale));
    const rh = Math.max(64, Math.round(h * dpr * params.renderScale));
    canvas.width = rw;
    canvas.height = rh;
    if (rt && rw === W && rh === H) return;
    W = rw;
    H = rh;
    if (rt) rt.dispose();
    rt = new THREE.RenderTarget(W, H, { type: THREE.HalfFloatType, depthBuffer: true });
    rt.depthTexture = new THREE.DepthTexture(W, H);
    camera.aspect = w / Math.max(h, 1);
    camera.updateProjectionMatrix();
    world.updateLods(H, camera.fov);
    post.resize(W, H);
    water.setBackdrop(external(post.backdrop));
    water.setNearS(external(post.nearTex, true));
    rt._needsPostBind = true;
  }

  let dragging = false;
  let pressing = false;
  // Desktop stand-in for the finger: there a drag turns the view, so the space bar presses.
  let spaceDown = false;
  const onKey = (e) => {
    if (e.code !== 'Space') return;
    spaceDown = e.type === 'keydown';
    e.preventDefault();
  };
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);
  const yawInput = { el: null };
  const pitchInput = { el: null };
  const phoneHint = document.createElement('button');
  phoneHint.type = 'button';
  phoneHint.textContent = '允许手机转动';
  phoneHint.style.cssText = 'position:absolute;left:50%;top:16px;transform:translateX(-50%);margin:0;padding:10px 16px;border:0;border-radius:999px;background:rgba(0,0,0,0.55);color:#fff;font:15px/1.2 sans-serif;pointer-events:auto;z-index:3;';
  ui?.appendChild(phoneHint);
  phoneHint.addEventListener('click', () => {
    if (phoneAsked) return;
    phoneAsked = true;
    phone.enable().then((ok) => {
      if (!phoneHint) return;
      if (ok) phoneHint.remove();
      else phoneHint.textContent = '没有转动权限，仍用拖动看画面';
    });
  });
  const endPress = () => {
    pressing = false;
    dragging = false;
  };
  canvas.addEventListener('pointerdown', (e) => {
    pressing = true;
    canvas.setPointerCapture(e.pointerId);
    if (!phone.active) dragging = true;
  });
  canvas.addEventListener('pointerup', endPress);
  canvas.addEventListener('pointercancel', endPress);
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging || phone.active || lookLocked) return;
    tune.yaw -= e.movementX * 0.17;
    tune.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, tune.pitch - e.movementY * 0.17));
    if (yawInput.el) yawInput.el.value = String(Math.round(tune.yaw));
    if (pitchInput.el) pitchInput.el.value = String(Math.round(tune.pitch));
    applyCamera();
  });

  let time = 0;
  let running = true;
  let waveDirty = false;

  function frame(dt) {
    time += dt;
    camera.updateMatrixWorld();
    sunLight.color.copy(sun.color).multiplyScalar(params.sunScale);
    sunLight.intensity = 1;
    const fwd = camera.getWorldDirection(new THREE.Vector3());
    const focus = camera.position.clone().addScaledVector(fwd, 25);
    sunLight.target.position.copy(focus);
    sunLight.position.copy(focus).addScaledVector(sun.dir, 150);
    sunLight.target.updateMatrixWorld();

    const sunState = { dir: sun.dir, color: sunLight.color, ambient: sun.ambient };
    updateOceanUniforms(O, params, sunState);
    O.U.camXZ.value.set(camera.position.x, camera.position.z);
    O.U.camFwd.value.copy(fwd);
    O.U.time.value = time;
    params.windSpeed = tune.windSpeed;
    params.swellHeight = tune.swellHeight;
    params.choppiness = tune.choppiness;
    params.foamStrength = tune.foamStrength;
    params.waterRoughness = tune.roughness;
    params.sss = tune.sss;
    params.refractStrength = tune.refract;
    params.exposure = tune.exposure;
    params.sunScale = tune.sunScale;
    water.uniforms.roughness.value = tune.roughness;
    water.uniforms.sss.value = tune.sss;
    water.uniforms.refractStrength.value = tune.refract;
    water.uniforms.fogNear.value = tune.fogNear;
    water.uniforms.fogFar.value = Math.max(tune.fogNear + 1, tune.fogFar);
    water.uniforms.fogColor.value.set(tune.fogColor);
    if (waveDirty) {
      ocean.rebuildSpectrum();
      waveDirty = false;
    }
    particles.update(camera, time);
    if (fishingBegun) {
      fishingInput.sensor = phone.active;
      fishingInput.finger = phone.active ? pressing : spaceDown;
      fishingInput.viewYaw = (phone.active ? aim.viewYaw : tune.yaw) * Math.PI / 180;
      fishingInput.aimPitch = aim.viewPitch + aim.rodPitch;
      fishing.update(dt, fishingInput);
    }
    applyPhone(dt);
    rod.update(dt);
    line.update();
    if (fishingBegun) {
      fishing.follow();
      readoutIn -= 1;
      if (tuneUi.open && readoutIn <= 0) {
        readoutIn = READOUT_EVERY;
        tuneUi.setCast(
          `${fishing.stage} · 线 ${fishing.lineOut.toFixed(1)} 米 · 甩 ${Math.round(fishing.swing)}°/秒 · 上次松手 ${Math.round(fishing.lastRelease)}°/秒`,
        );
      }
    } else {
      fishing.begin();
      fishingBegun = true;
    }
    shoreSchool.update(dt, tune.swimRate, world.rocks, {
      x: tune.x,
      z: tune.z,
      yaw: (tune.yaw * Math.PI) / 180,
      fov: camera.fov,
      aspect: camera.aspect,
    });

    let enc = device.createCommandEncoder({ label: 'ocean' });
    ocean.update(dt, enc, camera.position, sun.dir);
    post.updateDown(camera);
    const n = drops.update(dt, () => false, post.down, cssW / cssH, params);
    post.setDrops(drops.buf, n);
    post.prepare(enc, camera, params, sunState, O.U, dt, time);
    device.queue.submit([enc.finish()]);
    ocean.afterSubmit();
    O.U.causticOrigin.value.set(...ocean.caustics.origin);

    renderer.setRenderTarget(rt);
    renderer.render(scene, camera);
    if (rt._needsPostBind) {
      const colorGPU = renderer.backend.get(rt.texture).texture;
      const depthGPU = renderer.backend.get(rt.depthTexture).texture;
      post.bindScene(colorGPU, depthGPU);
      rt._needsPostBind = false;
    }
    renderer.autoClear = false;
    for (const ws of waterScenes) {
      enc = device.createCommandEncoder({ label: 'backdrop' });
      post.copyBackdrop(enc, camera);
      device.queue.submit([enc.finish()]);
      renderer.render(ws, camera);
    }
    renderer.autoClear = true;

    enc = device.createCommandEncoder({ label: 'post' });
    const view = ctx.getCurrentTexture().createView();
    post.render(enc, view);
    device.queue.submit([enc.finish()]);
  }

  let last = performance.now();
  function loop(now) {
    if (!running) return;
    const dt = Math.min((now - last) / 1000, 1 / 20);
    last = now;
    frame(dt);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  const tuneUi = mountTunePanel(container, tune, {
    onWave() { waveDirty = true; },
    onCamera() { applyCamera(); },
    onRod() { applyRod(); },
    onRecenter() { applyCamera(); },
    yawInput,
    pitchInput,
  });

  return {
    resize,
    camera,
    // The cast in progress: its stage and how much line is out. Read only.
    fishing,
    dispose() {
      running = false;
      tuneUi.remove();
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
      lure.dispose();
      line.dispose();
      rod.dispose();
      phone.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}

function mountTunePanel(container, tune, hooks) {
  const root = container.querySelector('#ui-root') || container;
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'tune-toggle';
  toggle.textContent = '设置';
  const panel = document.createElement('section');
  panel.className = 'tune-panel';
  panel.hidden = true;
  const fields = [
    ['雾', [
      ['起始', 'fogNear', 0, 80, 1],
      ['结束', 'fogFar', 10, 200, 1],
    ]],
    ['水', [
      ['风速', 'windSpeed', 0.4, 8, 0.1, true],
      ['涌浪', 'swellHeight', 0, 0.4, 0.01, true],
      ['翻卷', 'choppiness', 0, 1.2, 0.01, true],
      ['白沫', 'foamStrength', 0, 1.5, 0.01],
      ['粗糙', 'roughness', 0.02, 0.4, 0.01],
      ['透光', 'sss', 0, 1, 0.01],
      ['折射', 'refract', 0, 1.5, 0.01],
      ['曝光', 'exposure', 0.2, 1.6, 0.01],
      ['太阳', 'sunScale', 0.2, 1.6, 0.01],
    ]],
    ['鱼', [
      ['游速', 'swimRate', 0.2, 2.5, 0.05],
    ]],
    ['鱼竿', [
      ['位置 X', 'rodX', -1, 1, 0.01],
      ['位置 Y', 'rodY', -2, 0.5, 0.01],
      ['位置 Z', 'rodZ', -5, -0.15, 0.01],
      ['抬起', 'rodAimUp', -30, 70, 0.5],
      ['侧偏', 'rodAimSide', -45, 45, 0.5],
      ['滚转', 'rodRoll', -180, 180, 1],
      ['竿尖负重 g', 'rodLoad', 0, 30, 1],
    ]],
    ['摄像机', [
      ['位置 X', 'x', -30, 30, 0.1],
      ['位置 Y', 'y', 0.3, 8, 0.1],
      ['位置 Z', 'z', -20, 40, 0.1],
      ['朝向', 'yaw', -180, 180, 1],
      ['俯仰', 'pitch', -70, 70, 1],
    ]],
  ];
  panel.innerHTML = `<div class="tune-head"><span>场景参数</span><button type="button" class="tune-close tune-recenter">镜头回正</button><button type="button" class="tune-close tune-shut">关闭</button></div>`;
  const colorRow = document.createElement('label');
  colorRow.className = 'tune-row';
  colorRow.innerHTML = `<span>雾色</span><input type="color" value="${tune.fogColor}">`;
  for (const [title, rows] of fields) {
    const block = document.createElement('div');
    block.className = 'tune-block';
    block.innerHTML = `<p class="tune-title">${title}</p>`;
    if (title === '雾') block.appendChild(colorRow);
    for (const [label, key, min, max, step, wave] of rows) {
      const row = document.createElement('label');
      row.className = 'tune-row';
      const value = document.createElement('b');
      value.textContent = formatTune(tune[key]);
      const input = document.createElement('input');
      input.type = 'range';
      input.min = String(min);
      input.max = String(max);
      input.step = String(step);
      input.value = String(tune[key]);
      if (key === 'yaw') hooks.yawInput.el = input;
      if (key === 'pitch') hooks.pitchInput.el = input;
      input.addEventListener('input', () => {
        tune[key] = Number(input.value);
        value.textContent = formatTune(tune[key]);
        if (wave) hooks.onWave();
        if (title === '摄像机') hooks.onCamera();
        if (title === '鱼竿') hooks.onRod();
      });
      row.append(Object.assign(document.createElement('span'), { textContent: label }), input, value);
      block.appendChild(row);
    }
    panel.appendChild(block);
  }
  colorRow.querySelector('input').addEventListener('input', (e) => {
    tune.fogColor = e.target.value;
  });
  // What the cast is reading, for tuning it against a real hand. Not a player hint.
  const cast = document.createElement('div');
  cast.className = 'tune-block';
  cast.innerHTML = '<p class="tune-title">这一竿</p><p class="tune-cast"></p>';
  panel.appendChild(cast);
  const castText = cast.querySelector('.tune-cast');
  const haptic = root.querySelector('.panel');
  if (haptic) panel.appendChild(haptic);
  toggle.addEventListener('click', () => { panel.hidden = !panel.hidden; });
  panel.querySelector('.tune-shut').addEventListener('click', () => { panel.hidden = true; });
  // Takes the phone as it is held now for the default view. Without a sensor it only
  // re-applies the panel's camera.
  panel.querySelector('.tune-recenter').addEventListener('click', () => { hooks.onRecenter(); });
  root.append(toggle, panel);
  return {
    get open() { return !panel.hidden; },
    setCast(text) { castText.textContent = text; },
    remove() { toggle.remove(); panel.remove(); },
  };
}

function formatTune(n) {
  return Math.abs(n) >= 10 ? String(Math.round(n)) : String(Math.round(n * 100) / 100);
}
