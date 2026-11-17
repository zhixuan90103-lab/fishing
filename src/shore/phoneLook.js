/**
 * Where the phone points, for the shore view and the rod.
 *
 * Owns: permission, deviceorientation, turning the three Euler angles into three angles
 * that stay independent with the phone held upright, their unwrapping and smoothing.
 * Also chaseAngle, the frame-rate independent chase the view uses on those angles.
 * Does not own: the camera, the rod, or what a press means. startShore.js applies the numbers.
 * No Three, no scene: it runs in Node with a fake window. Design: docs/PHONE-LOOK.md.
 *
 * The angles are absolute: the same phone attitude always reads the same numbers, so
 * bringing the phone back brings the view back. Nothing is integrated from acceleration.
 *
 * beta and gamma are not used directly. With the phone upright (beta near 90°) gamma stops
 * meaning "right edge down" and trades freely with alpha. The device axes in the earth
 * frame do not have that problem, so the angles are read off those:
 *   yaw   heading of the way the back of the phone faces. Positive turns the phone to its
 *         holder's left. Leaning the phone in its own plane does not change it.
 *   pitch lean of the screen. 0 upright, positive with the top tipped toward the holder
 *         (a rod being raised), negative with the top tipped away.
 *   roll  lean in the screen's own plane. Positive with the right edge down.
 * If a direction is backwards on a device, flip its sign in onDevice, nowhere else.
 *
 * A tap must call enable() inside that gesture. One requestPermission only.
 */

// Smoothing of the three angles, 1/s. About 30 ms of delay. It takes out sensor noise and
// the uneven arrival of samples against frames. Lower is steadier and later.
const SMOOTH_RATE = 32;
// "Forward" is read two ways and mixed. Off the screen normal: a lean in the screen's
// plane does not move it, but it points at the sky with the phone lying flat. Off the
// right edge: good at any pitch, but a lean in the plane turns it. The normal is used
// alone while this much of it lies level (FACE_FULL, about 53° of lean), fading to the
// edge alone at FACE_NONE (about 78°). The mix depends only on the attitude, never on the
// path, so the heading always comes home.
const FACE_FULL = 0.6;
const FACE_NONE = 0.2;
// Roll fades out as the phone lies flat, where it cannot be told from yaw. Full above this.
const ROLL_FULL = 0.5;

const RAD = Math.PI / 180;

function wrapDeg(deg) {
  let x = deg;
  while (x > 180) x -= 360;
  while (x < -180) x += 360;
  return x;
}

// Move `from` toward a target at `rate`. Exact for a target that moved evenly from `last`
// to `target` through the frame, so the lag does not depend on the frame rate.
export function chaseAngle(from, target, last, rate, dt) {
  if (!(dt > 0)) return from;
  const keep = Math.exp(-rate * dt);
  const share = 1 - (1 - keep) / (rate * dt);
  return last + (from - last) * keep + (target - last) * share;
}

export function createPhoneLook() {
  let has = false;
  let listening = false;
  // Unwrapped raw angles, degrees.
  let rawYaw = 0;
  let rawPitch = 0;
  let rawRoll = 0;
  let headingAt = 0;
  let pitchAt = 0;
  // The target the smoothing saw last frame, the smoothed value, and the zero.
  const last = { yaw: 0, pitch: 0, roll: 0 };
  const smooth = { yaw: 0, pitch: 0, roll: 0 };
  const zero = { yaw: 0, pitch: 0 };
  const out = { yaw: 0, pitch: 0, roll: 0 };

  function onDevice(event) {
    if (event.alpha == null || event.beta == null || event.gamma == null) return;
    const a = event.alpha * RAD;
    const b = event.beta * RAD;
    const g = event.gamma * RAD;
    const ca = Math.cos(a), sa = Math.sin(a);
    const cb = Math.cos(b), sb = Math.sin(b);
    const cg = Math.cos(g), sg = Math.sin(g);
    // R = Rz(alpha) Rx(beta) Ry(gamma) takes device axes to the earth frame, z up.
    // Right edge (device x) and screen normal (device z) in the earth frame, and the up
    // component of the top edge (device y).
    const rx = ca * cg - sa * sb * sg;
    const ry = cg * sa + ca * sb * sg;
    const rz = -cb * sg;
    const nx = cg * sa * sb + ca * sg;
    const ny = sa * sg - ca * cg * sb;
    const nz = cb * cg;
    const tz = sb;

    // Forward off the normal is -n laid level. Forward off the edge is up × right.
    const faceLen = Math.hypot(nx, ny);
    const edgeLen = Math.hypot(rx, ry);
    let mix = (faceLen - FACE_NONE) / (FACE_FULL - FACE_NONE);
    mix = mix <= 0 ? 0 : mix >= 1 ? 1 : mix * mix * (3 - 2 * mix);
    const keep = edgeLen > 1e-4 ? (1 - mix) / edgeLen : 0;
    const take = faceLen > 1e-4 ? mix / faceLen : 0;
    const fx = -nx * take - ry * keep;
    const fy = -ny * take + rx * keep;
    if (fx * fx + fy * fy > 1e-6) {
      const heading = Math.atan2(fy, fx) / RAD;
      if (has) rawYaw += wrapDeg(heading - headingAt);
      headingAt = heading;
    }
    // The top edge and right edge share what is left of "up" once the screen leans.
    // The roll is taken as under 90°, which fixes the sign past lying flat.
    const upright = Math.hypot(tz, rz);
    const side = tz < 0 ? -1 : 1;
    const pitch = Math.atan2(-nz, side * upright) / RAD;
    if (has) rawPitch += wrapDeg(pitch - pitchAt);
    else rawPitch = pitch;
    pitchAt = pitch;
    rawRoll = (Math.atan2(-rz * side, Math.abs(tz)) / RAD) * Math.min(1, upright / ROLL_FULL);

    if (!has) {
      last.yaw = smooth.yaw = rawYaw;
      last.pitch = smooth.pitch = rawPitch;
      last.roll = smooth.roll = rawRoll;
      has = true;
    }
  }

  function listen() {
    if (listening) return;
    window.addEventListener('deviceorientation', onDevice);
    listening = true;
  }

  return {
    // True once a sample has arrived.
    get active() {
      return has;
    },

    // Call from a tap. iOS shows the permission prompt only inside that gesture.
    enable() {
      const sensor = window.DeviceOrientationEvent;
      if (!sensor) return Promise.resolve(false);
      // One call, started synchronously inside the click. A second permission
      // request in the same turn can be rejected and then no sheet is shown.
      const ask = typeof sensor.requestPermission === 'function'
        ? sensor.requestPermission()
        : Promise.resolve('granted');
      return ask.then((answer) => {
        if (answer !== 'granted') return false;
        listen();
        return true;
      }).catch(() => false);
    },

    // Once a frame, before look().
    advance(dt) {
      smooth.yaw = chaseAngle(smooth.yaw, rawYaw, last.yaw, SMOOTH_RATE, dt);
      smooth.pitch = chaseAngle(smooth.pitch, rawPitch, last.pitch, SMOOTH_RATE, dt);
      smooth.roll = chaseAngle(smooth.roll, rawRoll, last.roll, SMOOTH_RATE, dt);
      last.yaw = rawYaw;
      last.pitch = rawPitch;
      last.roll = rawRoll;
    },

    // The attitude the phone has right now becomes yaw 0, pitch 0. Roll keeps its own
    // zero: level is level.
    recenter() {
      last.yaw = smooth.yaw = rawYaw;
      last.pitch = smooth.pitch = rawPitch;
      zero.yaw = rawYaw;
      zero.pitch = rawPitch;
    },

    // Degrees. yaw and pitch since recenter(), roll from level. The same object each call.
    look() {
      out.yaw = smooth.yaw - zero.yaw;
      out.pitch = smooth.pitch - zero.pitch;
      out.roll = smooth.roll;
      return out;
    },

    dispose() {
      if (listening) window.removeEventListener('deviceorientation', onDevice);
      listening = false;
    },
  };
}
