/**
 * The checks that can be run without a phone: `npm run check`.
 *
 * Each one is a thing that has gone wrong before, or a promise a design document makes,
 * written so that it fails loudly if it goes wrong again. They do not judge how anything
 * feels or looks: that still takes a hand and an eye. docs/CONVENTIONS.md section 7.
 *
 * Pass a word to run only the checks whose name holds it: `npm run check camera`.
 */
import * as THREE from 'three/webgpu';
import { createRig, seeded } from './rig.mjs';
import { createAim } from '../src/shore/aim.js';
import { createRodHold } from '../src/shore/rodHold.js';
import { createLure } from '../src/shore/lure.js';
import { createFight } from '../src/play/fight.js';
import { createCourse } from '../src/play/course.js';
import { leadFish } from '../src/play/lead.js';
import { createThump } from '../src/play/thump.js';
import { createStrain } from '../src/play/strain.js';
import { castReach, createSwing } from '../src/play/swing.js';
import { createLureMove } from '../src/shore/lureMove.js';
import { createLineCurve } from '../src/shore/lineCurve.js';
import { createSnap } from '../src/play/snap.js';
import { fishOf, HARDEST_RUN } from '../src/play/fishKind.js';
import { RUN_OUT_AT } from '../src/play/haul.js';
import { BREAK_AT } from '../src/play/snap.js';
import { TIP_LEFT, TIP_RIGHT, TIP_UP } from '../src/shore/aim.js';

const deg = Math.PI / 180;
const only = process.argv[2];
const checks = [];
const check = (name, fn) => { if (!only || name.includes(only)) checks.push([name, fn]); };
// A failed expectation. `what` says what was promised, `got` what happened.
function expect(ok, what, got) { if (!ok) throw new Error(`${what}${got === undefined ? '' : ` — got ${got}`}`); }
const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

// ---------------------------------------------------------------- the fish's table

check('fish table: small fish never out-pull the reel, no fish out-pulls the line', () => {
  for (const size of [0.78, 0.85, 0.95]) expect(fishOf('dorade', size).runFresh < RUN_OUT_AT, `a fish of size ${size} pulls less than the reel holds`, fishOf('dorade', size).runFresh);
  for (const size of [1.2, 1.3, 1.4]) expect(fishOf('dorade', size).runFresh > RUN_OUT_AT, `a fish of size ${size} can take line`, fishOf('dorade', size).runFresh);
  expect(HARDEST_RUN < BREAK_AT, 'the hardest run is below the breaking point', HARDEST_RUN);
});

// ---------------------------------------------------------------- the sums, alone

check('rules alone: the same at 20, 60 and 120 frames a second', () => {
  const big = fishOf('dorade', 1.3);
  const seen = [];
  for (const fps of [20, 60, 120]) {
    const dt = 1 / fps;
    const strain = createStrain(); for (let i = 0; i < fps; i += 1) strain.step(dt, 6);
    const snap = createSnap(seeded(9)); snap.begin(); for (let i = 0; i < fps; i += 1) snap.step(dt, true, true, 6);
    const thump = createThump(seeded(5)); thump.begin(big); let jolt = 0, beats = 0;
    for (let i = 0; i < 30 * fps; i += 1) { if (thump.step(dt, true, 1)) beats += 1; jolt += thump.pull * dt; }
    let atRest = 0; for (let i = 0; i < 3 * fps; i += 1) { if (thump.step(dt, false, 1)) atRest += 1; if (i > fps * 0.2) atRest += Math.abs(thump.pull); }
    expect(atRest === 0, `a resting fish does not shake its head once (${fps} fps)`, atRest);
    seen.push([strain.effort, snap.press, jolt / beats]);
  }
  for (let k = 0; k < 3; k += 1) for (const row of seen) expect(Math.abs(row[k] - seen[0][k]) < 1e-3 * Math.max(1, Math.abs(seen[0][k])), `value ${k} does not depend on the frame rate`, seen.map((r) => r[k].toFixed(5)).join(' / '));
});

check('lead: a resting fish comes to the rod, a fresh running one does not', () => {
  const out = { across: 0, against: 0 };
  const rod = [Math.sin(45 * deg), Math.cos(45 * deg)];
  leadFish(0, 1, rod[0], rod[1], false, 0.6, out);
  expect(Math.abs(out.across) > 1 && out.against === 0, 'resting, it is led and nothing is hauled against', `${out.across.toFixed(2)} m/s, against ${out.against}`);
  const resting = out.across;
  leadFish(0, 1, rod[0], rod[1], true, 1, out);
  expect(out.across === 0 && out.against > 0.4, 'running and fresh, it is not led at all and the hand hauls against it', `${out.across} m/s, against ${out.against.toFixed(2)}`);
  leadFish(0, 1, rod[0], rod[1], true, 0, out);
  expect(Math.abs(out.across) > 0 && Math.abs(out.across) < Math.abs(resting) * 0.5, 'running and spent, it gives a little', out.across.toFixed(2));
  leadFish(0, 1, Math.sin(5 * deg), Math.cos(5 * deg), false, 0.6, out);
  expect(out.across === 0, 'a rod pointing nearly at it leads it nowhere', out.across);
  leadFish(0, 1, -rod[0], rod[1], false, 0.6, out);
  expect(Math.sign(out.across) === -Math.sign(resting), 'the other side leads it the other way', out.across);
});

check('course: runs head out and to a side, not flat across', () => {
  const course = createCourse(seeded(3)); const lean = [];
  for (let i = 0; i < 400; i += 1) { course.begin(); lean.push(course.across(true, 1, 3, 5, 20) / 3); }
  const sides = lean.filter((x) => x > 0).length / lean.length;
  expect(sides > 0.4 && sides < 0.6, 'left and right about as often', sides.toFixed(2));
  expect(Math.min(...lean.map(Math.abs)) > 0.1 && Math.max(...lean.map(Math.abs)) <= 1, 'every run leans a little, none more than its dash', `${Math.min(...lean.map(Math.abs)).toFixed(2)}..${Math.max(...lean.map(Math.abs)).toFixed(2)}`);
  course.begin();
  expect(Math.abs(course.across(true, 1, 3, 0, 20)) < Math.abs(course.across(true, 1, 3, 5, 20)) * 0.5, 'held by the line it does not slide off sideways at speed');
  expect(Math.abs(course.across(false, 1, 3, 0, 20)) < 0.1, 'resting it barely moves across');
});

check('cast: an ordinary swing goes far, a harder one further, a late release still counts', () => {
  const reach = [150, 200, 300, 400, 500, 550].map(castReach);
  for (let i = 1; i < reach.length; i += 1) expect(reach[i] > reach[i - 1] + 1, 'a harder swing lands further', reach.map((r) => r.toFixed(1)).join(' '));
  expect(castReach(100) === 0, 'a nudge is not a cast');
  expect(castReach(400) > 15 && castReach(550) === castReach(900), 'an ordinary swing reaches well out, and the hardest counted is 550°/s', `${castReach(400).toFixed(1)} m`);
  // A swing of 400°/s, let go a tenth of a second after it stopped.
  for (const fps of [30, 60, 120]) {
    const swing = createSwing(); let pitch = 40, read = 0;
    for (let i = 0; i < fps * 0.35; i += 1) { if (i < fps * 0.25) pitch -= 400 / fps; read = swing.step(1 / fps, pitch); }
    expect(castReach(read) > 9, `${fps} fps: let go a tenth of a second late, it is still a fair cast`, `${read.toFixed(0)}°/s, ${castReach(read).toFixed(1)} m`);
  }
});

check('lure at the tip: it sways with the rod, hangs true when the rod is still, and never flips', () => {
  for (const fps of [20, 60, 120]) {
    const m = createLureMove(); const dt = 1 / fps; m.hold(0, 2, 0); m.upright(0);
    let most = 0, fastest = 0, last = [0, 1, 0];
    for (let i = 0; i < fps * 6; i += 1) {
      const t = i * dt;
      // The tip waved half a metre each way for three seconds, then still.
      m.hold(t < 3 ? 0.5 * Math.sin(t * 6) : 0.5 * Math.sin(18), 2, 0); m.upright(dt);
      const n = Math.hypot(m.nose.x, m.nose.y, m.nose.z); const nose = [m.nose.x / n, m.nose.y / n, m.nose.z / n];
      const tilt = Math.acos(Math.min(1, nose[1])) / deg;
      if (t < 3) most = Math.max(most, tilt);
      fastest = Math.max(fastest, Math.acos(Math.min(1, nose[0] * last[0] + nose[1] * last[1] + nose[2] * last[2])) / deg * fps);
      last = nose;
      expect(Math.abs(m.back.x * nose[0] + m.back.y * nose[1] + m.back.z * nose[2]) < 1e-6, 'its back stays square to its nose');
    }
    const end = Math.acos(Math.min(1, last[1])) / deg;
    expect(most > 8 && most < 30, `${fps} fps: waved, it tilts, and no further than its most`, `${most.toFixed(1)}°`);
    expect(end < 1, `${fps} fps: the rod still, it hangs true again`, `${end.toFixed(2)}°`);
    expect(fastest < 400, `${fps} fps: it sways, it does not snap`, `${fastest.toFixed(0)}°/s`);
  }
});

check('line: it is as slack as what happened to it left it, and a pull draws it straight by degrees, harder the faster', () => {
  const n = 49; const out = new Float64Array(n * 3);
  const y = (i) => out[i * 3 + 1], z = (i) => out[i * 3 + 2];
  const tip = [0, 2.7, 0];
  const drawn = () => { let len = 0; for (let i = 1; i < n; i += 1) len += Math.hypot(out[i * 3] - out[i * 3 - 3], y(i) - y(i - 1), z(i) - z(i - 1)); return len; };
  // How far the line is from the straight way to (0, by, bz), at its furthest, and whether that point is in the water.
  const off = (by, bz) => { let far = 0, wet = false; const g = Math.hypot(by - 2.7, bz); for (let i = 1; i < n - 1; i += 1) { const d = Math.abs((y(i) - 2.7) * bz - z(i) * (by - 2.7)) / g; if (d > far) { far = d; wet = y(i) < 0; } } return { far, wet }; };
  // Nothing has happened to it: it is a straight line, whatever its ends do.
  const taut = createLineCurve(n);
  for (let i = 0; i < 120; i += 1) {
    const end = [Math.sin(i / 20) * 3, -1, -12 - i / 30]; const top = [0, 2.7 + Math.sin(i / 7) * 0.3, 0];
    taut.step(1 / 60, ...top, ...end, Math.hypot(end[0] - top[0], end[1] - top[1], end[2] - top[2]), 0, out, 0);
    for (let k = 0; k < n; k += 1) expect(Math.abs(y(k) - (top[1] + (end[1] - top[1]) * k / (n - 1))) < 1e-3, 'a line nothing has slackened stays straight', (y(k) - (top[1] + (end[1] - top[1]) * k / (n - 1))).toExponential(1));
  }
  // A cast: out to `reach` on an arc in `flight` seconds, into the water, then sinking for `sink` seconds.
  const cast = (fps, reach, flight, sink) => {
    const c = createLineCurve(n); const dt = 1 / fps; let end = [0, 2.6, -0.3], belly = 0;
    c.step(dt, ...tip, ...end, 0.32, 0, out, 0);
    for (let i = 1; i <= Math.round(flight * fps); i += 1) { const u = i / Math.round(flight * fps); end = [0, 2.6 * (1 - u) + 5 * u * (1 - u) - 0.05 * u, -0.3 - (reach - 0.3) * u]; c.step(dt, ...tip, ...end, Math.hypot(end[1] - 2.7, end[2]) * 1.001, 0, out, 0); if (u > 0.3 && u < 0.95) belly = Math.max(belly, off(end[1], end[2]).far); }
    for (let i = 0; i < Math.round(sink * fps); i += 1) { end = [0, Math.max(-2, end[1] - 0.4 * dt), -reach]; c.step(dt, ...tip, ...end, Math.hypot(end[1] - 2.7, end[2]), 0, out, 0); }
    return { c, end, belly, slack: drawn() - Math.hypot(end[1] - 2.7, end[2]) };
  };
  const hard = cast(60, 24, 1.7, 1), soft = cast(60, 24, 3.4, 1);
  expect(hard.belly < 0.6, 'flying, the lure carries it all but straight', `${hard.belly.toFixed(2)} m of belly`);
  expect(hard.slack > 0.01 && hard.slack < 0.05, 'the lure stopping on the water leaves a little slack', `${(hard.slack * 100).toFixed(1)} cm`);
  expect(soft.slack < hard.slack * 0.85, 'less of it from a gentler landing', `${(soft.slack * 100).toFixed(1)} cm against ${(hard.slack * 100).toFixed(1)}`);
  const sunk = cast(60, 24, 1.7, 8);
  expect(Math.abs(sunk.slack - hard.slack) < 0.01, 'with nothing pulling, the slack stays as it is: no clock takes it up', `${(sunk.slack * 100).toFixed(1)} cm after 8 s, ${(hard.slack * 100).toFixed(1)} after 1`);
  const mid = off(-2, -24);
  expect(mid.far > 0.15 && mid.far < 0.8, 'loose, not heaped: a hand or two off the straight way', mid.far.toFixed(2));
  expect(y(n - 3) < -1 && y(Math.round(n / 2)) > y(n - 3) + 0.5, 'the sinking lure has drawn the line by it down, the rest lies higher', `${y(Math.round(n / 2)).toFixed(2)} m half way, ${y(n - 3).toFixed(2)} by the lure`);
  // A pull on it. How long until it is within 2 cm of straight, how much of the way any one frame took, and where the last of the belly was.
  const pulled = (pull, fps = 60) => {
    const { c, end } = cast(fps, 24, 1.7, 8); const from = off(end[1], end[2]).far; let was = from, most = 0, took = -1, lastWet = false;
    for (let i = 1; i <= 8 * fps && took < 0; i += 1) {
      c.step(1 / fps, ...tip, ...end, Math.hypot(end[1] - 2.7, end[2]), pull, out, 0);
      const now = off(end[1], end[2]); most = Math.max(most, (was - now.far) / from); was = now.far;
      if (now.far < from * 0.3 && now.far > 0.03) lastWet = now.wet;
      if (now.far < 0.02) took = i / fps;
    }
    return { took, most, lastWet, from };
  };
  const run = pulled(4.5), rest = pulled(0.5);
  expect(run.took > 0.05 && run.took < 0.8, 'a fish running draws it straight in a few tenths of a second', `${run.took.toFixed(2)} s`);
  // It used to be squeezed onto the straight line all at once, every point together.
  expect(run.most < 0.5, 'by degrees: no one frame takes half the way', `${(run.most * 100).toFixed(0)}% of it in a frame`);
  expect(rest.took > run.took * 2, 'a light pull takes more than twice as long: it goes by the pull, not by a clock', `${rest.took.toFixed(2)} s at 0.5 N, ${run.took.toFixed(2)} s at 4.5 N`);
  const slow = pulled(4.5, 20);
  expect(Math.abs(slow.took - run.took) < 0.12, 'the same at 20 frames a second as at 60', `${slow.took.toFixed(2)} s and ${run.took.toFixed(2)} s`);
  // And once straight under a pull it stays so, the far end running off sideways or not.
  const held = cast(60, 24, 1.7, 4); let bent = 0;
  for (let i = 0; i < 240; i += 1) { held.end[2] -= 0.01; held.c.step(1 / 60, ...tip, ...held.end, Math.hypot(held.end[1] - 2.7, held.end[2]), 2, out, 0); if (i > 90) bent = Math.max(bent, off(held.end[1], held.end[2]).far); }
  expect(bent < 0.02, 'held by a pull it stays straight', `${(bent * 100).toFixed(1)} cm`);
  // The same line at any frame rate.
  const deep = [20, 60, 120].map((fps) => { cast(fps, 24, 1.7, 6); return y(Math.round(n * 0.75)); });
  expect(Math.max(...deep) - Math.min(...deep) < 0.08, 'it lies the same at 20, 60 and 120 frames a second', deep.map((d) => d.toFixed(3)).join(' / '));
  // And a sinking lure rocks about its length, keeps its back square, and beats no tail.
  const m = createLureMove(); m.place(0, 0, -8); const tipP = { x: 0, y: 2, z: 0 }; let rocked = 0, swum0 = m.swum, down = 0;
  for (let i = 0; i < 60 * 5; i += 1) {
    m.tow(1 / 60, tipP, 30, 0, 10); m.point(1 / 60, tipP, true);
    const len = Math.hypot(m.nose.x, m.nose.y, m.nose.z);
    expect(Math.abs((m.back.x * m.nose.x + m.back.y * m.nose.y + m.back.z * m.nose.z) / len) < 1e-6, 'its back stays square to its nose as it rocks');
    rocked = Math.max(rocked, Math.abs(m.back.x)); down = Math.min(down, m.nose.y / len);
  }
  expect(rocked > 0.2, 'sinking, it rocks from side to side', rocked.toFixed(2));
  expect(down < -0.4, 'and goes nose down', down.toFixed(2));
  expect(m.swum === swum0, 'and does not beat its tail as if swimming', m.swum - swum0);
});

check('line: its drawn shape never jumps, landing, sinking, wound a moment, or taken by a fish', () => {
  const N = 49;
  // How far a point is from a drawn line: the nearest of its segments.
  const toLine = (px, py, pz, line) => {
    let best = Infinity;
    for (let i = 0; i < N - 1; i += 1) {
      const ax = line[i * 3], ay = line[i * 3 + 1], az = line[i * 3 + 2], bx = line[i * 3 + 3] - ax, by = line[i * 3 + 4] - ay, bz = line[i * 3 + 5] - az;
      const len = bx * bx + by * by + bz * bz; const t = len > 0 ? Math.max(0, Math.min(1, ((px - ax) * bx + (py - ay) * by + (pz - az) * bz) / len)) : 0;
      best = Math.min(best, Math.hypot(px - ax - bx * t, py - ay - by * t, pz - az - bz * t));
    }
    return best;
  };
  for (const [name, opts, taps] of [['no fish, wound for a moment twice', { noSchool: true }, true], ['a fish takes it as it sinks', { press: 'rests', sizes: () => 1.3 }, false]]) {
    const rig = createRig({ seed: 2, fps: 60, hold: 0.25, ...opts }); const f = rig.fishing; let t0 = -1;
    if (taps) { rig.finger0 = rig.finger; rig.finger = () => { if (f.stage !== 'water') { t0 = -1; return rig.finger0(); } if (t0 < 0) t0 = rig.time; const t = rig.time - t0; return (t > 4 && t < 4.6) || (t > 8 && t < 8.3) || t > 12; }; }
    const curve = createLineCurve(N); const now = new Float64Array(N * 3), last = new Float64Array(N * 3); let have = false, worst = 0, at = '';
    while (rig.time < 40) {
      rig.step();
      const l = rig.line; if (l.stowed !== null) { have = false; curve.reset(); continue; }
      curve.step(rig.dt, l.tip.x, l.tip.y, l.tip.z, l.end.x, l.end.y, l.end.z, l.length, l.tied ? l.tension : 0, now, 0);
      if (have) {
        const ends = Math.max(Math.hypot(now[0] - last[0], now[1] - last[1], now[2] - last[2]), Math.hypot(now[144] - last[144], now[145] - last[145], now[146] - last[146]));
        for (let i = 1; i < N - 1; i += 1) { const d = toLine(now[i * 3], now[i * 3 + 1], now[i * 3 + 2], last) - ends; if (d > worst) { worst = d; at = `${rig.time.toFixed(1)} s, ${f.stage}`; } }
      }
      last.set(now); have = true;
      if (rig.time > 20 && f.stage === 'ready') break;
    }
    // It was 94 cm in the frame after landing, when the slack line was drawn two ways.
    expect(worst < 0.2, `${name}: no point of the line moves much more in a frame than its ends do`, `${(worst * 100).toFixed(0)} cm at ${at}`);
  }
});

check('line: a fish draws it straight in a moment, and with a fish on it stays straight, wound or not', () => {
  // It used to take over two seconds to draw straight, with the rod already bent by the fish.
  const N = 49;
  for (const [size, press, fps] of [[0.85, 'always', 60], [1.3, 'rests', 60], [1.3, 'never', 60], [1.3, 'rests', 20]]) {
    const rig = createRig({ seed: 5, fps, press, hold: 0.6, sizes: () => size }); const f = rig.fishing;
    const curve = createLineCurve(N), out = new Float64Array(N * 3); let hooked = -1, loose = 0, soon = 9, worst = 0;
    while (rig.time < 45) {
      rig.step(); const l = rig.line; if (l.stowed !== null) { curve.reset(); continue; }
      curve.step(rig.dt, l.tip.x, l.tip.y, l.tip.z, l.end.x, l.end.y, l.end.z, l.length, l.tied ? l.tension : 0, out, 0);
      let far = 0; const ux = l.end.x - l.tip.x, uy = l.end.y - l.tip.y, uz = l.end.z - l.tip.z, g2 = ux * ux + uy * uy + uz * uz;
      for (let i = 1; i < N - 1; i += 1) { const px = out[i * 3] - l.tip.x, py = out[i * 3 + 1] - l.tip.y, pz = out[i * 3 + 2] - l.tip.z; const t = (px * ux + py * uy + pz * uz) / g2; far = Math.max(far, Math.hypot(px - ux * t, py - uy * t, pz - uz * t)); }
      if (f.stage !== 'fight') { if (hooked >= 0) break; loose = far; continue; }
      if (hooked < 0) hooked = rig.time;
      if (rig.time - hooked > 0.4 && rig.time - hooked < 0.8) soon = Math.min(soon, far);
      if (rig.time - hooked > 2) worst = Math.max(worst, far);
    }
    const who = `size ${size}, finger ${press}, ${fps} fps`;
    expect(hooked >= 0, `${who}: a fish took it`);
    expect(loose > 0.1, `${who}: it lay loose before the bite`, `${loose.toFixed(2)} m off straight`);
    expect(soon < 0.08, `${who}: within half a second or so of the bite it is all but straight`, `${(soon * 100).toFixed(1)} cm`);
    expect(worst < 0.05, `${who}: and stays within a couple of fingers of straight for the rest of the fight`, `${(worst * 100).toFixed(1)} cm`);
  }
});

check('loose line: with the finger up a jerked rod shivers the lure and hardly brings it in', () => {
  const seen = [];
  for (const fps of [20, 60, 120]) {
    const run = (wave) => {
      const rig = createRig({ seed: 3, fps, hold: 0.25, noSchool: true }); const f = rig.fishing;
      let t0 = -1, start = 0, swum0 = 0, line0 = 0;
      while (rig.time < 40) {
        if (t0 >= 0 && wave) rig.setLift(20 + (rig.time - t0 > 3 ? wave * Math.abs(Math.sin((rig.time - t0 - 3) * 6.3)) : 0));
        rig.step();
        if (f.stage === 'water' && t0 < 0) t0 = rig.time;
        if (t0 >= 0 && rig.time - t0 > 2.9 && !start) { start = Math.hypot(f.lure.x, f.lure.z - 2); swum0 = f.lure.swum; line0 = f.lineOut; }
        if (t0 >= 0 && rig.time - t0 > 15) break;
      }
      return { came: start - Math.hypot(f.lure.x, f.lure.z - 2), beat: f.lure.swum - swum0, line: f.lineOut - line0, tension: rig.rod.tipTension };
    };
    const still = run(0), jerked = run(15);
    expect(Math.abs(still.came) < 0.02, `${fps} fps: a still rod brings it in not at all`, `${still.came.toFixed(3)} m`);
    // Twenty-four jerks, each drawing the tip some half a metre.
    expect(jerked.came > 0.1 && jerked.came < 1.2, `${fps} fps: two dozen jerks bring it in a little, not by the metre each`, `${jerked.came.toFixed(2)} m`);
    expect(still.beat === 0 && jerked.beat > 1, `${fps} fps: it flutters to the jerks and not otherwise`, `${jerked.beat.toFixed(1)} m against ${still.beat.toFixed(1)} m`);
    expect(Math.abs(jerked.line - still.line) < 0.6, `${fps} fps: the jerks do not pile up line`, `${jerked.line.toFixed(2)} m against ${still.line.toFixed(2)} m`);
    seen.push(jerked.came);
  }
  expect(Math.max(...seen) - Math.min(...seen) < 0.15, 'the same at any frame rate', seen.map((x) => x.toFixed(2)).join(' / '));
});

// ---------------------------------------------------------------- the view

// A stand-in rod: its tip is where the phone aims, 18 degrees above it, a fifth of the
// way toward the view, plus a nod.
function tipOf(aim, turned, nod = 0) {
  const aimYaw = 100 + turned.yaw, aimPitch = -10 + turned.pitch;
  return { yaw: aimYaw + 0.2 * (aim.viewYaw - aimYaw) - 0.7 + nod, pitch: aimPitch + 18 + 0.2 * (aim.viewPitch - aimPitch) + nod * 0.7 };
}

check('camera: after a fish is landed the view follows the phone again, cast after cast', () => {
  for (const fps of [20, 60]) {
    const dt = 1 / fps; const aim = createAim(100, -10); const turned = { yaw: 0, pitch: 0, roll: 0 };
    const run = (seconds, fn) => { for (let i = 0; i < seconds * fps; i += 1) fn(); };
    for (let cast = 1; cast <= 2; cast += 1) {
      run(4, () => aim.step(turned, false, dt, { yaw: 115, pitch: -9 }, tipOf(aim, turned)));
      run(3, () => { turned.yaw = Math.min(20, turned.yaw + 20 * dt); aim.step(turned, false, dt, { yaw: 115, pitch: -9 }, tipOf(aim, turned)); });
      const held = aim.viewYaw;
      run(3, () => aim.step(turned, true, dt, null, null));
      expect(aim.viewYaw === held, `cast ${cast}: with the finger down and nothing to watch the view holds still`, aim.viewYaw - held);
      run(4, () => { turned.yaw = Math.max(0, turned.yaw - 20 * dt); aim.step(turned, false, dt, null, null); });
      expect(Math.abs(aim.viewYaw - 100) < 0.5 && Math.abs(aim.rodYaw) < 0.5, `cast ${cast}, ${fps} fps: the net gone, the view comes back to the phone`, `view ${(aim.viewYaw - 100).toFixed(1)}°, rod ${aim.rodYaw.toFixed(1)}° off it`);
      run(2, () => { turned.yaw = Math.max(-15, turned.yaw - 20 * dt); aim.step(turned, false, dt, null, null); });
      expect(Math.abs(aim.viewYaw - 85) < 0.5, `cast ${cast}: with the line in, the view turns with the phone`, (aim.viewYaw - 100).toFixed(1));
      run(2, () => { turned.yaw = Math.min(0, turned.yaw + 20 * dt); aim.step(turned, false, dt, null, null); });
      run(3, () => aim.step(turned, false, dt, { yaw: 100, pitch: -7 }, null));
    }
  }
});

check('camera: the rod tip stays in its window and a nodding tip does not shake the view', () => {
  for (const fps of [20, 60, 120]) {
    const dt = 1 / fps;
    for (const [name, fish, heave, nod] of [['fish 30° left', 30, 0, 0], ['fish 30° right, tip nodding', -30, 0, 1.5], ['rod heaved left', 0, 35, 0], ['rod heaved right', 0, -35, 0], ['both ahead, tip nodding', 0, 0, 1.5]]) {
      const aim = createAim(100, -10); const turned = { yaw: 0, pitch: 0, roll: 0 };
      let out = 0, shake = 0, last = 100, settled = 0;
      for (let i = 0; i < fps * 9; i += 1) {
        const t = i * dt;
        if (t > 2 && t <= 2.4) turned.yaw += heave / 0.4 * dt;
        const wob = nod * (Math.sin(t * 31) + 0.6 * Math.sin(t * 53 + 1));
        const tip = tipOf(aim, turned, wob);
        aim.step(turned, false, dt, { yaw: 100 + fish, pitch: -9 }, tip);
        const off = tip.yaw - wob - aim.viewYaw;
        if (t > 1 && (off > 13.5 || off < -13.5)) out += dt;
        if (t > 6) { shake = Math.max(shake, Math.abs(aim.viewYaw - last) / dt); settled = off; }
        last = aim.viewYaw;
      }
      expect(out < 0.9, `${name}, ${fps} fps: the tip is out of the picture for under a second at worst`, `${out.toFixed(2)} s`);
      expect(settled < TIP_LEFT + 0.3 && settled > -TIP_RIGHT - 0.3, `${name}, ${fps} fps: the tip settles inside its window`, `${settled.toFixed(1)}°`);
      expect(shake < 4, `${name}, ${fps} fps: the settled view is not shaken by the tip`, `${shake.toFixed(2)}°/s`);
    }
  }
});

check('camera: whoever had the view, it is handed on without a jump', () => {
  // The most the view's speed may change in one frame, degrees a second: a jump is hundreds.
  const hands = [
    ['held with the line in, the phone swung, let go with no cast', (t, turned) => { if (t > 1 && t < 2) { turned.pitch -= 50 / 60; turned.yaw += 20 / 60; } return { held: t > 1 && t < 3 }; }],
    ['held while a fish is lifted, the phone raised, let go', (t, turned) => { if (t > 1 && t < 2.5) turned.pitch += 35 / 1.5 / 60; return { held: t > 0.5 && t < 4 }; }],
    ['a fight ends with the phone off to one side', (t, turned, aim) => { if (t > 1 && t < 2) turned.yaw += 25 / 60; return t < 5 ? { watch: { yaw: 110, pitch: -9 }, tip: tipOf(aim, turned) } : {}; }],
    ['a cast: held, swung, let go, the view goes to the water', (t, turned) => { if (t > 1 && t < 1.3) turned.pitch -= 200 / 60; return t < 1.3 ? { held: t > 0.5 } : { watch: { yaw: 100, pitch: -7 } }; }],
    ['a fish takes with the phone raised: the rod tip starts to count', (t, turned, aim) => { turned.pitch = 30; return { watch: { yaw: 100, pitch: -7 }, tip: t > 4 ? tipOf(aim, turned) : null }; }],
  ];
  for (const [name, script] of hands) {
    const aim = createAim(100, -10); const turned = { yaw: 0, pitch: 0, roll: 0 };
    let last = [aim.viewYaw, aim.viewPitch], lastSpeed = 0, jerk = 0;
    for (let i = 0; i < 60 * 12; i += 1) {
      const s = script(i / 60, turned, aim);
      aim.step(turned, !!s.held, 1 / 60, s.watch || null, s.tip || null);
      const speed = Math.hypot(aim.viewYaw - last[0], aim.viewPitch - last[1]) * 60;
      if (i > 0) jerk = Math.max(jerk, Math.abs(speed - lastSpeed));
      lastSpeed = speed; last = [aim.viewYaw, aim.viewPitch];
    }
    expect(jerk < 35, `${name}: the view's speed never steps`, `${jerk.toFixed(0)}°/s in one frame`);
  }
});

check('camera: a raised phone pushes the view up after the tip', () => {
  const dt = 1 / 60; const aim = createAim(100, -10); const turned = { yaw: 0, pitch: 0, roll: 0 };
  for (let i = 0; i < 60 * 6; i += 1) { if (i > 60 && turned.pitch < 30) turned.pitch += 60 * dt; aim.step(turned, false, dt, { yaw: 100, pitch: -9 }, tipOf(aim, turned)); }
  const up = tipOf(aim, turned).pitch - aim.viewPitch;
  expect(up < TIP_UP + 0.5, 'the tip is back inside the top of its window', `${up.toFixed(1)}° above centre`);
});

// ---------------------------------------------------------------- the rod's grip

check('rod hand: square and still with no effort, laid over toward the side it is carried to, and drawn round to a fish by how hard it pulls', () => {
  // The rod's heading, degrees to the right of straight ahead, and where its tip is.
  const heading = (root) => { const a = new THREE.Vector3(0, 1, 0).applyQuaternion(root.getWorldQuaternion(new THREE.Quaternion())); return Math.atan2(a.x, -a.z) / deg; };
  const pose = (side, effort, fps = 60, twitch = 0) => {
    const view = new THREE.PerspectiveCamera(); view.position.set(0, 1.7, 0); view.lookAt(0, 1.7 - Math.sin(10 * deg), -Math.cos(10 * deg)); view.updateMatrixWorld(true);
    const root = new THREE.Object3D(); view.add(root); const hold = createRodHold(root, 0.1);
    hold.setPull(new THREE.Vector3(Math.sin(side * deg) * 14, -0.5, -Math.cos(side * deg) * 14));
    let fastest = 0, last = 0, before = 0;
    for (let i = 0; i < 4 * fps; i += 1) {
      hold.setStrain(effort * (1 - Math.exp(-9 * i / fps)));
      // A twitch of the phone in the last frame.
      if (i === 4 * fps - 1) { before = heading(root); hold.setAim(0, twitch, 0); }
      hold.carry(1 / fps);
      const under = new THREE.Vector3(0, 0, 1).applyQuaternion(root.getWorldQuaternion(new THREE.Quaternion()));
      const roll = Math.atan2(under.x, -under.y) / deg;
      if (i > 0) fastest = Math.max(fastest, Math.abs(roll - last) * fps);
      last = roll;
    }
    return { roll: last, fastest, heading: heading(root), twitched: heading(root) - before, tip: new THREE.Vector3(0, 2.13, 0).applyMatrix4(root.matrixWorld) };
  };
  const idle = pose(25, 0), right = pose(25, 0.5), left = pose(-25, 0.5), ahead = pose(-4, 0.5);
  expect(idle.fastest === 0, 'no effort, no movement at all', idle.fastest);
  expect(right.roll - idle.roll > 15, 'fish to the right: the reel swings out to the right', (right.roll - idle.roll).toFixed(1));
  expect(left.roll - idle.roll < -15, 'fish to the left: the reel swings out to the left', (left.roll - idle.roll).toFixed(1));
  expect(Math.abs(ahead.roll - idle.roll) < 4, 'fish dead ahead of the rod: it sits square', (ahead.roll - idle.roll).toFixed(1));
  expect(right.fastest < 400, 'it rolls over, it does not snap', `${right.fastest.toFixed(0)}°/s`);
  // The give. The fish is 25° to the right, the rod is held 4° to the left: 29° apart.
  const apart = 25 - idle.heading;
  const share = (p) => (p.heading - idle.heading) / apart;
  const light = pose(25, 0.06), hard = pose(25, 0.95);
  expect(share(light) < 0.2, 'a fish barely pulling leaves the rod where the phone points', `${(100 * share(light)).toFixed(0)}% of the way to it`);
  expect(share(right) > 0.4 && share(right) < 0.7, 'one pulling as hard as the reel holds draws it about half way round', `${(100 * share(right)).toFixed(0)}%`);
  expect(share(hard) > share(right) + 0.08 && share(hard) < 0.9, 'leant on, further, and never right round to the fish', `${(100 * share(hard)).toFixed(0)}%`);
  const leftShare = (left.heading - idle.heading) / (-25 - idle.heading);
  expect(left.heading < idle.heading - 5 && Math.abs(leftShare - share(right)) < 0.1, 'to the left as to the right', `${(100 * leftShare).toFixed(0)}%`);
  expect(Math.abs(right.tip.y - idle.tip.y) < 0.06 && Math.abs(hard.tip.y - idle.tip.y) < 0.09, 'round, not down: the tip stays as high as the phone holds it', `${(right.tip.y - idle.tip.y).toFixed(3)} m, ${(hard.tip.y - idle.tip.y).toFixed(3)} m`);
  for (const fps of [20, 120]) expect(Math.abs(pose(25, 0.5, fps).heading - right.heading) < 0.3, `${fps} fps: it settles in the same place`, pose(25, 0.5, fps).heading.toFixed(2));
  // A quick twitch of the phone still reaches the rod, nearly whole, before the fish draws it back.
  const flick = pose(25, 0.5, 60, 10);
  expect(flick.twitched < -8, 'a 10° twitch away from the fish moves the rod nearly 10° at once', `${flick.twitched.toFixed(1)}°`);
});

// ---------------------------------------------------------------- whole casts

// One fish, hooked to landed or lost. Returns what happened.
function fightOne({ seed, fps, press, size, random, seconds = 400, each }) {
  const rig = createRig({ seed, fps, press, hold: 0.3 + 0.1 * (seed % 5), sizes: size ? () => size : null, random });
  const f = rig.fishing; const lure = createLure(); const q = new THREE.Quaternion(), lastQ = new THREE.Quaternion();
  const r = { end: '', fightFor: 0, given: 0, maxTension: 0, lureTurn: 0, slip: 0, tipFast: 0, sawFight: false, rig };
  let hookedAt = -1, have = false; const lastTip = { x: 0, y: 0, z: 0 };
  while (rig.time < seconds) {
    rig.step();
    expect(Number.isFinite(rig.line.tip.x + f.lineOut + f.tension + f.lure.x), 'nothing goes NaN');
    const m = f.lure;
    lure.place(m.x, m.y, m.z, m.nose.x, m.nose.y, m.nose.z, m.swum, m.back.x, m.back.y, m.back.z);
    q.copy(lure.object.quaternion);
    // Degrees a second, so that the same turn reads the same at any frame rate.
    if (have) r.lureTurn = Math.max(r.lureTurn, 2 * Math.acos(Math.min(1, Math.abs(q.dot(lastQ)))) / deg * fps);
    lastQ.copy(q); have = true;
    const tip = rig.line.tip;
    if (hookedAt >= 0) r.tipFast = Math.max(r.tipFast, Math.hypot(tip.x - lastTip.x, tip.y - lastTip.y, tip.z - lastTip.z) * fps);
    lastTip.x = tip.x; lastTip.y = tip.y; lastTip.z = tip.z;
    if (each) each(rig, r);
    if (f.stage === 'fight') {
      if (hookedAt < 0) hookedAt = rig.time;
      r.sawFight = true; r.maxTension = Math.max(r.maxTension, f.tension); r.given += f.running * rig.dt;
    } else if (hookedAt >= 0 && !r.end) {
      r.end = f.stage === 'landed' ? 'landed' : f.lost; r.fightFor = rig.time - hookedAt;
      if (f.lost) rig.windWater = true;
    }
    if (r.end && f.stage === 'ready') break;
    if (r.end === 'landed' && f.stage === 'water') break;
  }
  return r;
}

check('casts: every size of fish is landed by winding only while it rests, at 20 and 60 frames', () => {
  for (const size of [0.85, 1.2, 1.4]) {
    const times = {};
    for (const fps of [60, 20]) {
      times[fps] = [];
      for (const seed of [1, 2, 3]) {
        const r = fightOne({ seed, fps, press: 'rests', size });
        expect(r.end === 'landed', `size ${size}, ${fps} fps, seed ${seed}: landed`, r.end || 'still on the line');
        expect(r.maxTension < RUN_OUT_AT + 3.2, `size ${size}: unpressed, the tension stays near the point where line runs out`, r.maxTension.toFixed(1));
        // Leaving the tip its nose swings round at about 950°/s. A flip of its back, the
        // fault this guards against, was half a turn in one frame: over 3000°/s.
        expect(r.lureTurn < 1400, `size ${size}, ${fps} fps, seed ${seed}: the lure never flips over`, `${r.lureTurn.toFixed(0)}°/s`);
        expect(r.tipFast < 6, `size ${size}: the rod tip never jumps`, `${r.tipFast.toFixed(1)} m/s`);
        if (size < 1) expect(r.given < 2, `size ${size}: a small fish takes next to no line`, `${r.given.toFixed(1)} m`);
        else expect(r.given > 2, `size ${size}: a big fish takes line`, `${r.given.toFixed(1)} m`);
        times[fps].push(r.fightFor);
      }
    }
    const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
    expect(Math.abs(mean(times[60]) - mean(times[20])) < 0.35 * mean(times[60]), `size ${size}: the fight takes about as long at 20 frames as at 60`, `${mean(times[60]).toFixed(0)} s and ${mean(times[20]).toFixed(0)} s`);
  }
});

check('casts: left alone a fish is neither landed nor lost, and the line does not run right out', () => {
  for (const size of [0.85, 1.4]) {
    const r = fightOne({ seed: 2, fps: 30, press: 'never', size, seconds: 120 });
    expect(r.sawFight && !r.end, `size ${size}: still on the line after two minutes`, r.end);
    expect(r.rig.fishing.lineOut < 60, `size ${size}: line out stays well short of the spool`, r.rig.fishing.lineOut.toFixed(0));
  }
});

check('casts: a line leant on until it breaks leaves bare line to wind in, then a new lure', () => {
  // A draw of 0 gives the line the least wear it can stand: the biggest fish breaks it.
  let hidden = 0, frames = 0, came = 0, jump = 0, lastOut = 0, lost = false, woundWhileHeld = 0, lostAt = 0;
  const r = fightOne({ seed: 1, fps: 60, press: 'always', size: 1.4, random: () => 0, each: (rig) => {
    const f = rig.fishing;
    if (f.lost) {
      if (!lost) { lost = true; lostAt = rig.time; lastOut = f.lineOut; rig.finger = () => rig.time - lostAt < 0.5 || rig.time - lostAt > 1.5; }
      frames += 1; if (!rig.lureSeen.visible) hidden += 1; if (f.fish !== 'none') came += 1;
      jump = Math.max(jump, Math.abs(f.lineOut - lastOut) / rig.dt);
      // Line may still go out after the sinking end. None may come in.
      if (rig.time - lostAt < 0.5) woundWhileHeld = Math.max(woundWhileHeld, lastOut - f.lineOut);
    }
    lastOut = f.lineOut;
  } });
  expect(r.end === 'broke', 'the line breaks', r.end);
  expect(r.fightFor > 1.5, 'not the moment it is leant on', `${r.fightFor.toFixed(1)} s`);
  expect(hidden === frames && came === 0, 'while the line is bare there is no lure and no fish comes', `lure hidden ${hidden}/${frames}, fish ${came}`);
  expect(jump < 2, 'the line length does not jump when it breaks', `${jump.toFixed(2)} m/s`);
  expect(woundWhileHeld < 1e-9, 'the finger that was down when it broke winds nothing until it has been lifted', woundWhileHeld);
  expect(r.rig.fishing.stage === 'ready' && r.rig.lureSeen.visible && r.rig.fishing.lost === '', 'wound right in, the cast is over and a lure is back on');
});

check('casts: winding only while it rests never breaks the line', () => {
  for (const seed of [1, 2, 3, 4, 5, 6]) expect(fightOne({ seed, fps: 30, press: 'rests', size: 1.4 }).end === 'landed', `seed ${seed}: landed`);
});

check('casts: with no fish the stages run in order and an untouched lure sinks where it landed', () => {
  for (const fps of [20, 60]) {
    const rig = createRig({ seed: 3, fps, hold: 0.2, noSchool: true }); const f = rig.fishing; const stages = [];
    let at = null, drift = 0, t0 = -1; rig.finger0 = rig.finger; rig.finger = () => (t0 >= 0 && rig.time - t0 > 12 ? true : rig.finger0());
    while (rig.time < 60) {
      rig.step();
      if (stages[stages.length - 1] !== f.stage) stages.push(f.stage);
      if (f.stage === 'water' && t0 < 0) { t0 = rig.time; at = [f.lure.x, f.lure.z]; }
      if (t0 >= 0 && rig.time - t0 < 12) drift = Math.max(drift, Math.hypot(f.lure.x - at[0], f.lure.z - at[1]));
      if (t0 >= 0 && rig.time - t0 > 12.5 && f.stage === 'ready') break;
    }
    expect(stages.join('>') === 'ready>flight>water>ready', `${fps} fps: ready, flight, water, ready`, stages.join('>'));
    expect(drift < 0.05, `${fps} fps: finger up, the lure sinks straight down`, `${drift.toFixed(3)} m sideways`);
    expect(rig.strain === 0, 'with no fish the hand never works');
  }
});

check('landed fish: it turns about the line to show its sides, and its pose never jumps', () => {
  const frame = (f) => { const cy = Math.cos(f.yaw), sy = Math.sin(f.yaw), cp = Math.cos(f.pitch), sp = Math.sin(f.pitch), cr = Math.cos(f.roll), sr = Math.sin(f.roll); return [[sy * cp, -sp, cy * cp], [-sr * cy + cr * sp * sy, cr * cp, sr * sy + cr * sp * cy]]; };
  const ang = (a, b) => Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))) / deg;
  for (const fps of [60, 20]) {
    let fish = null, last = null, spin = 0, fastest = 0;
    fightOne({ seed: 2, fps, press: 'always', size: 0.9, each: (rig) => {
      if (rig.fishing.stage !== 'landed') return;
      fish = fish || rig.fishes.find((x) => x.state === 'hung'); if (!fish) return;
      const fr = frame(fish); if (last) fastest = Math.max(fastest, ang(fr[0], last[0]) * fps, ang(fr[1], last[1]) * fps); last = fr;
      spin = Math.max(spin, Math.abs(fish.spin));
    } });
    expect(spin > Math.PI, `${fps} fps: it comes at least half way round`, `${(spin / deg).toFixed(0)}°`);
    expect(fastest < 500, `${fps} fps: nose and back never turn faster than a thrash`, `${fastest.toFixed(0)}°/s`);
  }
});

check('fight: fish run out and away, and stay in front of the angler', () => {
  let ahead = 0, across = 0, total = 0, worst = 0;
  for (const seed of [1, 2, 3, 4]) {
    let lx = null, lz = 0;
    fightOne({ seed, fps: 60, press: 'rests', size: seed % 2 ? 1.3 : 0.9, each: (rig) => {
      const f = rig.fishing; if (f.stage !== 'fight') { lx = null; return; }
      const e = rig.line.end, tip = rig.line.tip;
      worst = Math.max(worst, Math.abs(wrap(Math.atan2(e.x - tip.x, e.z - tip.z) - 100 * deg)) / deg);
      if (lx !== null && f.mood === 'run') {
        const vx = (e.x - lx) * 60, vz = (e.z - lz) * 60;
        if (Math.hypot(vx, vz) > 1) { const a = Math.abs(wrap(Math.atan2(vx, vz) - Math.atan2(e.x - tip.x, e.z - tip.z))) / deg; total += 1; if (a < 60) ahead += 1; else if (a < 100) across += 1; }
      }
      lx = e.x; lz = e.z;
    } });
  }
  expect(ahead / total > 0.7, 'most of a run heads out, straight or slanting', `${(100 * ahead / total).toFixed(0)}%`);
  expect(across / total < 0.15, 'little of it is flat across', `${(100 * across / total).toFixed(0)}%`);
  expect(worst < 50, 'it stays within reach in front', `${worst.toFixed(0)}° off the cast line`);
});

check('hand: what it holds is what the line carries, winding or not', () => {
  // The hand used to hold the fish's own pull and nothing else: a resting fish being
  // wound in bent the rod as deep as a run did, and the hand said it was holding nothing.
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  for (const [size, press] of [[0.85, 'always'], [1.3, 'rests'], [1.3, 'never']]) {
    const hand = { run: [], rest: [] }, line = { run: [], rest: [] }; let since = 0, was = '';
    fightOne({ seed: 3, fps: 60, press, size, seconds: 60, each: (rig) => {
      const f = rig.fishing; if (f.stage !== 'fight') return;
      since = f.mood === was ? since + rig.dt : 0; was = f.mood;
      // The hand's effort is its hold over 9 N (strain.js).
      if (since > 0.8) { hand[f.mood].push(f.effort * 9); line[f.mood].push(f.tension); }
    } });
    for (const mood of ['run', 'rest']) {
      if (hand[mood].length < 30) continue;
      const h = mean(hand[mood]), t = mean(line[mood]);
      expect(Math.abs(h - t) < 0.3 * t + 0.3, `size ${size}, finger ${press}, ${mood}: the hand holds about what the line pulls`, `${h.toFixed(2)} N against ${t.toFixed(2)} N`);
    }
  }
});

check('fight: a run beats the tail wide and fast all the way through, a rest goes quiet', () => {
  // A fish up to speed used to let its tail go slack: the beat followed only how much
  // faster it still wanted to go.
  for (const size of [0.85, 1.3]) {
    const run = [], rest = [], stroke = []; let since = 0, was = null;
    fightOne({ seed: 4, fps: 60, press: 'never', size, seconds: 40, each: (rig) => {
      const f = rig.fishing; if (f.stage !== 'fight') return;
      const fish = rig.fishes.find((x) => x.state === 'held'); if (!fish) return;
      since = f.mood === was ? since + rig.dt : 0; was = f.mood;
      // Well past the start of each: the start of a run is a burst either way.
      if (since > 0.6 && f.mood === 'run' && f.stamina > 0.5) { run.push(fish.drive); stroke.push(fish.stroke); }
      if (since > 1 && f.mood === 'rest') rest.push(fish.drive);
    } });
    const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
    expect(run.length > 20 && rest.length > 20, `size ${size}: it both ran and rested`, `${run.length} / ${rest.length}`);
    expect(mean(run) > 0.9, `size ${size}: well into a run its tail still beats wider than cruising (0.55)`, mean(run).toFixed(2));
    expect(Math.min(...stroke) > 0.7, `size ${size}: and at least twice as fast as cruising (0.35 m/s)`, Math.min(...stroke).toFixed(2));
    expect(mean(rest) < 0.4, `size ${size}: resting, it barely beats`, mean(rest).toFixed(2));
  }
});

// ---------------------------------------------------------------- run them

let failed = 0;
const started = Date.now();
for (const [name, fn] of checks) {
  const t = Date.now();
  try { fn(); console.log(`ok    ${name}  (${((Date.now() - t) / 1000).toFixed(1)} s)`); }
  catch (err) { failed += 1; console.log(`FAIL  ${name}\n      ${err.message}`); }
}
console.log(`\n${checks.length - failed} of ${checks.length} passed in ${((Date.now() - started) / 1000).toFixed(0)} s`);
process.exit(failed ? 1 : 0);
