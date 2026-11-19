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
 * Three things can act on the tip from outside. The two forces go to the first mode alone:
 * its deep-bend curve is already the whole answer to a pull on the tip, and it stiffens as
 * it should. The fast modes do not stiffen, so a share of a hard pull would wring them
 * into an S the real blank never takes. They are left to carry motion only.
 *   a weight riding on it   setTipLoad     changes the modes themselves
 *   a steady force          setTipForce    the same whatever the rod does
 *   a tether                setTipTether   a line to a fixed point: pulls only when the
 *                                          bent tip is further away than the line is long
 * The tether is worked out again in every small step from where the bent tip is then.
 * Worked out once a frame and handed in as a force, a stiff line shakes itself apart at
 * low frame rates.
 *
 * What the tether is tied to may be a weight hanging on the line, not a fixed point: a
 * lure or a fish out of the water. Then it is handed to step() as a rider, and is moved
 * in the same small steps as the blank, each from where the other is then. A weight and
 * a tip that read each other a frame apart, on a short stiff line, jump between no
 * tension and a spike.
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

  // The modes. Per mode, world space, three numbers each. z is the mode's inertial point,
  // v its velocity, q its offset from where a rigid rod puts it. base is that rigid place
  // last frame, next is where it is this frame.
  const z = new Float64Array(count * 3);
  const v = new Float64Array(count * 3);
  const q = new Float64Array(count * 3);
  const base = new Float64Array(count * 3);
  const next = new Float64Array(count * 3);
  // The grip last frame.
  let prevAx = 0, prevAy = 1, prevAz = 0;
  let prevBx = 0, prevBy = 0, prevBz = 0;
  let stale = true;

  // What acts on the tip from outside.
  let load = 0;
  let extX = 0, extY = 0, extZ = 0;
  let tied = false;
  let tieX = 0, tieY = 0, tieZ = 0;
  let tieLength = 0;
  let tieStiffness = 0;
  // The tether's length as of the last step, and the one in use in the substep in hand:
  // it is carried evenly from one to the other through the frame, like the grip.
  let tieWas = null;
  let tieNow = 0;
  let tension = 0;
  // The total of those for the substep in hand. Written by tipPull().
  let pullX = 0, pullY = 0, pullZ = 0;
  // Where the bent tip was at the start of that substep, world space. Written by tipPull().
  let tipX = 0, tipY = 0, tipZ = 0;
  // How a pull on the tip reaches each mode. Only the first takes it, scaled so that a
  // steady pull F settles the tip at F / tipStiffness, the deep-bend table's own figure.
  let pullShare = new Float64Array(count);
  function sharePull() {
    pullShare = new Float64Array(count);
    const first = modes[0];
    pullShare[0] = (first.omega * first.omega) / (beam.tipStiffness * first.tip);
  }
  sharePull();
  const bent = new Float64Array(nodes * 3);
  // The grip last frame, as objects, for re-placing the modes when the tip load changes.
  const held = { x: 0, y: 0, z: 0 };
  const heldAxis = { x: 0, y: 1, z: 0 };

  function rigidPlace(out, butt, axis) {
    for (let m = 0; m < modes.length; m += 1) {
      const { push, swing } = modes[m];
      out[m * 3] = push * butt.x + swing * axis.x;
      out[m * 3 + 1] = push * butt.y + swing * axis.y;
      out[m * 3 + 2] = push * butt.z + swing * axis.z;
    }
  }

  // The blank's curve for the current offsets, for a grip axis (ax, ay, az).
  function curve(ax, ay, az, out) {
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
      let dx = ax * c + sx * s;
      let dy = ay * c + sy * s;
      let dz = az * c + sz * s;
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
  }

  /**
   * The pull on the tip at the start of a substep, into pullX, pullY, pullZ.
   * (bx, by, bz) is the butt and (ax, ay, az) the grip axis at that moment.
   * The steady force, plus the tether if the bent tip is further from its anchor than the
   * line is long. Also sets `tension`.
   *
   * The tether bends the rod only until the tip section points along the line. A line at
   * 40 degrees to the grip turns the tip 40 degrees and no more, however hard it pulls:
   * past that the pull runs down the blank instead of across it. So the part that bends
   * is tension * sin(line angle - tip angle) / cos(tip angle). For a straight rod that is
   * the plain sideways part of the pull, and for a line square to the grip it is the whole
   * tension, which is the case the deep-bend table was solved for.
   */
  function tipPull(bx, by, bz, ax, ay, az) {
    pullX = extX;
    pullY = extY;
    pullZ = extZ;
    if (!tied) return;
    curve(ax, ay, az, bent);
    const e = (nodes - 1) * 3;
    tipX = bx + bent[e];
    tipY = by + bent[e + 1];
    tipZ = bz + bent[e + 2];
    let gx = tieX - tipX;
    let gy = tieY - tipY;
    let gz = tieZ - tipZ;
    const gap = Math.hypot(gx, gy, gz);
    tension = gap > tieNow ? tieStiffness * (gap - tieNow) : 0;
    if (!(tension > 0)) return;
    // Split the line's direction into along the grip and across it.
    gx /= gap;
    gy /= gap;
    gz /= gap;
    const along = gx * ax + gy * ay + gz * az;
    gx -= ax * along;
    gy -= ay * along;
    gz -= az * along;
    const across = Math.hypot(gx, gy, gz);
    if (across < 1e-6) return;
    gx /= across;
    gy /= across;
    gz /= across;
    // A line that pulls back past square is treated as square.
    const lineAngle = Math.atan2(across, Math.max(along, 0));
    // How far the tip has already turned toward the line.
    const r = Math.hypot(q[0], q[1], q[2]);
    const toward = r > 1e-9 ? (q[0] * gx + q[1] * gy + q[2] * gz) / r : 0;
    const tipAngle = beam.tipAngle(modes[0].tip * r) * toward;
    const part = Math.sin(lineAngle - tipAngle) / Math.cos(tipAngle);
    const bend = tension * Math.max(-1, Math.min(1, part));
    pullX += gx * bend;
    pullY += gy * bend;
    pullZ += gz * bend;
  }

  /**
   * One substep for mode m. dt is the whole frame and f how far through it this substep
   * ends. (ax, ay, az) is the grip axis at that end. Reads pullX, pullY, pullZ.
   */
  function advanceMode(m, sub, dt, f, ax, ay, az) {
    const mode = modes[m];
    const o = m * 3;
    // The rigid place moves in a straight line over the frame.
    const bx = (next[o] - base[o]) / dt;
    const by = (next[o + 1] - base[o + 1]) / dt;
    const bz = (next[o + 2] - base[o + 2]) / dt;
    // q is the offset at the start of the substep. The spring reads this one, not the
    // offset to the rigid place's next position, or the rigid rod's own travel would
    // count as bend.
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
    const share = pullShare[m];
    v[o] += (-spring * dx - loss * rx + share * pullX) * sub;
    v[o + 1] += (-spring * dy - loss * ry + share * pullY - mode.push * GRAVITY) * sub;
    v[o + 2] += (-spring * dz - loss * rz + share * pullZ) * sub;
    z[o] += v[o] * sub;
    z[o + 1] += v[o + 1] * sub;
    z[o + 2] += v[o + 2] * sub;

    // The blank does not stretch: it only moves across the grip axis, and no further
    // than it can reach.
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

  // Come to rest under gravity and the steady force. A tether is not settled here: it
  // pulls the tip in over the next moments.
  function reset(butt, axis) {
    rigidPlace(base, butt, axis);
    for (let m = 0; m < modes.length; m += 1) {
      const mode = modes[m];
      const k = mode.omega * mode.omega;
      let fx = pullShare[m] * extX;
      let fy = pullShare[m] * extY - mode.push * GRAVITY;
      let fz = pullShare[m] * extZ;
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
    prevBx = butt.x;
    prevBy = butt.y;
    prevBz = butt.z;
    tension = 0;
    stale = false;
  }

  return {
    // Frequencies of the modes in use, Hz, slowest first. For checking.
    get hz() {
      return modes.map((m) => m.omega / (Math.PI * 2));
    },

    // Extra mass riding on the tip, kg: the lure while it hangs there, or a fish lifted
    // out of the water. Slows every mode and sags the blank. The blank keeps the bend and
    // the motion it has and takes up the new weight from there, so put a heavy weight on
    // in small steps, not all at once.
    setTipLoad(kg) {
      const value = Math.max(0, kg);
      if (value === load) return;
      load = value;
      const before = modes;
      modes = beam.modes(load, count);
      sharePull();
      if (stale) return;
      // Each mode's shape is scaled by its mass, which has just changed. Keep where the
      // tip is, not the number.
      held.x = prevBx; held.y = prevBy; held.z = prevBz;
      heldAxis.x = prevAx; heldAxis.y = prevAy; heldAxis.z = prevAz;
      rigidPlace(base, held, heldAxis);
      for (let m = 0; m < modes.length; m += 1) {
        const same = before[m].tip / modes[m].tip;
        for (let c = 0; c < 3; c += 1) {
          const o = m * 3 + c;
          q[o] *= same;
          v[o] *= same;
          z[o] = base[o] + q[o];
        }
      }
    },

    // A steady force on the tip, world space, newtons. Only the part across the blank
    // bends it. For a line, use the tether: its pull has to follow the rod.
    setTipForce(x, y, z0) {
      extX = x;
      extY = y;
      extZ = z0;
    },

    /**
     * Tie the tip to a world point with `length` metres of line. The line pulls along
     * itself with `stiffness` newtons for each metre the gap exceeds the length, and not
     * at all while the gap is shorter. Swing the tip away and it loads up, let it come
     * back and it goes slack.
     */
    setTipTether(x, y, z0, length, stiffness) {
      tied = true;
      tieX = x;
      tieY = y;
      tieZ = z0;
      tieLength = length;
      tieStiffness = stiffness;
    },
    clearTipTether() {
      tied = false;
      tension = 0;
      tieWas = null;
    },
    // How hard the tether pulls right now, newtons. 0 while it is slack.
    get tension() {
      return tension;
    },

    // Drop all motion and come to rest on the next step. For when the rod is re-mounted.
    settle() {
      stale = true;
    },

    /**
     * butt: where the butt end of the rod is now, world space.
     * axis: unit vector along the grip, butt to tip, world space.
     * rider: what the tether is tied to, if that is a weight on the line and not a fixed
     * point. It has x, y, z, and advance(h, tipX, tipY, tipZ, length, stiffness), which
     * moves it one small step under the same line. It is carried in step with the blank.
     */
    step(dt, butt, axis, rider = null) {
      if (stale) {
        reset(butt, axis);
        return;
      }
      if (!(dt > 0)) return;
      const n = Math.max(1, Math.ceil(dt / SUB_DT - 1e-6));
      const sub = dt / n;
      rigidPlace(next, butt, axis);
      // Grip axis at the start of the substep, to go with the offsets q.
      let sx = prevAx, sy = prevAy, sz = prevAz;
      // A tether newly tied, or one whose length has been set afresh, starts at its length.
      if (tieWas === null || Math.abs(tieLength - tieWas) > 1) tieWas = tieLength;
      for (let j = 1; j <= n; j += 1) {
        const f0 = (j - 1) / n;
        tieNow = tieWas + (tieLength - tieWas) * f0;
        tipPull(
          prevBx + (butt.x - prevBx) * f0,
          prevBy + (butt.y - prevBy) * f0,
          prevBz + (butt.z - prevBz) * f0,
          sx, sy, sz,
        );
        // The grip turns through the frame too. With only the end axis, a steady turn
        // reads as a sideways pull.
        const f = j / n;
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
        for (let m = 0; m < modes.length; m += 1) advanceMode(m, sub, dt, f, ax, ay, az);
        // The weight on the line takes the same step, from the same tip.
        if (rider && tied) {
          rider.advance(sub, tipX, tipY, tipZ, tieNow, tieStiffness);
          tieX = rider.x;
          tieY = rider.y;
          tieZ = rider.z;
        }
        sx = ax;
        sy = ay;
        sz = az;
      }
      tieWas = tied ? tieLength : null;
      base.set(next);
      prevAx = axis.x;
      prevAy = axis.y;
      prevAz = axis.z;
      prevBx = butt.x;
      prevBy = butt.y;
      prevBz = butt.z;
    },

    /**
     * The blank's curve now. out gets three numbers per node: its place relative to the
     * butt, world axes. axis is the same unit vector given to step().
     * The first mode lays the deep-bend curve toward its offset. The fast modes tilt each
     * segment on top of that. Every segment keeps its length.
     */
    shape(axis, out) {
      curve(axis.x, axis.y, axis.z, out);
    },
  };
}
