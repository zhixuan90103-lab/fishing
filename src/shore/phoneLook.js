/**
 * Phone samples for the shore view.
 *
 * Owns: permission, deviceorientation (beta, gamma), devicemotion acceleration.x,
 * the sideways travel integral, and pastDeadzone.
 * Does not own: the camera, the rod, or what a press means. startShore.js applies the numbers.
 *
 * beta 0 is the phone lying screen-up. Upright portrait is about 90°.
 * acceleration.x is in the device frame, positive to the right.
 * A tap must call enable() inside that gesture. One requestPermission only.
 */

export const YAW_DEG_PER_METRE = 120;
export const UPRIGHT_BETA = 90;
export const ROD_DEAD_DEG = 8;
export const PITCH_DEAD_DEG = 3;
export const ACCEL_DEAD = 0.35;

const SLIDE_LIMIT = 0.8;

export function pastDeadzone(deg, zone = ROD_DEAD_DEG) {
  const a = Math.abs(deg);
  if (a <= zone) return 0;
  return Math.sign(deg) * (a - zone);
}

function wrapDeg(deg) {
  let x = deg;
  while (x > 180) x -= 360;
  while (x < -180) x += 360;
  return x;
}

export function createPhoneLook() {
  let beta = 0;
  let gamma = 0;
  let has = false;
  let listening = false;
  let refBeta = 0;
  let ax = 0;
  let slide = 0;
  let slideV = 0;
  let stillFor = 0;

  function onDevice(event) {
    if (event.beta == null || event.gamma == null) return;
    beta = event.beta;
    gamma = event.gamma;
    has = true;
  }

  function onMotion(event) {
    const a = event.acceleration;
    if (!a || a.x == null) return;
    ax = a.x;
  }

  // Sideways travel since rebase, metres. Stopping does not rewind it.
  // Velocity decays only after 0.12 s below ACCEL_DEAD.
  function advanceSlide(dt) {
    if (!(dt > 0)) return;
    const a = Math.abs(ax) < ACCEL_DEAD ? 0 : ax;
    if (a === 0) {
      stillFor += dt;
      if (stillFor > 0.12) slideV *= Math.exp(-8 * dt);
    } else {
      stillFor = 0;
      slideV += a * dt;
    }
    slide += slideV * dt;
    slide = Math.max(-SLIDE_LIMIT, Math.min(SLIDE_LIMIT, slide));
  }

  function listen() {
    if (listening) return;
    window.addEventListener('deviceorientation', onDevice);
    window.addEventListener('devicemotion', onMotion);
    listening = true;
  }

  return {
    get active() {
      return has;
    },

    // Call from a tap. iOS shows the permission prompt only inside that gesture.
    enable() {
      const sensor = window.DeviceOrientationEvent || window.DeviceMotionEvent;
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

    sample() {
      return has;
    },

    rebase() {
      refBeta = beta;
      slide = 0;
      slideV = 0;
      stillFor = 0;
    },

    advance(dt) {
      advanceSlide(dt);
    },

    slideMetres() {
      return slide;
    },

    // Pitch since rebase. Positive when the top of the phone tips away.
    axes() {
      return { lift: wrapDeg(refBeta - beta) };
    },

    tilt() {
      return { beta, gamma };
    },

    dispose() {
      if (listening) {
        window.removeEventListener('deviceorientation', onDevice);
        window.removeEventListener('devicemotion', onMotion);
      }
      listening = false;
    },
  };
}
