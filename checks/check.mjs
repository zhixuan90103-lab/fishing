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
import { createThump } from '../src/play/thump.js';
import { createStrain } from '../src/play/strain.js';
import { SPEED_FULL, SPEED_MIN, castReach } from '../src/play/swing.js';
import { createLureMove } from '../src/shore/lureMove.js';
import { createRodFlex } from '../src/shore/rodFlex.js';
import { createLineCurve } from '../src/shore/lineCurve.js';
import { createWakeTrack } from '../src/shore/wakeTrack.js';
import { createSnap } from '../src/play/snap.js';
import { drawNature, fishOf, HARDEST_RUN } from '../src/play/fishKind.js';
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

check('fight: no clock. A run ends when its burst is spent, sooner the harder it is held, and the next waits for the burst to come back', () => {
  const big = fishOf('dorade', 1.3);
  // One run from fresh, against a line pulling `share` of what the fish pulls. How long it lasted and what it cost.
  const run = (share, fps = 60, fish = big) => { const f = createFight(() => 0.5); f.begin(fish); let t = 0; while (f.running && t < 30) { f.step(1 / fps, f.force * share); t += 1 / fps; } return { lasted: t, cost: 1 - f.stamina, f }; };
  const held = run(1), free = run(0);
  // A run used to be over in a second or two: too short for the fish to get anywhere, or to turn.
  expect(held.lasted > 4 && held.lasted < 9, 'held hard, a fresh run still lasts several seconds', `${held.lasted.toFixed(2)} s`);
  expect(free.lasted > held.lasted * 2, 'on a free reel the same run goes on more than twice as long', `${free.lasted.toFixed(2)} s against ${held.lasted.toFixed(2)} s`);
  expect(Math.abs(free.cost - held.cost) < 0.05, 'either way a run costs it the same: holding it gets that run over with, and keeps the line', `${free.cost.toFixed(2)} and ${held.cost.toFixed(2)}`);
  for (const fps of [20, 120]) expect(Math.abs(run(1, fps).lasted - held.lasted) < 0.06, `${fps} fps: the same`, run(1, fps).lasted.toFixed(2));
  // The rest: how long until it bolts again, hanging on the line or being drawn along.
  const rest = (drawn, fish = big) => { const { f } = run(1, 60, fish); let t = 0; while (!f.running && t < 60) { f.step(1 / 60, fish.rest * drawn); t += 1 / 60; } return t; };
  expect(rest(1) > 1 && rest(1) < 6, 'hanging on the line it has its burst back in a few seconds', `${rest(1).toFixed(1)} s`);
  expect(rest(2.5) > rest(1) * 1.4, 'drawn along by the line it takes a good deal longer', `${rest(2.5).toFixed(1)} s against ${rest(1).toFixed(1)} s`);
  // Worn down, a run is weaker and shorter-lived, and it never stops trying.
  const f = createFight(() => 0.5); f.begin(big); let runs = 0, first = 0, lastForce = 0, t = 0, peak = 0;
  while (t < 200 && runs < 12) { const was = f.running; f.step(1 / 60, f.force); t += 1 / 60; if (f.running) peak = Math.max(peak, f.force); if (was && !f.running) { runs += 1; if (runs === 1) first = peak; lastForce = peak; peak = 0; } }
  expect(runs >= 6, 'it goes on running, run after run', runs);
  expect(lastForce < first * 0.6, 'each weaker than the last, until it can no longer take line', `${first.toFixed(1)} N then ${lastForce.toFixed(1)} N`);
  // No two fish alike.
  const draws = seeded(11); const kinds = Array.from({ length: 40 }, () => fishOf('dorade', 1.3, drawNature(draws)));
  const spread = (key) => Math.max(...kinds.map((k) => k[key])) / Math.min(...kinds.map((k) => k[key]));
  expect(spread('runFresh') > 1.15 && spread('recover') > 1.25 && spread('goAt') > 1.4, 'fish of one size differ in strength, in how fast they recover and in how soon they bolt again', `${spread('runFresh').toFixed(2)}, ${spread('recover').toFixed(2)}, ${spread('goAt').toFixed(2)} times`);
  expect(Math.max(...Array.from({ length: 200 }, () => fishOf('dorade', 0.95, drawNature(draws)).runFresh)) < RUN_OUT_AT && Math.max(...kinds.map((k) => k.runFresh)) <= HARDEST_RUN && HARDEST_RUN < BREAK_AT, 'and no nature carries a small fish over the reel, or any fish over the line');
});

check('fight: the line draws it toward the rod tip and nowhere else, and brought round it swings in an arc', () => {
  // Where a fish wound in while it rests comes to hand, with the rod carried off to one side or the other.
  const lands = (turn) => {
    let at = 0; const radii = [];
    for (const seed of [1, 2, 3]) {
      let lx = null, lz = 0, lyaw = 0, last = null;
      fightOne({ seed, fps: 60, press: 'rests', size: 0.85, each: (rig) => {
        rig.rodStays = true; const f = rig.fishing; rig.rodTurn = f.stage === 'fight' ? turn * deg : 0;
        const fish = rig.fishes.find((x) => x.state === 'held'); if (f.stage !== 'fight' || !fish) { lx = null; return; }
        last = wrap(Math.atan2(fish.x - 0, fish.z - 2) - 100 * deg) / deg;
        // Brought round by the line, not bolting: a fish starting a run flips where it is.
        if (lx !== null && f.mood === 'rest') { const sp = Math.hypot(fish.x - lx, fish.z - lz) * 60, w = Math.abs(wrap(fish.yaw - lyaw)) * 60; if (w > 1 && sp > 0.3) radii.push(sp / w); }
        lx = fish.x; lz = fish.z; lyaw = fish.yaw;
      } });
      at += last / 3;
    }
    radii.sort((a, b) => a - b);
    return { at, tight: radii[Math.floor(radii.length * 0.1)] };
  };
  const left = lands(50), right = lands(-50);
  // Yaw is positive to the left: with the rod carried left its tip is to the left, and that is where the fish comes in.
  expect(left.at > right.at + 8, 'it comes to hand on the side the rod tip is', `${left.at.toFixed(0)}° with the rod to the left, ${right.at.toFixed(0)}° with it to the right`);
  // It used to all but stop and turn on the spot: a tenth of its sharp turns were inside 4 cm.
  expect(left.tight > 0.12 && right.tight > 0.12, 'brought round by the line while it has way on, it swings round on a radius, not on the spot', `${left.tight.toFixed(2)} m, ${right.tight.toFixed(2)} m`);
});

check('fight: it tears about, both ways and of its own accord, and from a big one line is won only while it rests', () => {
  // It used to make a run of under a second, half a metre to one side, always the side
  // away from the rod, and be wound in whatever it did: a weight on a string.
  for (const [name, size, lasts, goes, fast] of [['small', 0.85, 1.5, 1.2, 1.6], ['big', 1.3, 2.5, 2, 2.2]]) {
    const runs = [], side = [], peaks = []; let left = 0, right = 0, turns = 0, fights = 0, wonRun = 0, wonRest = 0, tRun = 0, tRest = 0, flips = 0, same = 0;
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      let was = '', t0 = 0, from = null, px = null, pz = 0, last = 0, lineWas = null, peak = 0, ran = 0;
      fightOne({ seed, fps: 60, press: 'always', size, seconds: 200, each: (rig) => {
        const f = rig.fishing; if (f.stage !== 'fight') { px = null; lineWas = null; return; }
        // The rod stays 30 degrees to one side from first to last: nothing the angler does changes.
        rig.rodStays = true; rig.rodTurn = 30 * deg;
        const e = rig.line.end, tip = rig.line.tip; const dx = e.x - tip.x, dz = e.z - tip.z, far = Math.hypot(dx, dz);
        if (f.mood === 'run' && was !== 'run') { t0 = rig.time; from = { x: e.x, z: e.z, ux: dx / far, uz: dz / far }; peak = 0; }
        if (f.mood !== 'run' && was === 'run' && from) { const went = (e.x - from.x) * -from.uz + (e.z - from.z) * from.ux; runs.push(rig.time - t0); side.push(Math.abs(went)); peaks.push(peak); if (Math.abs(went) > 0.5) { if (ran && Math.sign(went) !== ran) flips += 1; else if (ran) same += 1; ran = Math.sign(went); } }
        if (px !== null) {
          // Which way round the rod it is going, while it is going anywhere.
          const across = ((e.x - px) * -dz + (e.z - pz) * dx) / far * 60;
          if (f.mood === 'run') peak = Math.max(peak, Math.hypot(e.x - px, e.z - pz) * 60);
          if (f.mood === 'run' && Math.abs(across) > 0.5) { if (across > 0) left += 1; else right += 1; const now = Math.sign(across); if (last && now !== last) turns += 1; last = now; }
          const won = lineWas - rig.line.length;
          if (f.mood === 'run') { wonRun += won; tRun += rig.dt; } else { wonRest += won; tRest += rig.dt; }
        }
        px = e.x; pz = e.z; was = f.mood; lineWas = rig.line.length;
      } });
      fights += 1;
    }
    const mid = (a) => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
    expect(mid(runs) > lasts, `${name}: a run lasts seconds, not a moment`, `${mid(runs).toFixed(1)} s`);
    expect(mid(side) > goes, `${name}: and takes it metres across`, `${mid(side).toFixed(1)} m`);
    expect(mid(peaks) > fast, `${name}: at a real fish's pace`, `${mid(peaks).toFixed(1)} m/s`);
    expect(Math.min(left, right) / (left + right) > 0.25, `${name}: with the rod never moved it still goes both ways`, `${(100 * left / (left + right)).toFixed(0)}% one way`);
    expect(turns / fights >= 2, `${name}: turning of its own accord, more than once a fight`, `${(turns / fights).toFixed(1)} turns a fight`);
    expect(flips > same, `${name}: brought round by the line, its next run goes to the other side more often than the same`, `${flips} to the other side, ${same} to the same`);
    // Only of a fish that can take line. A small one pulls less than the reel holds, run or rest, and comes in either way: docs/NOTED.md.
    if (size > 1) expect(wonRest / tRest > 0.4 && wonRun / tRun < 0.1, `${name}: line is won while it rests and none while it runs`, `${(wonRest / tRest).toFixed(2)} m/s resting, ${(wonRun / tRun).toFixed(2)} m/s running`);
  }
});

check('course: runs head out and to a side, not flat across', () => {
  const course = createCourse(seeded(3)); const lean = [];
  for (let i = 0; i < 400; i += 1) { course.begin(); lean.push(course.across(true, 1, 3, 5, 20) / 3); }
  const sides = lean.filter((x) => x > 0).length / lean.length;
  expect(sides > 0.4 && sides < 0.6, 'left and right about as often', sides.toFixed(2));
  expect(Math.min(...lean.map(Math.abs)) > 0.1 && Math.max(...lean.map(Math.abs)) <= 1, 'every run leans a little, none more than its dash', `${Math.min(...lean.map(Math.abs)).toFixed(2)}..${Math.max(...lean.map(Math.abs)).toFixed(2)}`);
  course.begin();
  // Close in it used to be held to a third. It is brought in to a bank it wants away from, and is not to go quiet there.
  expect(Math.abs(course.across(true, 1, 3, 0)) < Math.abs(course.across(true, 1, 3, 7)) * 0.6 && Math.abs(course.across(true, 1, 3, 0)) > Math.abs(course.across(true, 1, 3, 7)) * 0.35, 'right under the rod it goes across at about half the speed, where the same speed would whip it round');
  expect(Math.abs(course.across(false, 1, 3, 0, 20)) < 0.1, 'resting it barely moves across');
});

check('cast: the lure flies off as fast as the rod tip was carrying it, so a harder swing lands further and a late release still counts', () => {
  // A swing of the real rod: the phone tips forward through `arc` degrees at `rate`°/s with
  // the finger down, and the finger comes up `late` seconds after it stops. Where the lure lands.
  const cast = (fps, rate, late = 0.02, arc = 60) => {
    const rig = createRig({ seed: 1, fps, noSchool: true, sensor: true }); const f = rig.fishing; const end = 1.2 + arc / rate; let from = null;
    // The view looking 30° up when the finger goes down: that is the way it is thrown.
    rig.viewPitch = 30;
    rig.finger = () => rig.time > 1 && rig.time < end + late;
    while (rig.time < 12) {
      rig.setLift(rig.time < 1.2 ? 70 : Math.max(70 - arc, 70 - rate * (rig.time - 1.2))); rig.step();
      if (f.stage === 'flight' && !from) from = { x: rig.line.tip.x, z: rig.line.tip.z, read: f.lastRelease };
      if (f.stage === 'water') return { reach: Math.hypot(f.lure.x - from.x, f.lure.z - from.z), read: from.read };
    }
    return { reach: 0, read: f.lastRelease };
  };
  expect(castReach(SPEED_MIN - 0.1) === 0 && castReach(SPEED_MIN) > 0, 'a tip moving slower than a cast needs throws nothing');
  expect(castReach(SPEED_FULL * 2) === castReach(SPEED_FULL), 'and the line carries a lure only so far', castReach(SPEED_FULL).toFixed(1));
  expect(cast(60, 100).reach === 0, 'an unhurried tilt of the phone is not a cast');
  const reach = [200, 300, 400, 500].map((rate) => cast(60, rate).reach);
  for (let i = 1; i < reach.length; i += 1) expect(reach[i] > reach[i - 1] + 2, 'a harder swing lands further', reach.map((r) => r.toFixed(1)).join(' '));
  expect(reach[2] > 14 && reach[2] < 24, 'an ordinary swing, 400°/s, reaches well out', `${reach[2].toFixed(1)} m`);
  // The blank whips: the tip is going faster than a stiff rod's would at the same swing.
  expect(cast(60, 400).read > 400 * deg * 2.03, 'the tip is going faster than a stiff rod of that length would carry it', `${cast(60, 400).read.toFixed(1)} m/s`);
  for (const rate of [300, 400]) {
    const at = [20, 60, 120].map((fps) => cast(fps, rate).reach);
    expect(Math.max(...at) - Math.min(...at) < 1.5, `${rate}°/s: it lands in the same place at 20, 60 and 120 frames a second`, at.map((r) => r.toFixed(1)).join(' / '));
  }
  // The finger lifted early in the swing: the blank has not let go yet, and the lure waits for it.
  // Ten tries on a phone threw nothing, every one let go before the tip had got going.
  for (const part of [0.1, 0.25, 0.5, 0.75]) {
    const early = cast(60, 400, (60 / 400) * (part - 1));
    expect(Math.abs(early.reach - reach[2]) < 1.5, `let go ${part * 100}% of the way through the swing, it is the same cast`, `${early.reach.toFixed(1)} m against ${reach[2].toFixed(1)} m`);
  }
  expect(cast(60, 600, (40 / 600) * (0.25 - 1), 40).reach > 8, 'a quick flick let go almost at once is still a cast', `${cast(60, 600, (40 / 600) * (0.25 - 1), 40).reach.toFixed(1)} m`);
  // It is thrown along the line of sight as it was when the finger went down. The same swing, looking higher or lower.
  const thrown = (pitch, turned = 0) => {
    const rig = createRig({ seed: 1, fps: 60, noSchool: true, sensor: true }); const f = rig.fishing; let top = 0, began = 0, from = null; rig.viewPitch = pitch;
    rig.finger = () => rig.time > 1 && rig.time < 1.2 + (55 / 400) * 0.5;
    while (rig.time < 14) {
      // After the finger is down the view is said to look somewhere else: it must not matter.
      if (rig.time > 1.1) rig.viewPitch = pitch + turned;
      rig.setLift(rig.time < 1.2 ? 80 : Math.max(25, 80 - 400 * (rig.time - 1.2))); rig.step();
      if (f.stage === 'flight') { if (!began) { began = rig.time; from = { x: rig.line.tip.x, z: rig.line.tip.z }; } top = Math.max(top, f.lure.y); }
      if (f.stage === 'water') return { angle: f.lastAngle, top, aloft: rig.time - began, reach: Math.hypot(f.lure.x - from.x, f.lure.z - from.z) };
    }
    return { angle: 0, top: 0, aloft: 0, reach: 0 };
  };
  const level = thrown(0), up = thrown(30), high = thrown(60);
  expect(Math.abs(level.angle) < 0.5 && Math.abs(up.angle - 30) < 0.5 && Math.abs(high.angle - 60) < 0.5, 'it leaves at the angle the view was looking', `${level.angle.toFixed(0)}°, ${up.angle.toFixed(0)}°, ${high.angle.toFixed(0)}°`);
  expect(up.reach > level.reach + 5 && high.top > up.top + 3 && high.aloft > level.aloft * 2, 'looking level drives it flat and short, looking up carries it far, looking high lobs it', `${level.reach.toFixed(1)} m, ${up.reach.toFixed(1)} m, ${high.reach.toFixed(1)} m; tops ${level.top.toFixed(1)}, ${up.top.toFixed(1)}, ${high.top.toFixed(1)} m`);
  expect(thrown(-60).angle > -26 && thrown(89).angle < 71 && thrown(-60).reach > 1, 'never straight up, nor into the water at the feet', `${thrown(-60).angle.toFixed(0)}° to ${thrown(89).angle.toFixed(0)}°`);
  expect(Math.abs(thrown(30, -40).reach - up.reach) < 0.01, 'where the view looks after the finger is down changes nothing', thrown(30, -40).reach.toFixed(2));
  expect(cast(60, 400, 0.1).reach > 9, 'let go a tenth of a second late, it is still a fair cast', `${cast(60, 400, 0.1).reach.toFixed(1)} m`);
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

check('line: under a sinking lure the bend is spread along the wet line, no corner at the surface and no drop by the lure', () => {
  // It used to lie where it was, flat on the water, all but the last metre, which went
  // down with the lure: a corner and a drop. Worst with a little line to spare, as a
  // hand-held rod leaves it.
  const n = 49; const out = new Float64Array(n * 3); const reach = 13;
  const sunk = (fps, spare) => {
    const c = createLineCurve(n); const dt = 1 / fps; const tip = [0, 2.7, 0]; let end = [0, 2.6, -0.3];
    c.step(dt, ...tip, ...end, 0.32, 0, out, 0);
    const flight = Math.round(1.2 * fps);
    for (let i = 1; i <= flight; i += 1) { const u = i / flight; end = [0, 2.6 * (1 - u) + 5 * u * (1 - u) - 0.05 * u, -0.3 - (reach - 0.3) * u]; c.step(dt, ...tip, ...end, Math.hypot(end[1] - 2.7, end[2]) * 1.001, 0, out, 0); }
    for (let i = 0; i < 3 * fps; i += 1) { end = [0, end[1] - 0.4 * dt, -reach]; c.step(dt, ...tip, ...end, Math.hypot(end[1] - 2.7, end[2]) + spare, 0, out, 0); }
    // Each wet stretch's slope below the level, degrees, from the surface to the lure.
    const slopes = [];
    for (let i = 1; i < n; i += 1) if (out[i * 3 + 1] < 0) slopes.push(Math.atan2(out[i * 3 - 2] - out[i * 3 + 1], out[i * 3 - 1] - out[i * 3 + 2]) / deg);
    let sharpest = 0; for (let i = 1; i < slopes.length; i += 1) sharpest = Math.max(sharpest, Math.abs(slopes[i] - slopes[i - 1]));
    // How deep the line is two and a half metres short of the lure.
    let back = 0; for (let i = 1; i < n; i += 1) if (out[i * 3 + 2] + reach < 2.5) { back = -out[i * 3 + 1]; break; }
    return { last: slopes[slopes.length - 1], first: slopes[0], sharpest, back, depth: -end[1] };
  };
  for (const spare of [0, 0.3]) {
    const s = sunk(60, spare);
    expect(s.last < 36, `by the lure it slopes, it does not drop (${spare} m to spare)`, `${s.last.toFixed(0)} degrees`);
    expect(s.first < 15, `it goes into the water flat (${spare} m to spare)`, `${s.first.toFixed(0)} degrees`);
    expect(s.sharpest < 4, `no corner anywhere under the water (${spare} m to spare)`, `${s.sharpest.toFixed(1)} degrees between two stretches`);
    expect(s.back > s.depth * 0.2, `the line well back from the lure has gone down with it (${spare} m to spare)`, `${s.back.toFixed(2)} m down, the lure ${s.depth.toFixed(2)}`);
  }
  const at = [20, 60, 120].map((fps) => sunk(fps, 0.3).last);
  expect(Math.max(...at) - Math.min(...at) < 1.5, 'the same at 20, 60 and 120 frames a second', at.map((a) => a.toFixed(1)).join(' / '));
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
    // A fish swinging round can leave the line really slack for a moment, and the last of
    // real slack closes fast as the fish takes it up: that is the 20-odd centimetres.
    expect(worst < 0.3, `${name}: no point of the line moves much more in a frame than its ends do`, `${(worst * 100).toFixed(0)} cm at ${at}`);
  }
});

check('line: a fish draws it straight in a moment, and with a fish on it stays straight, wound or not', () => {
  // It used to take over two seconds to draw straight, with the rod already bent by the fish.
  const N = 49;
  for (const [size, press, fps] of [[0.85, 'always', 60], [1.3, 'rests', 60], [1.3, 'never', 60], [1.3, 'rests', 20]]) {
    const rig = createRig({ seed: 5, fps, press, hold: 0.6, sizes: () => size }); const f = rig.fishing;
    const curve = createLineCurve(N), out = new Float64Array(N * 3); let hooked = -1, loose = 0, soon = 9, bent = 0, frames = 0, saw = 0;
    while (rig.time < 45) {
      rig.step(); const l = rig.line; if (l.stowed !== null) { curve.reset(); continue; }
      curve.step(rig.dt, l.tip.x, l.tip.y, l.tip.z, l.end.x, l.end.y, l.end.z, l.length, l.tied ? l.tension : 0, out, 0);
      let far = 0; const ux = l.end.x - l.tip.x, uy = l.end.y - l.tip.y, uz = l.end.z - l.tip.z, g2 = ux * ux + uy * uy + uz * uz;
      for (let i = 1; i < N - 1; i += 1) { const px = out[i * 3] - l.tip.x, py = out[i * 3 + 1] - l.tip.y, pz = out[i * 3 + 2] - l.tip.z; const t = (px * ux + py * uy + pz * uz) / g2; far = Math.max(far, Math.hypot(px - ux * t, py - uy * t, pz - uz * t)); }
      if (f.stage !== 'fight') { if (hooked >= 0) break; loose = far; continue; }
      if (hooked < 0) hooked = rig.time;
      if (rig.time - hooked > 0.4 && rig.time - hooked < 0.8) soon = Math.min(soon, far);
      // How many times the line's bend changes side along its length, up and down.
      let turns = 0, side = 0;
      for (let i = 1; i < N - 1; i += 1) { const ay = out[i * 3 + 1] - out[i * 3 - 2], by = out[i * 3 + 4] - out[i * 3 + 1]; const k = by / Math.hypot(out[i * 3 + 3] - out[i * 3], by, out[i * 3 + 5] - out[i * 3 + 2]) - ay / Math.hypot(out[i * 3] - out[i * 3 - 3], ay, out[i * 3 + 2] - out[i * 3 - 1]); const sgn = Math.abs(k) > 0.004 ? Math.sign(k) : 0; if (sgn && side && sgn !== side) turns += 1; if (sgn) side = sgn; }
      saw = Math.max(saw, turns);
      if (rig.time - hooked > 2) { frames += 1; if (far > 0.05) bent += 1; }
    }
    const who = `size ${size}, finger ${press}, ${fps} fps`;
    expect(hooked >= 0, `${who}: a fish took it`);
    expect(loose > 0.1, `${who}: it lay loose before the bite`, `${loose.toFixed(2)} m off straight`);
    expect(soon < 0.08, `${who}: within half a second or so of the bite it is all but straight`, `${(soon * 100).toFixed(1)} cm`);
    // The rod kicks back at the strike and the line is really slack for a moment. That
    // slack used to go in as a saw's edge: over twenty bends along the line.
    expect(saw <= 8, `${who}: slack coming into it hangs in a belly or two, not a saw's edge`, `${saw} changes of bend along it`);
    // A fish that turns in a run, or comes at the angler, leaves the line slack for a moment. Only for a moment.
    expect(bent / frames < 0.06, `${who}: and for the rest of the fight it is straight all but a few moments`, `${(100 * bent / frames).toFixed(1)}% of the time more than 5 cm off`);
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
    expect(still.beat < 0.05 && jerked.beat > 1, `${fps} fps: it flutters to the jerks and not otherwise`, `${jerked.beat.toFixed(1)} m against ${still.beat.toFixed(3)} m`);
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

check('rod hand: square and still with no effort, laid over toward the side it is carried to, and never dragged round to the fish', () => {
  // The rod's heading, degrees to the right of straight ahead, and where its tip is.
  const heading = (root) => { const a = new THREE.Vector3(0, 1, 0).applyQuaternion(root.getWorldQuaternion(new THREE.Quaternion())); return Math.atan2(a.x, -a.z) / deg; };
  const pose = (side, effort) => {
    const view = new THREE.PerspectiveCamera(); view.position.set(0, 1.7, 0); view.lookAt(0, 1.7 - Math.sin(10 * deg), -Math.cos(10 * deg)); view.updateMatrixWorld(true);
    const root = new THREE.Object3D(); view.add(root); const hold = createRodHold(root, 0.1);
    hold.setPull(new THREE.Vector3(Math.sin(side * deg) * 14, -0.5, -Math.cos(side * deg) * 14));
    let fastest = 0, last = 0;
    for (let i = 0; i < 240; i += 1) {
      hold.setStrain(effort * (1 - Math.exp(-9 * i / 60))); hold.carry(1 / 60);
      const under = new THREE.Vector3(0, 0, 1).applyQuaternion(root.getWorldQuaternion(new THREE.Quaternion()));
      const roll = Math.atan2(under.x, -under.y) / deg;
      if (i > 0) fastest = Math.max(fastest, Math.abs(roll - last) * 60);
      last = roll;
    }
    return { roll: last, fastest, heading: heading(root), tip: new THREE.Vector3(0, 2.13, 0).applyMatrix4(root.matrixWorld) };
  };
  const idle = pose(25, 0), right = pose(25, 0.5), left = pose(-25, 0.5), ahead = pose(-4, 0.5), hard = pose(25, 0.95);
  expect(idle.fastest === 0, 'no effort, no movement at all', idle.fastest);
  expect(right.roll - idle.roll > 15, 'fish to the right: the reel swings out to the right', (right.roll - idle.roll).toFixed(1));
  expect(left.roll - idle.roll < -15, 'fish to the left: the reel swings out to the left', (left.roll - idle.roll).toFixed(1));
  expect(Math.abs(ahead.roll - idle.roll) < 4, 'fish dead ahead of the rod: it sits square', (ahead.roll - idle.roll).toFixed(1));
  expect(right.fastest < 400, 'it rolls over, it does not snap', `${right.fastest.toFixed(0)}°/s`);
  // For half a day the hand was drawn round toward wherever the fish was: a fish darting
  // to one side took the rod and the view with it, with the phone held still.
  expect(Math.abs(hard.heading - idle.heading) < 1.5, 'a hand that is not turning is not dragged round to the fish, however hard it pulls', `${(hard.heading - idle.heading).toFixed(1)}°`);
  expect(hard.tip.distanceTo(idle.tip) < 0.15, 'the working hand moves the tip by centimetres, not more', hard.tip.distanceTo(idle.tip).toFixed(3));
});

check('hand: against a pulling line it falls behind the phone, with it or with no pull it does not, and what it owes goes as the pull goes', () => {
  // The line pulls from 100° round, level with the water. The phone starts aimed there.
  const from = { yaw: 100, pitch: -5 };
  const turn = (fps, force, by, seconds = 0.5, then = null) => {
    const aim = createAim(100, -10); const turned = { yaw: 0, pitch: 0, roll: 0 }; const dt = 1 / fps;
    const pull = () => (force > 0 ? { force, ...from } : null);
    for (let i = 0; i < fps; i += 1) aim.step(turned, true, dt, null, null, pull());
    const n = Math.round(seconds * fps);
    for (let i = 0; i < n; i += 1) { turned.yaw += by / n; aim.step(turned, true, dt, null, null, pull()); }
    const rod = () => aim.rodYaw + aim.viewYaw - 100;
    const moved = rod();
    if (then) then(aim, turned, dt, rod);
    return { moved, aim, turned, rod };
  };
  expect(Math.abs(turn(60, 0, 30).moved - 30) < 1e-9, 'no pull: the rod goes 1 to 1 with the phone', turn(60, 0, 30).moved);
  const light = turn(60, 1, 30).moved / 30, run = turn(60, 4.5, 30).moved / 30, leant = turn(60, 8.5, 30).moved / 30;
  expect(light > 0.82 && light < 0.97, 'a light pull: nearly all of the turn', light.toFixed(2));
  expect(run > 0.5 && run < 0.72, 'a pull as hard as the reel holds: about 6 parts in 10', run.toFixed(2));
  expect(leant < run - 0.08 && leant > 0.3, 'leant on: less still, and never nothing', leant.toFixed(2));
  // Swung away and then back toward the pull: the way back costs nothing. Nothing more is
  // owed for it, and the rod goes back with the phone, less only what it was making up.
  let back = 0, owedBefore = 0, owedAfter = 0;
  turn(60, 4.5, 30, 0.5, (aim, turned, dt, rod) => { const at = rod(); owedBefore = Math.abs(aim.owedYaw); for (let i = 0; i < 30; i += 1) { turned.yaw -= 10 / 30; aim.step(turned, true, dt, null, null, { force: 4.5, ...from }); } back = at - rod(); owedAfter = Math.abs(aim.owedYaw); });
  expect(owedAfter <= owedBefore && Math.abs(back - (10 - (owedBefore - owedAfter))) < 1e-6, 'turning back with the pull is 1 to 1: nothing more is owed for it', `back ${back.toFixed(2)}°, owed ${owedBefore.toFixed(2)}° then ${owedAfter.toFixed(2)}°`);
  // Never past the phone, and what is owed is made up slowly while the pull holds.
  let after = 0, most = 0;
  const held = turn(60, 4.5, 30, 0.5, (aim, turned, dt, rod) => { for (let i = 0; i < 180; i += 1) { aim.step(turned, true, dt, null, null, { force: 4.5, ...from }); most = Math.max(most, rod()); } after = rod(); });
  expect(after > held.moved + 3 && after < 29.5, 'held still under the pull, it slowly makes up what it owes', `${held.moved.toFixed(1)}° then ${after.toFixed(1)}° of 30° three seconds on`);
  expect(most <= 30 + 1e-9, 'and is never carried past where the phone points', most.toFixed(2));
  // The pull goes: so does the debt, as fast as the pull does.
  let quick = 0, slow = 0;
  turn(60, 4.5, 30, 0.5, (aim, turned, dt, rod) => { for (let i = 0; i < 12; i += 1) aim.step(turned, true, dt, null, null, null); quick = rod(); });
  turn(60, 4.5, 30, 0.5, (aim, turned, dt, rod) => { for (let i = 0; i < 12; i += 1) aim.step(turned, true, dt, null, null, { force: 4.5 * (1 - (i + 1) / 60), ...from }); slow = rod(); });
  expect(quick > 28.5, 'the pull gone at once, the rod is across to the phone in a fifth of a second', quick.toFixed(1));
  expect(slow < quick - 3 && slow > run * 30, 'the pull easing slowly, the rod comes across slowly: it goes by the pull, not by a clock', `${slow.toFixed(1)}° against ${quick.toFixed(1)}°`);
  // A fish darting about a hand that is not turning moves nothing.
  const still = createAim(100, -10); const none = { yaw: 0, pitch: 0, roll: 0 };
  for (let i = 0; i < 240; i += 1) still.step(none, true, 1 / 60, null, null, { force: 6, yaw: 100 + 30 * Math.sin(i / 20), pitch: -5 });
  expect(Math.abs(still.rodYaw) < 1e-9 && Math.abs(still.owedYaw) < 1e-9, 'a fish darting from side to side does not move a rod the phone holds still', still.rodYaw);
  // The same at any frame rate.
  const rates = [20, 60, 120].map((fps) => turn(fps, 4.5, 30).moved);
  expect(Math.max(...rates) - Math.min(...rates) < 0.6, 'the same at 20, 60 and 120 frames a second', rates.map((r) => r.toFixed(2)).join(' / '));
  // The view owes less than the rod: the hand turns 30°, the rod about 18°, the view about 24°.
  const aim = createAim(100, -10); const turned = { yaw: 0, pitch: 0, roll: 0 }; const tipOf = () => ({ yaw: aim.rodYaw + aim.viewYaw, pitch: 10 });
  for (let i = 0; i < 60; i += 1) aim.step(turned, false, 1 / 60, { yaw: 100, pitch: -9 }, tipOf(), { force: 4.5, ...from });
  for (let i = 0; i < 30; i += 1) { turned.yaw += 2; aim.step(turned, false, 1 / 60, { yaw: 100, pitch: -9 }, tipOf(), { force: 4.5, ...from }); }
  for (let i = 0; i < 20; i += 1) aim.step(turned, false, 1 / 60, { yaw: 100, pitch: -9 }, tipOf(), { force: 4.5, ...from });
  const rodAt = aim.rodYaw + aim.viewYaw - 100, viewAt = aim.viewYaw - 100;
  // With nothing owed the view would settle TIP_LEFT short of the tip.
  const free = createAim(100, -10); const t2 = { yaw: 0, pitch: 0, roll: 0 }; const tip2 = () => ({ yaw: free.rodYaw + free.viewYaw, pitch: 10 });
  for (let i = 0; i < 60; i += 1) free.step(t2, false, 1 / 60, { yaw: 100, pitch: -9 }, tip2());
  for (let i = 0; i < 30; i += 1) { t2.yaw += 2; free.step(t2, false, 1 / 60, { yaw: 100, pitch: -9 }, tip2()); }
  for (let i = 0; i < 20; i += 1) free.step(t2, false, 1 / 60, { yaw: 100, pitch: -9 }, tip2());
  const viewFree = free.viewYaw - 100;
  expect(rodAt < 60 * 0.8, 'under the pull the rod is well short of the phone', `${rodAt.toFixed(1)}° of 60°`);
  expect(viewFree - viewAt > 2 && viewFree - viewAt < (60 - rodAt) * 0.8, 'the view falls behind too, but by less than the rod does', `view ${(viewFree - viewAt).toFixed(1)}° behind, rod ${(60 - rodAt).toFixed(1)}° behind`);
});

check('weight on the line: it comes onto the rod tip through the line, steadily, the same at any frame rate', () => {
  // It used to be put on the tip apart from the line: a weight and a tip reading each
  // other a frame apart on a short stiff line jumped between no tension and a spike.
  const hung = (fps, kg, length) => {
    const flex = createRodFlex({ length: 2.13, nodes: 18, rigidBelow: 0.34 }); const curve = new Float64Array(18 * 3); const e = 17 * 3;
    const butt = { x: 0, y: 1.4, z: 0 }; const axisAt = (lift) => ({ x: 0, y: Math.sin(lift * deg), z: -Math.cos(lift * deg) });
    let axis = axisAt(40); flex.step(1 / fps, butt, axis); flex.shape(axis, curve); const bare = butt.y + curve[e + 1];
    const m = createLureMove(); m.weigh(kg, 1, -1, -0.9); m.place(butt.x + curve[e], bare - length, butt.z + curve[e + 2]);
    const k = Math.min(60, 120 / length); let low = 99, high = 0, sum = 0, n = 0, tip = 0, lifted = 0;
    for (let i = 0; i < fps * 7; i += 1) {
      const t = i / fps; axis = axisAt(40 + 20 * Math.min(1, Math.max(0, (t - 3) / 0.4)));
      flex.setTipTether(m.x, m.y, m.z, length, k); flex.step(1 / fps, butt, axis, m); flex.shape(axis, curve);
      expect(Number.isFinite(flex.tension + m.y), 'nothing goes NaN');
      if (t > 2 && t < 3) { low = Math.min(low, flex.tension); high = Math.max(high, flex.tension); sum += flex.tension; n += 1; tip = butt.y + curve[e + 1]; }
      if (t > 3) lifted = Math.max(lifted, flex.tension);
    }
    return { mean: sum / n, low, high, tip, bare, lifted, ends: flex.tension };
  };
  for (const [kg, length] of [[0.01, 0.025], [0.11, 0.6], [0.36, 0.6], [0.36, 2]]) {
    const at = [20, 60, 120].map((fps) => hung(fps, kg, length)); const weight = kg * 9.81;
    for (const r of at) {
      expect(Math.abs(r.mean - weight) < 0.02 * weight + 0.002, `${kg} kg on ${length} m: hanging still, the line pulls with its weight`, `${r.mean.toFixed(3)} N for ${weight.toFixed(3)} N`);
      expect(r.high - r.low < 0.1 * weight + 0.01, `${kg} kg on ${length} m: and steadily, not in spikes`, `${r.low.toFixed(3)} to ${r.high.toFixed(3)} N`);
      expect(r.lifted < 4 * weight + 2 && Math.abs(r.ends - weight) < 0.1 * weight + 0.02, `${kg} kg on ${length} m: a quick lift loads it up and it settles back to its weight`, `${r.lifted.toFixed(2)} N in the lift, ${r.ends.toFixed(3)} N after`);
    }
    expect(Math.max(...at.map((r) => r.tip)) - Math.min(...at.map((r) => r.tip)) < 0.005, `${kg} kg on ${length} m: the tip sits at the same height at 20, 60 and 120 frames`, at.map((r) => r.tip.toFixed(3)).join(' / '));
    if (kg > 0.3) expect(at[1].bare - at[1].tip > 0.2, 'a third of a kilo pulls the tip well down', `${(at[1].bare - at[1].tip).toFixed(2)} m`);
  }
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
      for (const seed of [1, 2, 3, 4, 5, 6]) {
        const r = fightOne({ seed, fps, press: 'rests', size });
        expect(r.end === 'landed', `size ${size}, ${fps} fps, seed ${seed}: landed`, r.end || 'still on the line');
        expect(r.maxTension < RUN_OUT_AT + 3.2, `size ${size}: unpressed, the tension stays near the point where line runs out`, r.maxTension.toFixed(1));
        // Leaving the tip its nose swings round at about 950°/s. A flip of its back, the
        // fault this guards against, was half a turn in one frame: over 3000°/s.
        expect(r.lureTurn < 1400, `size ${size}, ${fps} fps, seed ${seed}: the lure never flips over`, `${r.lureTurn.toFixed(0)}°/s`);
        expect(r.tipFast < 6, `size ${size}: the rod tip never jumps`, `${r.tipFast.toFixed(1)} m/s`);
        // It pulls less than the reel holds. But tearing about at twice the old speed it comes up hard against the line as it turns, and each time the reel gives a little: under 2 m in a fight before, now up to about 4.
        if (size < 1) expect(r.given < 6, `size ${size}: a small fish takes line only in snatches, a few metres in a whole fight`, `${r.given.toFixed(1)} m`);
        else expect(r.given > 2, `size ${size}: a big fish takes line`, `${r.given.toFixed(1)} m`);
        times[fps].push(r.fightFor);
      }
    }
    const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
    // A fight is a handful of runs and rests now, and one more or one fewer is a good part of it.
    expect(Math.abs(mean(times[60]) - mean(times[20])) < 0.4 * mean(times[60]), `size ${size}: the fight takes about as long at 20 frames as at 60`, `${mean(times[60]).toFixed(0)} s and ${mean(times[20]).toFixed(0)} s`);
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
  // One of the casts in five on which the biggest fish, leant on all the way, breaks the line.
  let hidden = 0, frames = 0, came = 0, jump = 0, lastOut = 0, lost = false, woundWhileHeld = 0, lostAt = 0;
  const r = fightOne({ seed: 8, fps: 60, press: 'always', size: 1.4, each: (rig) => {
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
    // The hand holds what the line pulls: a lure towed in or hanging from the tip is next to nothing.
    expect(rig.strain < 0.12, 'with no fish the hand hardly works', rig.strain.toFixed(3));
  }
});

check('landed fish: lifted clear, the line holds its weight and no more, and coming off the hook it does not fling the lure', () => {
  for (const [size, fps] of [[0.78, 60], [1.4, 60], [1.4, 20]]) {
    const load = fishOf('dorade', size).load * 9.81; const held = []; let at = -1, dropped = -1, lureUp = -9;
    fightOne({ seed: 3, fps, press: 'rests', size, each: (rig) => {
      const f = rig.fishing; if (f.stage !== 'landed') { if (at >= 0 && dropped < 0) dropped = rig.time; if (dropped >= 0 && rig.time - dropped < 1.5) lureUp = Math.max(lureUp, f.lure.y - rig.line.tip.y); return; }
      if (at < 0) at = rig.time;
      // Hanging under the tip with the line wound to its shortest, before the net takes it.
      if (rig.line.length < 0.61 && f.lure.kg > 0.9 * load / 9.81) held.push(rig.line.tension);
      if (f.lure.kg < 0.9 * load / 9.81) lureUp = Math.max(lureUp, f.lure.y - rig.line.tip.y);
    } });
    const mean = held.reduce((a, b) => a + b, 0) / held.length;
    expect(held.length > fps * 0.3, `size ${size}, ${fps} fps: it hung under the tip a while`, held.length);
    expect(Math.abs(mean - load) < 0.2 * load, `size ${size}, ${fps} fps: the line pulls with the fish's weight`, `${mean.toFixed(2)} N for ${load.toFixed(2)} N`);
    expect(lureUp < -0.2, `size ${size}, ${fps} fps: with the fish off it, the lure stays hanging well below the tip`, `${lureUp.toFixed(2)} m`);
  }
});

check('camera: lifted out of the water the fish and the rod are both kept in the picture, and the view still turns with the rod', () => {
  // The view used to be handed back to the phone the moment the fish came to hand.
  for (const turn of [0, 35]) {
    let seen = 0, off = 0, rodKept = true, since = -1, follows = 0;
    fightOne({ seed: 3, fps: 60, press: 'rests', size: 1.3, each: (rig) => {
      const f = rig.fishing; if (f.stage !== 'landed') return;
      if (since < 0) since = rig.time;
      // Part way through the lift the phone carries the rod round to one side.
      rig.rodStays = true; rig.rodTurn = rig.time - since > 2 ? turn * deg : 0;
      if (!f.watch) return; seen += 1; rodKept = rodKept && f.watchRod;
      if (rig.time - since > 4) { off = Math.max(off, Math.hypot(f.watch.x - f.lure.x, f.watch.y - f.lure.y, f.watch.z - f.lure.z)); follows = wrap(Math.atan2(f.watch.x - 0, f.watch.z - 2) - 100 * deg) / deg; }
    } });
    expect(seen > 120 && rodKept, `rod turned ${turn}°: all through the lift the view has the fish to watch and the rod to keep`, seen);
    expect(off < 0.6, `rod turned ${turn}°: what it watches stays with the fish on the hook`, `${off.toFixed(2)} m from it`);
    if (turn) expect(follows > 8, 'carried round by the rod, the fish takes the view with it', `${follows.toFixed(0)}° round`);
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

check("fight: where it runs is its own business, what comes of it is the line's, and it sets off the way its head points", () => {
  // Which way a running fish is travelling: out along the line, or across it.
  const travel = (opts, turn = 0, givingLine = false) => {
    let out = 0, across = 0, total = 0, worst = 0, left = 0, sided = 0;
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      let lx = null, lz = 0;
      fightOne({ seed, fps: 60, ...opts, each: (rig) => {
        const f = rig.fishing; if (f.stage !== 'fight') { lx = null; return; }
        if (turn) { rig.rodStays = true; rig.rodTurn = turn * deg; }
        const e = rig.line.end, tip = rig.line.tip; const radial = Math.atan2(e.x - tip.x, e.z - tip.z);
        worst = Math.max(worst, Math.abs(wrap(radial - 100 * deg)) / deg);
        if (lx !== null && f.mood === 'run' && (!givingLine || f.running > 1)) {
          const vx = (e.x - lx) * 60, vz = (e.z - lz) * 60;
          if (Math.hypot(vx, vz) > 0.6) { const a = wrap(Math.atan2(vx, vz) - radial) / deg; total += 1; if (Math.abs(a) < 45) out += 1; else if (Math.abs(a) < 135) { across += 1; sided += 1; if (a > 0) left += 1; } }
        }
        lx = e.x; lz = e.z;
      } });
    }
    return { out: out / total, across: across / total, worst, left: left / sided };
  };
  // A big fish let run takes line, and while the reel is giving it a metre a second or more it goes mostly out. A small one the reel holds cannot: it goes round.
  const taking = travel({ press: 'never', size: 1.4, seconds: 40 }, 0, true), heldIn = travel({ press: 'rests', size: 0.85 });
  // It used to go mostly out. It takes line more slowly now and tears about across it as well.
  expect(taking.out > 0.1 && taking.across > 0.3, 'taking line, it goes out and away as well as across', `${(100 * taking.out).toFixed(0)}% out, ${(100 * taking.across).toFixed(0)}% across`);
  // It used to be held to a third of its speed across whenever the line would not give.
  expect(heldIn.across > 0.6, 'held by a line that will not give, it goes round the arc the line allows', `${(100 * heldIn.across).toFixed(0)}% across`);
  expect(taking.worst < 50 && heldIn.worst < 50, 'and either way it stays in front of the angler', `${taking.worst.toFixed(0)}° and ${heldIn.worst.toFixed(0)}° off the cast line`);
  // A run sets off the way its head points, more often than not and not always. Asked of the course itself.
  // It used to go by where the rod was, away from it: a rod left to one side sent it the same way every run.
  const sets = (head) => { const draws = seeded(31); let left = 0; for (let i = 0; i < 2000; i += 1) { const c = createCourse(draws); c.hooked(); c.begin(head, 0.5, 1); if (c.across(true, 1, 1, 99) > 0) left += 1; } return left / 2000; };
  const headLeft = sets(0.8), headRight = sets(-0.8), ahead = sets(0);
  expect(headLeft > 0.7 && headRight < 0.3, 'with its head to the left it sets off left, to the right right', `left ${(100 * headLeft).toFixed(0)}% and ${(100 * headRight).toFixed(0)}% of the time`);
  expect(headLeft < 0.92 && headRight > 0.08, 'more often, not always: where it goes is still its own', `${(100 * headLeft).toFixed(0)}% and ${(100 * headRight).toFixed(0)}%`);
  expect(Math.abs(ahead - 0.5) < 0.06 && sets(0.1) > ahead + 0.03 && sets(0.1) < headLeft - 0.1, 'head on to the rod it goes either way, and a head a little to one side leads it a little', `${(100 * ahead).toFixed(0)}% dead ahead, ${(100 * sets(0.1)).toFixed(0)}% a little to the left`);
  // And well round to one side of its own place, it heads back more often than on.
  const back = (() => { const draws = seeded(32); let n = 0; for (let i = 0; i < 2000; i += 1) { const c = createCourse(draws); c.hooked(); c.keepInFront(30 * deg); c.begin(0, 0.5, 1); if (c.across(true, 1, 1, 99) < 0) n += 1; } return n / 2000; })();
  expect(back > 0.6 && back < 0.95, 'far round to the left it turns back right more often than not', `${(100 * back).toFixed(0)}%`);
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

check('wake: it is as strong as the thing is fast, points the way it goes, and nobody turns it on', () => {
  // Led along the surface at a steady speed for long enough to settle.
  const led = (speed, fps, share = 1) => {
    const w = createWakeTrack(32, seeded(5)); const dt = 1 / fps; let thrown = 0;
    for (let t = 0; t < 3; t += dt) { w.follow(dt, 2 + speed * t * 0.6, -5 + speed * t * 0.8, share); thrown = Math.max(thrown, w.drops.filter((d) => d.left > 0).length); }
    return { w, thrown, dt };
  };
  const slow = led(0.2, 60);
  expect(slow.w.strength < 0.01 && slow.thrown === 0, 'too slow to cut the water, there is no wake and no spray', `${slow.w.strength.toFixed(3)} / ${slow.thrown}`);
  const mid = led(0.9, 60);
  expect(mid.w.strength > 0.15 && mid.w.strength < 0.5 && mid.thrown === 0, 'a middling speed makes a wake but throws no spray', `${mid.w.strength.toFixed(2)} / ${mid.thrown}`);
  const fast = led(3, 60);
  expect(fast.w.strength > 0.95 && fast.thrown > 3, 'fast, the wake is full and it throws spray', `${fast.w.strength.toFixed(2)} / ${fast.thrown}`);
  expect(Math.abs(fast.w.dirX - 0.6) < 0.01 && Math.abs(fast.w.dirZ - 0.8) < 0.01, 'it points the way the thing is going', `${fast.w.dirX.toFixed(2)}, ${fast.w.dirZ.toFixed(2)}`);
  expect(led(3, 60, 0.25).w.strength < 0.27, 'a thing deep down makes only its share of it');
  // The same at any frame rate.
  const coarse = led(1.5, 20), fine = led(1.5, 120);
  expect(Math.abs(coarse.w.speed - 1.5) < 0.05 && Math.abs(fine.w.speed - 1.5) < 0.05, 'the speed it reads is the speed, at 20 and at 120 frames a second', `${coarse.w.speed.toFixed(2)} / ${fine.w.speed.toFixed(2)}`);
  expect(Math.abs(coarse.w.strength - fine.w.strength) < 0.02, 'and the wake is as strong', `${coarse.w.strength.toFixed(2)} / ${fine.w.strength.toFixed(2)}`);
  // Stopped, it dies away by itself; lifted off the surface, the same.
  for (let t = 0; t < 2.5; t += fast.dt) fast.w.follow(fast.dt, fast.w.x, fast.w.z);
  expect(fast.w.strength < 0.01, 'stopped, it has died away', fast.w.strength.toFixed(3));
  const up = led(3, 60).w;
  for (let t = 0; t < 2.5; t += 1 / 60) up.lift(1 / 60);
  expect(up.strength < 0.01 && up.drops.every((d) => !(d.left > 0)), 'off the surface, it and its spray are gone');
});

check('wake: a fish churns the water only while it is being fought, and not from deep down', () => {
  for (const size of [0.85, 1.3]) {
    let before = 0, deep = 0, most = 0, after = 0, landedAt = -1;
    const r = fightOne({ seed: 3, fps: 60, press: 'rests', size, seconds: 120, each: (rig) => {
      const f = rig.fishing; const c = rig.churn;
      const drops = c.drops.filter((d) => d.left > 0).length;
      if (f.stage === 'fight') { most = Math.max(most, c.strength); if (f.lure.y < -2.2) deep = Math.max(deep, c.strength); }
      else if (landedAt < 0 && f.stage !== 'landed') before = Math.max(before, c.strength + drops);
      if (f.stage === 'landed' && landedAt < 0) landedAt = rig.time;
      if (landedAt >= 0 && rig.time > landedAt + 2.5) after = Math.max(after, c.strength + drops);
    } });
    expect(r.sawFight, `size ${size}: there was a fight`);
    expect(before === 0, `size ${size}: nothing before a fish is on`, before.toFixed(3));
    expect(most > 0.05, `size ${size}: fought near the top, it shows`, most.toFixed(2));
    // It dives faster now, and what it churned up near the top is still fading as it goes through two metres.
    expect(deep < 0.09, `size ${size}: from more than two metres down it does not`, deep.toFixed(3));
    expect(after < 0.01, `size ${size}: out of the water it is gone`, after.toFixed(3));
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
