/**
 * Everything a set of casts does, frame by frame, folded into one hash per run, and the
 * same for the rod's grip under a scripted view.
 *
 * For tidying that must not change behaviour: run it before and after and compare.
 *   node checks/record.mjs > /tmp/before.txt      (or SRC=/path/to/old/src node ...)
 *   node checks/record.mjs > /tmp/after.txt && cmp /tmp/before.txt /tmp/after.txt
 * The same lines mean every fish's pose, the lure, the line, the rod's load and every
 * haptic came out the same on every frame. docs/CONVENTIONS.md section 7.
 */
import { createHash } from 'node:crypto';
import * as THREE from 'three/webgpu';
const { createRig } = await import('./rig.mjs');
const SRC = process.env.SRC || new URL('../src', import.meta.url).pathname;
const { createRodHold } = await import(`${SRC}/shore/rodHold.js`);
const STAGE = { ready: 0, flight: 1, water: 2, fight: 3, landed: 4 };
const FISH = { none: 0, coming: 1, on: 2, landed: 3, near: 4, biting: 5, fleeing: 6 };
const BITE = { '': 0, light: 1, medium: 2, heavy: 3, dead: 4 };
const STATE = { free: 0, held: 1, hung: 2, away: 3 };
const MIND = { watching: 0, near: 1, coming: 2, biting: 3, fleeing: 4, leaving: 5 };
function one({ seed, fps, press, hold, size, noSchool, rodStays, sway, seconds, strikes = true, lowers = false }) {
  const rig = createRig({ seed, fps, press, hold, noSchool, sizes: size ? () => size : null, strikes });
  rig.rodStays = !!rodStays;
  // In the water the lure is left for the fish. It is wound in when the line is bare, or when nothing has taken it in a good while.
  let waterAt = -1;
  const f = rig.fishing; const h = createHash('sha1');
  // Every fish, the spares too: its pose and its state. Then the cast, and every fish with a mind about the lure.
  const row = new Float64Array(rig.fishes.length * 7 + 60 + 10 * 5);
  let frames = 0, count = 0;
  while (rig.time < seconds) {
    if (sway) rig.rodTurn = sway * Math.sin(rig.time * 0.8);
    // The rod lowered while a fish runs and raised again as it rests.
    if (lowers) rig.setLift(rig.fishing.stage === 'fight' && rig.fishing.mood === 'run' ? -10 : 20);
    if (rig.fishing.stage === 'water') { if (waterAt < 0) waterAt = rig.time; rig.windWater = noSchool || rig.fishing.lost === 'spooled' || rig.time - waterAt > 40; } else { waterAt = -1; rig.windWater = false; }
    rig.step(); frames += 1;
    let k = 0;
    for (const x of rig.fishes) { row[k++] = x.x; row[k++] = x.y; row[k++] = x.z; row[k++] = x.yaw; row[k++] = x.pitch || 0; row[k++] = x.roll || 0; row[k++] = STATE[x.state]; }
    const m = f.lure, l = rig.line;
    for (const v of [m.x, m.y, m.z, m.nose.x, m.nose.y, m.nose.z, m.back.x, m.back.y, m.back.z, m.swum, l.end.x, l.end.y, l.end.z, l.length, l.tied ? 1 : 0, l.tip.x, l.tip.y, l.tip.z,
      rig.rodState.wound, rig.rodState.load, rig.strain, rig.rod.tipTension, STAGE[f.stage], FISH[f.fish], f.lineOut, f.tension, f.pull, f.press, f.effort, f.running, f.stamina, f.landed, f.size,
      f.watch ? f.watch.x : -999, f.watch ? f.watch.z : -999, f.watchRod ? 1 : 0, rig.lureSeen.visible ? 1 : 0, rig.events.length, f.lost ? f.lost.length : 0,
      BITE[f.bite], f.hookIn ? 1 : 0, f.around, f.hunger, f.interest, f.fright, f.hookLoose, f.braked ?? f.held, f.lowered]) row[k++] = v;
    let n = 0; for (const mind of f.minds) { if (n++ >= 10) break; row[k++] = MIND[mind.state]; row[k++] = mind.hunger; row[k++] = mind.interest; row[k++] = mind.fright; row[k++] = mind.spare ? 1 : 0; }
    h.update(Buffer.from(row.buffer, 0, k * 8)); count += k;
    if (rig.time > 30 && f.stage === 'ready' && frames > 600 && rig.events.length > 3 && rig.time > seconds * 0.6) break;
  }
  let ev = 0; for (const e of rig.events) ev += (e.intensity || 0) + (e.s || 0) + e.t;
  return `${h.digest('hex').slice(0, 16)} frames ${frames} landed ${f.landed} events ${rig.events.length} ${ev.toFixed(6)}`;
}
const runs = [];
for (const fps of [60, 20]) {
  for (const [press, size] of [['always', 1.4], ['rests', 1.3], ['never', 1.2], ['runs', 0.85], ['rests', 0]]) for (const seed of [1, 2]) runs.push({ seed, fps, press, hold: 0.3 + 0.2 * seed, size, rodStays: seed === 2, sway: seed === 2 ? 0.5 : 0, seconds: press === 'never' ? 60 : 150 });
  // The biggest fish with the rod lowered in its runs, the finger down throughout and only while it rests.
  runs.push({ seed: 7, fps, press: 'always', hold: 0.7, size: 1.4, lowers: true, seconds: 150 });
  runs.push({ seed: 8, fps, press: 'rests', hold: 0.6, size: 1.3, lowers: true, rodStays: true, sway: 0.5, seconds: 150 });
  // Short casts, far from the school: spares are brought. One with nobody striking, so bites pass and fish bolt.
  runs.push({ seed: 5, fps, press: 'rests', hold: 0.2, size: 0, seconds: 120 });
  runs.push({ seed: 6, fps, press: 'never', hold: 0.2, size: 0, seconds: 60, strikes: false });
  runs.push({ seed: 3, fps, press: 'always', hold: 0.6, noSchool: true, seconds: 40 });
  runs.push({ seed: 4, fps, press: 'always', hold: 0.05, noSchool: true, seconds: 40 });
}
for (const r of runs) console.log(`${String(r.fps).padStart(3)} ${r.press.padEnd(6)} ${String(r.size || (r.noSchool ? 'none' : 'mix')).padEnd(5)} seed ${r.seed}: ${one(r)}`);

// The grip, under a view that turns in uneven steps, a changing aim, strain and pull.
for (const fps of [20, 60, 120]) {
  const view = new THREE.PerspectiveCamera(); const root = new THREE.Object3D(); view.add(root);
  const hold = createRodHold(root, 0.1); const h = createHash('sha1'); const dt = 1 / fps;
  const pull = new THREE.Vector3(); const row = new Float64Array(16 + 3 + 3 + 4 + 3);
  let s = 12345; const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  for (let i = 0; i < fps * 40; i += 1) {
    const t = i * dt;
    // The view turns in uneven steps, with one jump.
    const yaw = 1.7 + 0.6 * Math.sin(t * 0.7) + (rnd() - 0.5) * 0.01 + (t > 20 ? 0.4 : 0);
    const pitch = -0.17 + 0.2 * Math.sin(t * 0.43);
    view.position.set(0, 1.7, 2); view.up.set(0, 1, 0);
    view.lookAt(Math.sin(yaw) * Math.cos(pitch), 1.7 + Math.sin(pitch), 2 + Math.cos(yaw) * Math.cos(pitch)); view.updateMatrixWorld(true);
    hold.setAim(15 * Math.sin(t * 1.3), 25 * Math.sin(t * 0.9 + 1), 10 * Math.sin(t * 2.1));
    if (i === fps * 12) hold.setPose({ aimUp: 40, x: 0.12 });
    const fighting = (t > 4 && t < 18) || (t > 24 && t < 36);
    hold.setStrain(fighting ? 0.5 + 0.5 * Math.sin(t * 1.9) : (t > 36 ? Math.max(0, 1 - (t - 36)) : 0));
    hold.setPull(fighting ? pull.set(Math.sin(yaw + 0.8 * Math.sin(t * 0.5)) * 14, -0.5, 2 + Math.cos(yaw + 0.8 * Math.sin(t * 0.5)) * 14) : null);
    hold.carry(dt);
    row.set(root.matrixWorld.elements, 0);
    row.set([hold.grip.butt.x, hold.grip.butt.y, hold.grip.butt.z, hold.grip.axis.x, hold.grip.axis.y, hold.grip.axis.z, hold.grip.quaternion.x, hold.grip.quaternion.y, hold.grip.quaternion.z, hold.grip.quaternion.w], 16);
    const out = hold.intoBend(pull, new THREE.Vector3()); row.set([out.x, out.y, out.z], 26);
    h.update(Buffer.from(row.buffer));
  }
  console.log(`grip ${String(fps).padStart(3)} fps: ${h.digest('hex').slice(0, 20)}`);
}
