/**
 * The rod blank as a beam. No Three and no scene, so it runs in Node.
 *
 * Owns: what the blank is made of (how stiff and how heavy along its length) and what
 * follows from that once, at start-up: its deep-bend curves and its vibration modes.
 * Does not own: anything that moves. rodFlex.js runs the motion from what this solves.
 *
 * The blank is cut into equal segments. Joint i sits at node i, between segment i-1 and
 * segment i. Node 0 is the butt. Joints inside the grip do not bend.
 *
 * Units: metres, seconds, kilograms, newtons.
 */

// Bare blank, small swings: first mode of a 7 ft graphite spinning rod.
const FREE_HZ = 2.8;
// Sideways force on the tip for a metre of deflection, small bends, N/m.
const TIP_STIFFNESS = 1.86;
// Relative bending stiffness along the blank: [fraction of length, stiffness]. Butt is 1.
// Hand-matched to the blank's radius^4 in rod.js, then left as its own table. Steeper
// falloff means a faster, tippier action. Change this table to retune the rod; do not
// expect a taper edit in rod.js to move it.
const STIFFNESS = [
  [0.0, 1.0],
  [0.35, 0.26],
  [0.55, 0.094],
  [0.7, 0.035],
  [0.85, 0.0092],
  [1.0, 0.0012],
];

// Relative mass per length along the blank: [fraction of length, mass]. Butt is 1.
// A lighter tip makes the fast modes faster and the tip quicker to follow.
const DENSITY = [
  [0.0, 1.0],
  [0.35, 0.6],
  [0.55, 0.41],
  [0.7, 0.28],
  [0.85, 0.17],
  [1.0, 0.08],
];

// The deep-bend table runs from straight up to this tip angle. Past it the rod will not
// bend further. Near 90 the tip lies along a pull from the side, and more pull only moves
// the bend down toward the butt.
const TIP_ANGLE_MAX = (87 * Math.PI) / 180;
const LEVELS = 48;
function along(table, t) {
  for (let i = 1; i < table.length; i += 1) {
    const [t1, s1] = table[i];
    if (t <= t1) {
      const [t0, s0] = table[i - 1];
      const u = (t - t0) / (t1 - t0);
      return s0 * Math.pow(s1 / s0, u);
    }
  }
  return table[table.length - 1][1];
}

/**
 * The beam in pieces. Joint i sits at node i, between segment i-1 and segment i.
 * Joints inside the grip do not bend: their stiffness is 0 here and they are skipped.
 */
function buildBeam(length, segs, rigidBelow) {
  const h = length / segs;
  const rel = new Float64Array(segs);
  let compliance = 0;
  for (let i = 1; i < segs; i += 1) {
    const y = i * h;
    rel[i] = y < rigidBelow ? 0 : along(STIFFNESS, y / length);
    if (rel[i] > 0) compliance += (h * (length - y) * (length - y)) / rel[i];
  }
  // Scale the profile so the small-bend stiffness at the tip is exactly TIP_STIFFNESS.
  const ei0 = TIP_STIFFNESS * compliance;
  // Mass lumped on nodes 1..segs. The scale is set later from FREE_HZ.
  const mass = new Float64Array(segs + 1);
  for (let i = 1; i <= segs; i += 1) {
    mass[i] = along(DENSITY, (i * h) / length) * h * (i === segs ? 0.5 : 1);
  }
  return { length, segs, h, rel, ei0, mass };
}

/**
 * Static shapes of the blank for a growing sideways load on the tip.
 * Row k holds the tip deflection, the load that causes it, and every segment's angle
 * off the grip axis.
 */
function buildTable(beam) {
  const { segs, h, rel, ei0, length } = beam;
  // March from the tip, where the moment is zero, down to the grip.
  // The moment at a joint is the load times the tip's distance ahead of it along the grip axis.
  const angles = new Float64Array(segs);
  function gripAngle(load, tipAngle) {
    angles[segs - 1] = tipAngle;
    let lever = h * Math.cos(tipAngle);
    for (let i = segs - 1; i >= 1; i -= 1) {
      const curve = rel[i] > 0 ? (load * lever) / (ei0 * rel[i]) : 0;
      angles[i - 1] = angles[i] - h * curve;
      lever += h * Math.cos(angles[i - 1]);
    }
    return angles[0];
  }

  const deflect = new Float64Array(LEVELS + 1);
  const force = new Float64Array(LEVELS + 1);
  const shapes = new Float64Array((LEVELS + 1) * segs);
  for (let k = 1; k <= LEVELS; k += 1) {
    const tipAngle = (TIP_ANGLE_MAX * k) / LEVELS;
    // The grip segment must come out straight. More load turns it further back.
    let lo = 0;
    let hi = TIP_STIFFNESS * length;
    while (gripAngle(hi, tipAngle) > 0) hi *= 2;
    for (let n = 0; n < 50; n += 1) {
      const mid = (lo + hi) * 0.5;
      if (gripAngle(mid, tipAngle) > 0) lo = mid;
      else hi = mid;
    }
    force[k] = (lo + hi) * 0.5;
    gripAngle(force[k], tipAngle);
    let side = 0;
    for (let j = 0; j < segs; j += 1) {
      shapes[k * segs + j] = angles[j];
      side += h * Math.sin(angles[j]);
    }
    deflect[k] = side;
  }
  return { deflect, force, shapes };
}

// Eigenvalues and vectors of a small symmetric matrix, by Jacobi rotations.
function eigenSym(a) {
  const n = a.length;
  const v = a.map((_, i) => a.map((__, j) => (i === j ? 1 : 0)));
  for (let sweep = 0; sweep < 80; sweep += 1) {
    let off = 0;
    let diag = 0;
    for (let p = 0; p < n; p += 1) {
      diag += a[p][p] * a[p][p];
      for (let q = p + 1; q < n; q += 1) off += a[p][q] * a[p][q];
    }
    if (off <= diag * 1e-26) break;
    for (let p = 0; p < n; p += 1) {
      for (let q = p + 1; q < n; q += 1) {
        if (Math.abs(a[p][q]) < 1e-300) continue;
        const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        for (let k = 0; k < n; k += 1) {
          const kp = a[k][p];
          const kq = a[k][q];
          a[k][p] = c * kp - s * kq;
          a[k][q] = s * kp + c * kq;
        }
        for (let k = 0; k < n; k += 1) {
          const pk = a[p][k];
          const qk = a[q][k];
          a[p][k] = c * pk - s * qk;
          a[q][k] = s * pk + c * qk;
        }
        for (let k = 0; k < n; k += 1) {
          const kp = v[k][p];
          const kq = v[k][q];
          v[k][p] = c * kp - s * kq;
          v[k][q] = s * kp + c * kq;
        }
      }
    }
  }
  return { values: a.map((row, i) => row[i]), vectors: v };
}

/**
 * The slowest vibration modes of the beam, with tipLoad kg riding on the tip.
 * Small sideways motion. The unknowns are the bend angles at the joints that can bend.
 * Each mode comes back scaled so that its mass is 1.
 */
function solveModes(beam, massScale, tipLoad, count) {
  const { segs, h, rel, ei0 } = beam;
  const mass = new Float64Array(segs + 1);
  for (let i = 1; i <= segs; i += 1) mass[i] = beam.mass[i] * massScale;
  mass[segs] += tipLoad;
  const joints = [];
  for (let i = 1; i < segs; i += 1) if (rel[i] > 0) joints.push(i);
  const n = joints.length;
  // A bend at joint j moves node i sideways by its distance past the joint.
  const reach = (i, j) => Math.max(0, (i - j) * h);
  const spring = joints.map((j) => (ei0 * rel[j]) / h);
  const s = joints.map(() => new Array(n).fill(0));
  for (let a = 0; a < n; a += 1) {
    for (let b = a; b < n; b += 1) {
      let sum = 0;
      for (let i = 1; i <= segs; i += 1) sum += mass[i] * reach(i, joints[a]) * reach(i, joints[b]);
      s[a][b] = s[b][a] = sum / Math.sqrt(spring[a] * spring[b]);
    }
  }
  const { values, vectors } = eigenSym(s);
  const order = values.map((_, i) => i).sort((a, b) => values[b] - values[a]);
  const modes = [];
  for (let m = 0; m < Math.min(count, n); m += 1) {
    const col = order[m];
    const shape = new Float64Array(segs + 1);
    for (let i = 1; i <= segs; i += 1) {
      for (let a = 0; a < n; a += 1) {
        shape[i] += (reach(i, joints[a]) * vectors[a][col]) / Math.sqrt(spring[a]);
      }
    }
    let norm = 0;
    for (let i = 1; i <= segs; i += 1) norm += mass[i] * shape[i] * shape[i];
    const scale = (shape[segs] < 0 ? -1 : 1) / Math.sqrt(norm);
    // How hard a push on the butt and a turn of the grip each drive this mode.
    let push = 0;
    let swing = 0;
    const slope = new Float64Array(segs);
    for (let i = 1; i <= segs; i += 1) {
      shape[i] *= scale;
      push += mass[i] * shape[i];
      swing += mass[i] * shape[i] * i * h;
      slope[i - 1] = (shape[i] - shape[i - 1]) / h;
    }
    const omega = 1 / Math.sqrt(values[col]);
    modes.push({ omega, shape, slope, push, swing, tip: shape[segs] });
  }
  return modes;
}

/**
 * length: butt to tip. segs: how many segments. rigidBelow: the grip, measured from the butt.
 */
export function createRodBeam({ length, segs, rigidBelow = 0 }) {
  const beam = buildBeam(length, segs, rigidBelow);
  const { deflect, force, shapes } = buildTable(beam);
  // Frequency goes as 1 / sqrt(mass). Set the blank's mass so the bare first mode is FREE_HZ.
  const trial = solveModes(beam, 1, 0, 1)[0].omega;
  const massScale = (trial / (Math.PI * 2 * FREE_HZ)) ** 2;

  // Row and fraction in the deep-bend table for a value.
  let row = 0;
  let frac = 0;
  function find(values, x) {
    if (x >= values[LEVELS]) {
      row = LEVELS - 1;
      frac = 1;
      return;
    }
    let k = 0;
    while (x > values[k + 1]) k += 1;
    row = k;
    frac = Math.max(0, (x - values[k]) / (values[k + 1] - values[k]));
  }

  return {
    segs,
    // Segment length.
    h: beam.h,
    // Largest sideways tip deflection the deep-bend table reaches.
    reach: deflect[LEVELS],
    // Sideways force on the tip for a metre of deflection, small bends, N/m.
    tipStiffness: TIP_STIFFNESS,

    /**
     * The slowest `count` vibration modes with tipLoad kg riding on the tip. Each has:
     * omega (rad/s), tip (its sideways motion at the tip), slope (per segment),
     * push and swing (how hard moving the butt and turning the grip drive it).
     */
    modes(tipLoad, count) {
      return solveModes(beam, massScale, tipLoad, count);
    },

    // How much stiffer than a small bend the blank is at this tip deflection. 1 when straight.
    stiffening(d) {
      if (d < 1e-6) return 1;
      find(deflect, d);
      return (force[row] + (force[row + 1] - force[row]) * frac) / (TIP_STIFFNESS * d);
    },

    // Tip deflection that a small-bend deflection of `linear` really comes to, once the
    // blank has stiffened.
    deepen(linear) {
      find(force, TIP_STIFFNESS * linear);
      return deflect[row] + (deflect[row + 1] - deflect[row]) * frac;
    },

    // How far the tip section has turned off the grip axis when the tip is deflected by d.
    tipAngle(d) {
      find(deflect, d);
      return (TIP_ANGLE_MAX * (row + frac)) / LEVELS;
    },

    // Every segment's angle off the grip axis when the tip is deflected by d.
    bendAngles(d, out) {
      find(deflect, d);
      const a = row * segs;
      const b = a + segs;
      for (let j = 0; j < segs; j += 1) out[j] = shapes[a + j] + (shapes[b + j] - shapes[a + j]) * frac;
    },
  };
}
