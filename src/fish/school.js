import { loadDorade, createDoradePool } from './dorade.js';

const CORE_COUNT = 20;
const ROAM_COUNT = 20;

// Rules: docs/FISH-SCHOOL.md
export async function createShoreSchool(scene) {
  const stale = [];
  scene.traverse((o) => { if (o.name === 'dorade') stale.push(o); });
  for (const o of stale) o.removeFromParent();
  const template = await loadDorade(0.45);
  const pool = createDoradePool(template, CORE_COUNT + ROAM_COUNT);
  const school = [];
  for (let i = 0; i < CORE_COUNT + ROAM_COUNT; i++) {
    const fish = pool.acquire();
    fish.roam = i >= CORE_COUNT;
    scene.add(fish.holder);
    school.push(fish);
  }
  const shoal = blankShoal();
  return {
    place(tune) { placeShoal(school, tune, shoal); },
    update(dt, rate, rocks, cam) {
      swimShoal(school, shoal, dt, rate, rocks, cam);
      const tail = rate * shoal.clipScale / shoal.metresPerSecond;
      for (const fish of school) {
        fish.action.setEffectiveTimeScale(tail * fish.speed);
        fish.mixer.update(dt);
      }
    },
  };
}

const DORADE_Y_MIN = -3.75;
const DORADE_Y_MAX = -1.75;

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

function wrapPi(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function beginLevel(swim) {
  swim.vert = 'level';
  swim.vertT = 0;
  swim.vertDur = 8 + Math.random() * 17;
  swim.depth = clamp(swim.y, DORADE_Y_MIN, DORADE_Y_MAX);
  swim.y = swim.depth;
}

function beginStep(swim) {
  const big = Math.random() < 0.22;
  const span = big ? 0.8 + Math.random() * 0.5 : 0.28 + Math.random() * 0.4;
  const sign = Math.random() < 0.5 ? -1 : 1;
  swim.y0 = swim.y;
  swim.y1 = clamp(swim.y + sign * span, DORADE_Y_MIN, DORADE_Y_MAX);
  if (Math.abs(swim.y1 - swim.y0) < 0.12) {
    swim.y1 = clamp(swim.y0 + (swim.y0 > -2.7 ? -0.45 : 0.45), DORADE_Y_MIN, DORADE_Y_MAX);
  }
  swim.depth = swim.y1;
  swim.vert = 'step';
  swim.vertT = 0;
  const dy = Math.abs(swim.y1 - swim.y0);
  swim.vertDur = clamp(dy / 0.28, 1.6, 4.2);
}

function beginSearch(swim) {
  swim.vert = 'search';
  swim.vertT = 0;
  swim.vertDur = 9 + Math.random() * 6;
  const room = Math.min(swim.y - DORADE_Y_MIN, DORADE_Y_MAX - swim.y);
  swim.depth = swim.y;
  swim.y0 = Math.min(0.45 + Math.random() * 0.25, Math.max(0.12, room * 0.85));
  swim.searchW = 0.7 + Math.random() * 0.35;
}

function nextVert(swim) {
  if (Math.random() < 0.16) beginSearch(swim);
  else beginStep(swim);
}

const SCHOOL_GAP = 0.62;

function blankShoal() {
  return {
    homeX: 0,
    homeZ: 0,
    camX: 0,
    camZ: 2,
    camYaw: (100 * Math.PI) / 180,
    camFov: 55,
    camAspect: 390 / 844,
    x: 0,
    z: 0,
    y: -2.7,
    yaw: 0,
    yawRate: 0,
    wishYawRate: 0,
    wishT: 0.6,
    depth: -2.7,
    y0: -2.7,
    y1: -2.7,
    vert: 'level',
    vertT: 0,
    vertDur: 12,
    searchW: 0.8,
    metresPerSecond: 0.351,
    clipScale: 2.2,
    cruiseFor: 14,
    sprintFor: 2.6,
    glideFor: 9,
    sprintTarget: 4.2,
    effort: 1,
    mode: 'cruise',
    stageT: 0,
    pitch: 0,
    speed: 0.351,
    ax: new Float64Array(40),
    az: new Float64Array(40),
    ay: new Float64Array(40),
  };
}

function placeShoal(school, tune, shoal) {
  const yaw = (tune.yaw * Math.PI) / 180;
  const dist = 13;
  shoal.homeX = tune.x + Math.sin(yaw) * dist;
  shoal.homeZ = tune.z + Math.cos(yaw) * dist;
  shoal.x = shoal.homeX;
  shoal.z = shoal.homeZ;
  shoal.y = -2.7;
  shoal.depth = -2.7;
  // +Z is the head. The school crosses the view as one body.
  shoal.yaw = yaw + Math.PI / 2;
  shoal.yawRate = 0;
  const fx = Math.sin(shoal.yaw);
  const fz = Math.cos(shoal.yaw);
  const rx = -fz;
  const rz = fx;
  const spots = [{ along: 0, side: 0, y: 0 }];
  for (let i = 0; i < school.length; i++) {
    const fish = school[i];
    if (i === 0) {
      fish.followAlong = 0;
      fish.followSide = 0;
      fish.followY = 0;
    } else {
      let along = 0.55;
      let side = 0;
      let y = 0;
      for (let n = 0; n < 24; n++) {
        along = 0.4 + Math.random() * 2.2;
        side = (Math.random() - 0.5) * 1.35;
        y = (Math.random() - 0.5) * 0.7;
        const clear = spots.every((p) => {
          const d = Math.hypot(along - p.along, side - p.side, (y - p.y) * 1.4);
          return d > 0.7;
        });
        if (clear) break;
      }
      fish.followAlong = along;
      fish.followSide = side;
      fish.followY = y;
      spots.push({ along, side, y });
    }
    fish.x = shoal.x - fx * fish.followAlong + rx * fish.followSide;
    fish.z = shoal.z - fz * fish.followAlong + rz * fish.followSide;
    fish.y = clamp(shoal.y + fish.followY, DORADE_Y_MIN, DORADE_Y_MAX);
    fish.yaw = shoal.yaw;
    fish.pitch = 0;
    fish.pace = 0.78 + Math.random() * 0.46;
    fish.speed = shoal.metresPerSecond * fish.pace;
    fish.withSchool = true;
    fish.returning = false;
    fish.boutT = fish.roam ? Math.random() * 10 : 0;
    fish.boutDur = fish.roam ? 12 + Math.random() * 14 : 0;
    fish.leaveBias = 0;
    fish.holder.scale.setScalar(0.82 + Math.random() * 0.36);
    const clip = fish.action.getClip();
    fish.action.time = (i / school.length) * (clip.duration || 1);
    fish.holder.position.set(fish.x, fish.y, fish.z);
    fish.holder.rotation.order = 'YXZ';
    fish.holder.rotation.y = fish.yaw;
    fish.holder.rotation.x = 0;
  }
  beginLevel(shoal);
  shoal.vertDur = 10;
}

function advanceShoal(shoal, dt, rate) {
  shoal.stageT += dt;
  let target = 1;
  if (shoal.mode === 'cruise' && shoal.stageT > shoal.cruiseFor) {
    shoal.mode = 'sprint';
    shoal.stageT = 0;
  }
  if (shoal.mode === 'sprint') {
    target = shoal.sprintTarget;
    if (shoal.stageT > shoal.sprintFor) {
      shoal.mode = 'glide';
      shoal.stageT = 0;
    }
  } else if (shoal.mode === 'glide') {
    target = 0.18;
    if (shoal.stageT > shoal.glideFor) {
      shoal.mode = 'cruise';
      shoal.stageT = 0;
    }
  }
  const k = target > shoal.effort ? 1.1 : 0.22;
  shoal.effort += (target - shoal.effort) * (1 - Math.exp(-k * dt));
  shoal.speed = shoal.metresPerSecond * rate * shoal.effort;

  shoal.vertT += dt;
  const yPrev = shoal.y;
  if (shoal.vert === 'level') {
    shoal.y = shoal.depth;
    if (shoal.vertT >= shoal.vertDur) nextVert(shoal);
  } else if (shoal.vert === 'step') {
    const u = clamp(shoal.vertT / shoal.vertDur, 0, 1);
    const s = u * u * (3 - 2 * u);
    shoal.y = shoal.y0 + (shoal.y1 - shoal.y0) * s;
    if (u >= 1) beginLevel(shoal);
  } else {
    shoal.y = clamp(
      shoal.depth + Math.sin(shoal.vertT * shoal.searchW) * shoal.y0,
      DORADE_Y_MIN,
      DORADE_Y_MAX,
    );
    if (shoal.vertT >= shoal.vertDur) beginLevel(shoal);
  }
  const vy = dt > 0 ? (shoal.y - yPrev) / dt : 0;
  const aim = -Math.atan2(vy, Math.max(shoal.speed, 0.04));
  shoal.pitch += (clamp(aim, -0.45, 0.45) - shoal.pitch) * (1 - Math.exp(-4 * dt));

  shoal.wishT -= dt;
  if (shoal.wishT <= 0) {
    shoal.wishT = 1.4 + Math.random() * 1.8;
    shoal.wishYawRate = (Math.random() - 0.5) * 0.55;
  }
  const camYaw = shoal.camYaw;
  const fx = Math.sin(camYaw);
  const fz = Math.cos(camYaw);
  const rx = Math.cos(camYaw);
  const rz = -Math.sin(camYaw);
  const relX = shoal.x - shoal.camX;
  const relZ = shoal.z - shoal.camZ;
  const forward = relX * fx + relZ * fz;
  const side = relX * rx + relZ * rz;
  const halfH = Math.atan(Math.tan((shoal.camFov * Math.PI) / 360) * shoal.camAspect);
  const halfW = Math.max(0.6, forward) * Math.tan(halfH);
  const edge = Math.abs(side) / Math.max(halfW, 0.4);
  const outside = forward < 9 || forward > 18 || edge > 1;
  const nearEdge = edge > 0.6 || forward < 11 || forward > 16;
  const centerX = shoal.camX + fx * 13;
  const centerZ = shoal.camZ + fz * 13;
  const err = wrapPi(Math.atan2(centerX - shoal.x, centerZ - shoal.z) - shoal.yaw);
  const steer = err * (outside ? 2.4 : nearEdge ? 1.15 : 0.2);
  const wish = clamp((outside || nearEdge ? 0 : shoal.wishYawRate) + steer, -1.3, 1.3);
  shoal.yawRate += (wish - shoal.yawRate) * (1 - Math.exp(-1.6 * dt));
  shoal.yaw = wrapPi(shoal.yaw + shoal.yawRate * dt);
}

function rockSteer(x, z, yaw, rocks) {
  let out = yaw;
  for (let i = 0; i < rocks.length; i++) {
    const rock = rocks[i];
    const dx = x - rock.x;
    const dz = z - rock.z;
    const d = Math.hypot(dx, dz) || 1e-4;
    const reach = rock.r + 1.5;
    if (d > reach) continue;
    const nx = dx / d;
    const nz = dz / d;
    const fx = Math.sin(out);
    const fz = Math.cos(out);
    const side = fx * nz - fz * nx;
    const s = side >= 0 ? 1 : -1;
    let tx = -nz * s;
    let tz = nx * s;
    if (tx * fx + tz * fz < 0) {
      tx = -tx;
      tz = -tz;
    }
    const w = clamp((reach - d) / 1.5, 0, 1);
    out = wrapPi(out + wrapPi(Math.atan2(tx, tz) - out) * w);
  }
  return out;
}

function pushOutOfRocks(fish, rocks) {
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < rocks.length; i++) {
      const rock = rocks[i];
      const dx = fish.x - rock.x;
      const dz = fish.z - rock.z;
      const d = Math.hypot(dx, dz) || 1e-4;
      const skin = rock.r + 0.32;
      if (d >= skin) continue;
      fish.x = rock.x + (dx / d) * skin;
      fish.z = rock.z + (dz / d) * skin;
    }
  }
}

function swimShoal(school, shoal, dt, rate, rocks = [], cam = null) {
  if (cam) {
    shoal.camX = cam.x;
    shoal.camZ = cam.z;
    shoal.camYaw = cam.yaw;
    shoal.camFov = cam.fov;
    shoal.camAspect = cam.aspect;
  }
  advanceShoal(shoal, dt, rate);
  const n = school.length;
  const ax = shoal.ax;
  const az = shoal.az;
  const ay = shoal.ay;
  ax.fill(0);
  az.fill(0);
  ay.fill(0);
  for (let i = 0; i < n; i++) {
    const a = school[i];
    for (let j = i + 1; j < n; j++) {
      const b = school[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dz = b.z - a.z;
      const d = Math.hypot(dx, dy, dz);
      if (d >= SCHOOL_GAP || d < 1e-4) continue;
      const push = ((SCHOOL_GAP - d) / d) * shoal.speed * 2.4;
      const px = dx / d * push;
      const py = dy / d * push;
      const pz = dz / d * push;
      ax[i] -= px;
      ay[i] -= py;
      az[i] -= pz;
      ax[j] += px;
      ay[j] += py;
      az[j] += pz;
    }
  }

  let cx = 0;
  let cz = 0;
  let cn = 0;
  for (let i = 0; i < n; i++) {
    const fish = school[i];
    if (fish.roam && !fish.withSchool) continue;
    cx += fish.x;
    cz += fish.z;
    cn += 1;
  }
  cx /= cn || 1;
  cz /= cn || 1;

  for (let i = 0; i < n; i++) {
    const fish = school[i];
    const fx = Math.sin(fish.yaw);
    const fz = Math.cos(fish.yaw);
    const own = shoal.speed * fish.pace;
    let aimSpeed = own;
    let aimYaw = shoal.yaw;
    let aimY = shoal.y + fish.followY;
    fish.pull = 0;
    if (fish.roam && !fish.withSchool) {
      fish.boutT += dt;
      const dx = cx - fish.x;
      const dz = cz - fish.z;
      const dist = Math.hypot(dx, dz);
      const sfx = Math.sin(shoal.yaw);
      const sfz = Math.cos(shoal.yaw);
      const side = (fish.x - cx) * -sfz + (fish.z - cz) * sfx;
      if (dist > 1.8 || Math.abs(side) > 1.15 || fish.boutT > fish.boutDur) fish.returning = true;
      aimYaw = wrapPi(shoal.yaw + (fish.returning ? 0 : fish.leaveBias));
      aimSpeed = own;
      aimY = shoal.y + fish.followY;
      if (fish.returning) fish.pull = 1.3;
      if (fish.returning && dist < 1.15) {
        fish.withSchool = true;
        fish.returning = false;
        fish.pull = 0;
        fish.boutT = 0;
        fish.boutDur = 14 + Math.random() * 16;
      }
    } else {
      if (fish.roam) {
        fish.boutT += dt;
        if (fish.boutT > fish.boutDur) {
          fish.withSchool = false;
          fish.returning = false;
          fish.boutT = 0;
          fish.boutDur = 3.5 + Math.random() * 3;
          fish.leaveBias = (Math.random() < 0.5 ? -1 : 1) * (0.16 + Math.random() * 0.14);
        }
      }
    let nearest = 1e9;
    let aheadSpeed = fish.speed;
    let aheadYaw = shoal.yaw;
    let aheadY = shoal.y + fish.followY;
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      const other = school[j];
      if (other.roam && !other.withSchool) continue;
      const dx = other.x - fish.x;
      const dz = other.z - fish.z;
      const forward = dx * fx + dz * fz;
      if (forward < 0.12) continue;
      const side = Math.abs(-dz * fx + dx * fz);
      if (side > 0.95) continue;
      const d = Math.hypot(dx, dz);
      if (d < nearest && d < 3.2) {
        nearest = forward;
        aheadSpeed = other.speed;
        aheadYaw = other.yaw;
        aheadY = other.y;
      }
    }
    // Own pace is the trend. A fish in front sets the heading. Closing a gap is gradual.
    if (nearest < 3.2) {
      aimYaw = aheadYaw;
      aimY = aheadY + fish.followY * 0.35;
      if (nearest < 0.85) aimSpeed = Math.min(own, aheadSpeed);
      else if (nearest > 1.6) aimSpeed = own * (1 + Math.min(0.45, (nearest - 1.6) * 0.22));
      else aimSpeed = own;
    }
    }
    aimYaw = rockSteer(fish.x, fish.z, aimYaw, rocks);
    const k = aimSpeed > fish.speed ? 0.7 : 0.22;
    fish.speed += (aimSpeed - fish.speed) * (1 - Math.exp(-k * dt));
    const yawErr = wrapPi(aimYaw - fish.yaw);
    const yawK = fish.roam && !fish.withSchool ? 4.2 : 1.15;
    fish.yaw = wrapPi(fish.yaw + clamp(yawErr, -1.2, 1.2) * (1 - Math.exp(-yawK * dt)));
    const faceX = Math.sin(fish.yaw);
    const faceZ = Math.cos(fish.yaw);
    fish.x += faceX * fish.speed * dt + ax[i] * dt;
    fish.z += faceZ * fish.speed * dt + az[i] * dt;
    if (fish.pull) {
      const pdx = cx - fish.x;
      const pdz = cz - fish.z;
      const pd = Math.hypot(pdx, pdz) || 1;
      fish.x += (pdx / pd) * shoal.speed * fish.pull * dt;
      fish.z += (pdz / pd) * shoal.speed * fish.pull * dt;
    }
    pushOutOfRocks(fish, rocks);
    fish.y = clamp(fish.y + (aimY - fish.y) * (1 - Math.exp(-0.45 * dt)) + ay[i] * dt, DORADE_Y_MIN, DORADE_Y_MAX);
    const vy = (aimY - fish.y) * 0.45;
    const pitchAim = -Math.atan2(vy, Math.max(fish.speed, 0.04));
    fish.pitch += (clamp(pitchAim, -0.4, 0.4) - fish.pitch) * (1 - Math.exp(-1.2 * dt));
    fish.holder.position.set(fish.x, fish.y, fish.z);
    fish.holder.rotation.order = 'YXZ';
    fish.holder.rotation.y = fish.yaw;
    fish.holder.rotation.x = fish.pitch;
  }
  shoal.x = cx;
  shoal.z = cz;
}

