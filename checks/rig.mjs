/**
 * A whole cast in Node: the real play layer, the real school and the real rod (grip and
 * bend), with stand-ins for what only draws: the line's strand, the lure's model, the
 * splash, the net, the haptics.
 *
 * Owns: building that, stepping it in the order startShore.js does, and a scripted
 * finger. Does not own: any check. check.mjs and record.mjs use it.
 * SRC picks another copy of src/ to run, for comparing before and after.
 *
 * Why it is here: only the rules can be run without a phone, and a change to one part of
 * a cast has more than once broken the part after it. docs/CONVENTIONS.md section 7.
 */
const SRC = process.env.SRC || new URL('../src', import.meta.url).pathname;
const { createFishing } = await import(`${SRC}/play/fishing.js`);
const { createWakeTrack } = await import(`${SRC}/shore/wakeTrack.js`);
const { createFlock } = await import(`${SRC}/fish/flock.js`);
const { createRodFlex } = await import(`${SRC}/shore/rodFlex.js`);
const { createRodHold } = await import(`${SRC}/shore/rodHold.js`);
const THREE = await import('three/webgpu');
// The line's stiffness, as line.js has it. An older copy of src/ does not say: its numbers.
const { STRETCH_FORCE = 120, STIFFEST = 60 } = await import(`${SRC}/shore/line.js`);

// x, z, scale and how high each stands (world y of its top), as the page has them: the
// tops were read off the running scene on 2026-11-24, with the sea 5.5 m deep.
const ROCKS = [[2.6, 22.5, 2.3, 0.75], [-4.6, 25, 1.7, 0.41], [4.5, 15.5, 1.3, -2.97], [-5.5, 12, 1.5, -3.07], [8, 6, 1.8, -3.92], [-9, 19, 1.4, -1.81], [-1.8, 17.5, 1.1, -2.62], [2.2, 13, 1.3, -3.33], [6, 19.5, 1.5, -2.19], [-3.5, 8, 1.4, -4.24], [0.4, 15.2, 1.6, -3.09]].map(([x, z, s, top]) => ({ x, z, r: s * 0.72, top }));
const deg = Math.PI / 180;
const NODES = 18;

export function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * seed: for the school and the draws. fps: frames a second.
 * press: what the finger does with a fish on: 'always', 'rests' (only while it rests),
 * 'runs' (only while it runs) or 'never'.
 * hold: seconds the cast is held (the desk stand-in for a swing: 1 is a full one).
 * lift: degrees the rod is raised. sizes(i, size): the body scale of fish i, to make
 * every fish one size. noSchool: no fish at all. random: the play layer's draws, to
 * force one. sensor: the cast reads the rod's swing, as on a phone, and not how long the
 * finger was held.
 */
export function createRig({ seed = 1, fps = 60, press = 'always', hold = 0.6, lift = 20, sizes = null, noSchool = false, random: forced = null, sensor = false, spool }) {
  const random = forced || seeded(seed);
  Math.random = seeded(seed * 7919 + 13);
  const tune = { x: 0, y: 1.7, z: 2, yaw: 100, pitch: -10 };
  const fishes = [];
  for (let i = 0; i < 40; i += 1) {
    fishes.push({ holder: { position: { set() {} }, rotation: {}, scale: { setScalar() {} } }, action: { getClip: () => ({ duration: 4 }), time: 0 } });
  }
  const flock = createFlock(fishes, { bodyLength: 0.45 });
  flock.place(tune);
  if (sizes) fishes.forEach((f, i) => { f.size = sizes(i, f.size); });
  const school = { fishes, take: flock.take, giveBack: flock.giveBack, mouth: flock.mouth, hang: flock.hang, keep: flock.keep };

  // The rod: grip fixed in front of the eye, turned to wherever the view looks.
  const flex = createRodFlex({ length: 2.13, nodes: NODES, rigidBelow: 0.34 });
  const curve = new Float64Array(NODES * 3);
  let viewYaw = tune.yaw * deg;
  const butt = { x: 0, y: 0, z: 0 };
  const axis = { x: 0, y: 1, z: 0 };
  let tether = null;
  // What the tether is tied to, when that is a weight hanging on the line.
  let rider = null;
  const riderSpeed = new THREE.Vector3();
  const events = [];
  let strain = 0;
  const rodState = { wound: 0, load: 0 };
  // The real grip: the rod's root under a camera placed as startShore places it.
  const camera = new THREE.PerspectiveCamera(55, 390 / 844, 0.05, 100);
  const root = new THREE.Object3D();
  camera.add(root);
  function look() {
    const pitch = tune.pitch * deg;
    camera.up.set(0, 1, 0);
    camera.position.set(tune.x, tune.y, tune.z);
    camera.lookAt(tune.x + Math.sin(viewYaw) * Math.cos(pitch), tune.y + Math.sin(pitch), tune.z + Math.cos(viewYaw) * Math.cos(pitch));
    camera.updateMatrixWorld(true);
  }
  look();
  const grip = createRodHold(root, 0.1);
  // ROD_POSE lifts the rod 30 degrees off the view, which looks 10 down.
  grip.setAim(lift - 20, 0, 0);
  const tetherWorld = new THREE.Vector3();
  const tetherBend = new THREE.Vector3();
  const invQ = new THREE.Quaternion();
  const node = new THREE.Vector3();
  const tipNow = { x: 0, y: 0, z: 0 };
  const rod = {
    reel: { wind(m) { rodState.wound += m; } },
    setTipLoad(kg) { rodState.load = kg; flex.setTipLoad(kg); },
    setStrain(v) { strain = v; grip.setStrain(v); },
    setTipTether(point, length, stiffness, weight = null) {
      tether = point ? { x: point.x, y: point.y, z: point.z, length, stiffness } : null;
      rider = point ? weight : null;
    },
    get tipTension() { return flex.tension; },
    update(dt) {
      look();
      // As aim.js does without a phone turning: the rod keeps pointing where the aim is,
      // whatever the view has turned to.
      if (rig.rodStays) grip.setAim(lift - 20, (tune.yaw * deg + (rig.rodTurn || 0) - viewYaw) / deg, 0);
      if (rider) tetherWorld.set(rider.x, rider.y, rider.z);
      else if (tether) tetherWorld.set(tether.x, tether.y, tether.z);
      grip.setPull(tether ? tetherWorld : null);
      grip.carry(dt);
      if (tether) {
        grip.intoBend(tetherWorld, tetherBend);
        flex.setTipTether(tetherBend.x, tetherBend.y, tetherBend.z, tether.length, tether.stiffness);
      } else flex.clearTipTether();
      if (rider) {
        // As rod.js does it: the weight is moved in the bend's frame, with the blank.
        grip.turnIntoBend(riderSpeed.set(rider.vx, rider.vy, rider.vz));
        rider.x = tetherBend.x; rider.y = tetherBend.y; rider.z = tetherBend.z;
        rider.vx = riderSpeed.x; rider.vy = riderSpeed.y; rider.vz = riderSpeed.z;
        flex.step(dt, grip.grip.butt, grip.grip.axis, rider);
        grip.outOfBend(tetherBend.set(rider.x, rider.y, rider.z), tetherWorld);
        grip.turnOutOfBend(riderSpeed.set(rider.vx, rider.vy, rider.vz));
        rider.x = tetherWorld.x; rider.y = tetherWorld.y; rider.z = tetherWorld.z;
        rider.vx = riderSpeed.x; rider.vy = riderSpeed.y; rider.vz = riderSpeed.z;
      } else flex.step(dt, grip.grip.butt, grip.grip.axis);
      flex.shape(grip.grip.axis, curve);
      axis.x = grip.grip.axis.x; axis.y = grip.grip.axis.y; axis.z = grip.grip.axis.z;
      const e = (NODES - 1) * 3;
      invQ.copy(grip.grip.quaternion).invert();
      node.set(curve[e], curve[e + 1], curve[e + 2]).applyQuaternion(invQ).applyMatrix4(root.matrixWorld);
      tipNow.x = node.x; tipNow.y = node.y; tipNow.z = node.z;
    },
    // How far the tip section has turned off the grip, degrees.
    get tipTurn() {
      const e = (NODES - 1) * 3;
      const sx = curve[e] - curve[e - 3], sy = curve[e + 1] - curve[e - 2], sz = curve[e + 2] - curve[e - 1];
      const c = (sx * axis.x + sy * axis.y + sz * axis.z) / Math.hypot(sx, sy, sz);
      return Math.acos(Math.min(1, c)) / deg;
    },
  };
  // The line, as line.js does it, without the drawing.
  const line = {
    tip: { x: 0, y: 0, z: 0 },
    end: { x: 0, y: 0, z: 0 },
    length: 0,
    tied: true,
    stowed: null,
    get tension() { return rod.tipTension; },
    get stiffness() { return Math.min(STIFFEST, STRETCH_FORCE / Math.max(line.length, 1e-3)); },
    setTied(yes) { line.tied = yes; },
    carried: null,
    setEnd(x, y, z) { line.end.x = x; line.end.y = y; line.end.z = z; line.stowed = null; line.carried = null; },
    carry(weight) { line.carried = weight; line.stowed = null; },
    stow(drop) { line.stowed = drop; line.carried = null; },
    setLength(m) { line.length = Math.max(0, m); },
    update() {
      line.tip.x = tipNow.x; line.tip.y = tipNow.y; line.tip.z = tipNow.z;
      if (line.carried) { line.end.x = line.carried.x; line.end.y = line.carried.y; line.end.z = line.carried.z; }
      if (line.stowed !== null) {
        line.end.x = tipNow.x; line.end.y = tipNow.y - line.stowed; line.end.z = tipNow.z;
        line.length = line.stowed;
      }
    },
    // Before the rod moves, as line.js does it.
    brace() {
      if (line.tied && line.stowed === null) rod.setTipTether(line.carried || line.end, line.length, line.stiffness, line.carried);
      else rod.setTipTether(null);
    },
  };
  const lureSeen = { visible: true };
  const lure = { place() {}, show(yes) { lureSeen.visible = yes; } };
  const splash = { burst(x, z, s) { events.push({ t: time, kind: 'splash', s }); } };
  const net = { place() {}, hide() {} };
  const haptics = {
    impact(style) { events.push({ t: time, kind: 'impact', style }); },
    notification(type) { events.push({ t: time, kind: 'notify', type }); },
    playTransient(intensity, sharpness) { events.push({ t: time, kind: 'tick', intensity, sharpness }); },
  };
  // The real reading of a fish churning the water; only the drawing is left out.
  const churn = createWakeTrack(48, seeded(seed + 77));
  const fishing = createFishing({ rod, line, lure, splash, churn, school: noSchool ? null : school, net, haptics, random, spool });
  const input = { finger: false, sensor, viewYaw, viewPitch: tune.pitch };
  let time = 0;
  let frame = 0;
  let begun = false;
  let castHeld = 0;
  let waterFor = 0;
  const dt = 1 / fps;
  const cam = { x: tune.x, z: tune.z, yaw: viewYaw, fov: 55, aspect: 390 / 844 };

  const rig = {
    fishing, flock, fishes, rod, line, churn, events, rodState, lureSeen, dt,
    // The rod raised d degrees: the phone aims it 30 below that, as ROD_POSE mounts it.
    setLift(d) { grip.setAim(d - 20, 0, 0); },
    get time() { return time; },
    get strain() { return strain; },
    get tipTurn() { return rod.tipTurn; },
    // What the finger does. Replace to script it.
    finger() {
      const stage = fishing.stage;
      if (stage === 'ready') {
        castHeld += dt;
        return castHeld > 0.3 && castHeld < 0.3 + hold;
      }
      if (stage === 'flight') return false;
      if (stage === 'water') {
        castHeld = 0;
        waterFor += dt;
        // Empty line after a loss, or the lure left in the water: wind only when told.
        return rig.windWater ? waterFor > 0.5 : false;
      }
      waterFor = 0;
      if (stage === 'landed') return true;
      if (press === 'always') return true;
      if (press === 'never') return false;
      if (press === 'rests') return fishing.mood === 'rest';
      if (press === 'runs') return fishing.mood === 'run';
      return false;
    },
    windWater: false,
    rodStays: false,
    get viewYaw() { return viewYaw; },
    // The tip against a straight rod: metres to the rod's right (seen from behind it), and metres down.
    tipSide() { const e = (NODES - 1) * 3; const dx = curve[e] - axis.x * 2.13, dz = curve[e + 2] - axis.z * 2.13; const h = Math.hypot(axis.x, axis.z); return (dx * -axis.z + dz * axis.x) / h * -1; },
    tipDown() { const e = (NODES - 1) * 3; return -(curve[e + 1] - axis.y * 2.13); },
    get axis() { return axis; },
    step() {
      flock.step(dt, 1, ROCKS, cam);
      input.finger = rig.finger();
      input.viewYaw = viewYaw;
      // How high the view is said to look, for where a cast is thrown. The rig's own
      // camera stays as it is.
      if (rig.viewPitch !== undefined) input.viewPitch = rig.viewPitch;
      if (begun) fishing.update(dt, input);
      // The view turns to what the cast wants watched, as aim.js would, simply.
      const watch = begun && fishing.watch;
      if (watch) {
        const want = Math.atan2(watch.x - tune.x, watch.z - tune.z);
        let d = want - viewYaw;
        while (d > Math.PI) d -= 2 * Math.PI;
        while (d < -Math.PI) d += 2 * Math.PI;
        viewYaw += d * (1 - Math.exp(-3 * dt));
      }
      line.brace();
      rod.update(dt);
      line.update();
      if (begun) fishing.follow();
      else { fishing.begin(); begun = true; }
      time += dt;
      frame += 1;
    },
  };
  return rig;
}
