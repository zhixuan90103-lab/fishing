import * as THREE from 'three/webgpu';
import { loadDorade, poseSpine } from './dorade.js';

const canvas = document.querySelector('#view');
const status = document.querySelector('#status');
const rateInput = document.querySelector('#rate');
const rateLabel = document.querySelector('#rate-label');
const driveInput = document.querySelector('#drive');
const bendInput = document.querySelector('#bend');

if (!navigator.gpu) {
  status.textContent = '这个浏览器没有 WebGPU';
  throw new Error('WebGPU unavailable');
}

const renderer = new THREE.WebGPURenderer({ canvas, antialias: true });
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;
await renderer.init();
if (!renderer.backend.isWebGPUBackend) throw new Error('WebGPU backend required');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1c1f);
scene.add(new THREE.AmbientLight(0xffffff, 0.55));
const sun = new THREE.DirectionalLight(0xfff2e0, 2.2);
sun.position.set(2.5, 4, 3);
scene.add(sun);
const fill = new THREE.DirectionalLight(0xc5d4e8, 0.7);
fill.position.set(-3, 1.5, -2);
scene.add(fill);

const ground = new THREE.Mesh(
  new THREE.CircleGeometry(1.6, 48),
  new THREE.MeshBasicNodeMaterial({ color: 0x24282e }),
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.55;
scene.add(ground);

const fish = await loadDorade(1.2);
scene.add(fish.holder);
status.textContent = 'ArmatureAction，原地循环。拖动画布转一圈。';

const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 50);
const view = { yaw: 0.6, pitch: 0.25, dist: 2.4 };
function placeCamera() {
  const cp = Math.cos(view.pitch);
  camera.position.set(
    Math.sin(view.yaw) * cp * view.dist,
    Math.sin(view.pitch) * view.dist,
    Math.cos(view.yaw) * cp * view.dist,
  );
  camera.lookAt(0, 0, 0);
}
placeCamera();

let dragging = false;
canvas.addEventListener('pointerdown', (e) => {
  dragging = true;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointerup', () => { dragging = false; });
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  view.yaw -= e.movementX * 0.008;
  view.pitch = Math.max(-1.2, Math.min(1.2, view.pitch + e.movementY * 0.008));
  placeCamera();
});
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  view.dist = Math.max(0.8, Math.min(8, view.dist * (e.deltaY > 0 ? 1.08 : 0.92)));
  placeCamera();
}, { passive: false });

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / Math.max(h, 1);
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}
resize();
window.addEventListener('resize', resize);

let swimRate = 1;
rateInput.addEventListener('input', () => {
  swimRate = Number(rateInput.value);
  rateLabel.textContent = swimRate.toFixed(2);
});

let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  fish.action.setEffectiveTimeScale(swimRate);
  fish.mixer.update(dt);
  poseSpine(fish, Number(driveInput.value), Number(bendInput.value));
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
