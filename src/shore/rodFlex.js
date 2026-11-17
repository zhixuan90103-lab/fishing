/**
 * How the rod blank moves. No Three and no scene, so it runs in Node.
 *
 * Owns: how the blank lags the grip and springs back, frame by frame, and the curve it
 * has right now.
 * Does not own: the blank's make-up (rodBeam.js), where the grip is (rodHold.js), the
 * model and bones (rod.js), the line, or any fishing rule. Gameplay only gets setTipLoad
 * and setTipForce.
 *
 * Each vibration mode of the beam is one point with inertia in world space, pulled to
 * where a rigid rod would put it. Nothing is differentiated twice, so a jumpy grip is safe.
 * The slow first mode is the whole upper blank swinging. The faster ones are what carry a
 * flick up the rod: the lower blank goes with the hand, the middle follows, the tip comes
 * last and whips through.
 *
 * The first mode stiffens as it bends and takes the beam's deep-bend curve, so a light
 * load bends only the tip and a heavy one moves the bend down the blank. The fast modes
 * tilt each segment on top of that. Segments keep their length.
 *
 * Units: metres, seconds, kilograms, newtons. World +Y is up.
 */

import { createRodBeam } from './rodBeam.js';

const GRAVITY = 9.81;
// Fixed step. The fastest mode kept stays inside the stable range at this step.
const SUB_DT = 1 / 480;

// Damping ratio of each mode kept, slowest first. The count is how many modes are simulated.
// Faster modes die sooner, so a flick ripples once and then only the slow swing is left.
const DAMPING = [0.09, 0.13, 0.18];
// Loss grows with speed (air on the blank and guides). It doubles at this tip speed, m/s.
const LOSS_DOUBLES_AT = 3;

// The fast modes may move the tip this share of what the first mode may.
const RIPPLE_REACH = 0.4;

export function createRodFlex({ length, nodes, rigidBelow = 0 }) {
  const beam = createRodBeam({ length, segs: nodes - 1, rigidBelow });
  const { segs, h, reach } = beam;
  const count = DAMPING.length;
  let modes = beam.modes(0, count);
  const angles = new Float64Array(segs);

  // Per mode, world space, three numbers each. z is the mode's inertial point, v its
  // velocity, q its offset from where a rigid rod puts it, base that rigid place last frame.
  const z = new Float64Array(count * 3);
  const v = new Float64Array(count * 3);
  const q = new Float64Array(count * 3);
  const base = new Float64Array(count * 3);
  const next = new Float64Array(count * 3);
  let prevAx = 0, prevAy = 1, prevAz = 0;
  let load = 0;
  let extX = 0, extY = 0, extZ = 0;
  let stale = true;

  function rigidPlace(out, butt, axis) {
    for (let m = 0; m < modes.length; m += 1) {
      const { push, swing } = modes[m];
      out[m * 3] = push * butt.x + swing * axis.x;
      out[m * 3 + 1] = push * butt.y + swing * axis.y;
      out[m * 3 + 2] = push * butt.z + swing * axis.z;
    }
  }

  // Settle at rest under gravity and the current pull.
  function reset(butt, axis) {
    rigidPlace(base, butt, axis);
    for (let m = 0; m < modes.length; m += 1) {
      const mode = modes[m];
      const k = mode.omega * mode.omega;
      let fx = mode.tip * extX;
      let fy = mode.tip * extY - mode.push * GRAVITY;
      let fz = mode.tip * extZ;
      const a = fx * axis.x + fy * axis.y + fz * axis.z;
      fx = (fx - axis.x * a) / k;
      fy = (fy - axis.y * a) / k;
      fz = (fz - axis.z * a) / k;
      if (m === 0) {
        // The first mode stiffens: find the deflection that carries this much load.
        const linear = Math.hypot(fx, fy, fz) * mode.tip;
        if (linear > 1e-9) {
          const real = beam.deepen(linear);
          fx *= real / linear;
          fy *= real / linear;
          fz *= real / linear;
        }
      }
      q[m * 3] = fx;
      q[m * 3 + 1] = fy;
      q[m * 3 + 2] = fz;
      for (let c = 0; c < 3; c += 1) {
        z[m * 3 + c] = base[m * 3 + c] + q[m * 3 + c];
        v[m * 3 + c] = 0;
      }
    }
    prevAx = axis.x;
    prevAy = axis.y;
    prevAz = axis.z;
    stale = false;
  }

  return {
    // Frequencies of the modes in use, Hz, slowest first. For checking.
    get hz() {
      return modes.map((m) => m.omega / (Math.PI * 2));
    },

    // Extra mass riding on the tip, kg: the lure while it hangs there. Slows every mode.
    setTipLoad(kg) {
      const value = Math.max(0, kg);
      if (value === load) return;
      load = value;
      modes = beam.modes(load, count);
      stale = true;
    },

    // A steady pull on the tip, world space, newtons: the line. Only the part across the
    // blank bends it.
    setTipForce(x, y, z0) {
      extX = x;
      extY = y;
      extZ = z0;
    },

    // Drop all motion and come to rest on the next step. For when the rod is re-mounted.
    settle() {
      stale = true;
    },

    /**
     * butt: where the butt end of the rod is now, world space.
     * axis: unit vector along the grip, butt to tip, world space.
     */
    step(dt, butt, axis) {
      if (stale) {
        reset(butt, axis);
        return;
      }
      if (!(dt > 0)) return;
      const n = Math.max(1, Math.ceil(dt / SUB_DT - 1e-6));
      const sub = dt / n;
      rigidPlace(next, butt, axis);
      for (let j = 1; j <= n; j += 1) {
        const f = j / n;
        // The grip turns through the frame too. With only the end axis, a steady turn
        // reads as a sideways pull.
        let ax = prevAx + (axis.x - prevAx) * f;
        let ay = prevAy + (axis.y - prevAy) * f;
        let az = prevAz + (axis.z - prevAz) * f;
        const al = Math.hypot(ax, ay, az);
        if (al > 1e-6) {
          ax /= al;
          ay /= al;
          az /= al;
        } else {
          ax = axis.x;
          ay = axis.y;
          az = axis.z;
        }
        for (let m = 0; m < modes.length; m += 1) {
          const mode = modes[m];
          const o = m * 3;
          // The rigid place moves in a straight line over the frame.
          const bx = (next[o] - base[o]) / dt;
          const by = (next[o + 1] - base[o + 1]) / dt;
          const bz = (next[o + 2] - base[o + 2]) / dt;
          // q is the offset at the start of the substep. The spring reads this one, not
          // the offset to the rigid place's next position, or the rigid rod's own travel
          // would count as bend.
          let dx = q[o];
          let dy = q[o + 1];
          let dz = q[o + 2];
          let spring = mode.omega * mode.omega;
          if (m === 0) spring *= beam.stiffening(mode.tip * Math.hypot(dx, dy, dz));
          const rx = v[o] - bx;
          const ry = v[o + 1] - by;
          const rz = v[o + 2] - bz;
          const tipSpeed = Math.abs(mode.tip) * Math.hypot(rx, ry, rz);
          const loss = 2 * DAMPING[m] * mode.omega * (1 + tipSpeed / LOSS_DOUBLES_AT);
          v[o] += (-spring * dx - loss * rx + mode.tip * extX) * sub;
          v[o + 1] += (-spring * dy - loss * ry + mode.tip * extY - mode.push * GRAVITY) * sub;
          v[o + 2] += (-spring * dz - loss * rz + mode.tip * extZ) * sub;
          z[o] += v[o] * sub;
          z[o + 1] += v[o + 1] * sub;
          z[o + 2] += v[o + 2] * sub;

          // The blank does not stretch: it only moves across the grip axis, and no
          // further than it can reach.
          const cx = base[o] + (next[o] - base[o]) * f;
          const cy = base[o + 1] + (next[o + 1] - base[o + 1]) * f;
          const cz = base[o + 2] + (next[o + 2] - base[o + 2]) * f;
          dx = z[o] - cx;
          dy = z[o + 1] - cy;
          dz = z[o + 2] - cz;
          let a = dx * ax + dy * ay + dz * az;
          dx -= ax * a;
          dy -= ay * a;
          dz -= az * a;
          let ux = v[o] - bx;
          let uy = v[o + 1] - by;
          let uz = v[o + 2] - bz;
          a = ux * ax + uy * ay + uz * az;
          ux -= ax * a;
          uy -= ay * a;
          uz -= az * a;
          const r = Math.hypot(dx, dy, dz);
          const most = (m === 0 ? reach : reach * RIPPLE_REACH) / Math.abs(mode.tip);
          if (r > most) {
            const s = most / r;
            dx *= s;
            dy *= s;
            dz *= s;
            const out = (ux * dx + uy * dy + uz * dz) / (most * most);
            if (out > 0) {
              ux -= dx * out;
              uy -= dy * out;
              uz -= dz * out;
            }
          }
          q[o] = dx;
          q[o + 1] = dy;
          q[o + 2] = dz;
          z[o] = cx + dx;
          z[o + 1] = cy + dy;
          z[o + 2] = cz + dz;
          v[o] = bx + ux;
          v[o + 1] = by + uy;
          v[o + 2] = bz + uz;
        }
      }
      base.set(next);
      prevAx = axis.x;
      prevAy = axis.y;
      prevAz = axis.z;
    },

    /**
     * The blank's curve now. out gets three numbers per node: its place relative to the
     * butt, world axes. axis is the same unit vector given to step().
     * The first mode lays the deep-bend curve toward its offset. The fast modes tilt each
     * segment on top of that. Every segment keeps its length.
     */
    shape(axis, out) {
      const first = modes[0];
      const r = Math.hypot(q[0], q[1], q[2]);
      const sx = r > 1e-9 ? q[0] / r : 0;
      const sy = r > 1e-9 ? q[1] / r : 0;
      const sz = r > 1e-9 ? q[2] / r : 0;
      beam.bendAngles(first.tip * r, angles);
      out[0] = out[1] = out[2] = 0;
      for (let j = 0; j < segs; j += 1) {
        const c = Math.cos(angles[j]);
        const s = Math.sin(angles[j]);
        let dx = axis.x * c + sx * s;
        let dy = axis.y * c + sy * s;
        let dz = axis.z * c + sz * s;
        for (let m = 1; m < modes.length; m += 1) {
          const tilt = modes[m].slope[j];
          dx += q[m * 3] * tilt;
          dy += q[m * 3 + 1] * tilt;
          dz += q[m * 3 + 2] * tilt;
        }
        const len = h / Math.hypot(dx, dy, dz);
        out[j * 3 + 3] = out[j * 3] + dx * len;
        out[j * 3 + 4] = out[j * 3 + 1] + dy * len;
        out[j * 3 + 5] = out[j * 3 + 2] + dz * len;
      }
    },
  };
}
