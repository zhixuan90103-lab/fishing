/**
 * The shape of a line hanging between two points. No Three and no scene, so it runs in Node.
 *
 * Owns: where the points of the line are, given its two ends and how much line there is.
 * Does not own: drawing (line.js), what the ends are, or any fishing rule.
 *
 * More line than the gap: it hangs in a catenary, the curve a rope takes under its own
 * weight. No more line than the gap: it is straight. The line does not stretch here, so a
 * gap longer than the line is drawn straight and the shortfall comes back as negative slack.
 *
 * Units: metres. World +Y is up.
 */

// Ends closer than this share of the line's length, sideways: the line hangs straight
// down and back up instead. The catenary gets too sharp to solve there.
const FOLD_BELOW = 0.02;

/**
 * Writes `count` points from (ax, ay, az) to (bx, by, bz) into out, three numbers each,
 * starting at index `at`. They are evenly spaced along the line. Returns the slack:
 * length minus the straight gap.
 */
export function hangLine(ax, ay, az, bx, by, bz, length, out, at, count) {
  const dx = bx - ax;
  const dz = bz - az;
  const rise = by - ay;
  const span = Math.hypot(dx, dz);
  const gap = Math.hypot(span, rise);
  const slack = length - gap;
  const last = count - 1;

  if (slack <= 1e-5 * Math.max(1, gap)) {
    for (let i = 0; i < count; i += 1) {
      const t = i / last;
      out[at + i * 3] = ax + dx * t;
      out[at + i * 3 + 1] = ay + rise * t;
      out[at + i * 3 + 2] = az + dz * t;
    }
    return slack;
  }

  if (span < FOLD_BELOW * length) {
    const low = (ay + by - length) * 0.5;
    const down = ay - low;
    for (let i = 0; i < count; i += 1) {
      const t = i / last;
      const s = length * t;
      out[at + i * 3] = ax + dx * t;
      out[at + i * 3 + 1] = s <= down ? ay - s : low + (s - down);
      out[at + i * 3 + 2] = az + dz * t;
    }
    return slack;
  }

  // Catenary y = a cosh((x - x0) / a), x measured sideways from the first end.
  // a comes from sinh(u) / u = k, with u = span / (2a).
  const k = Math.sqrt(length * length - rise * rise) / span;
  let lo = 0;
  let hi = 1;
  while (Math.sinh(hi) / hi < k) hi *= 2;
  for (let n = 0; n < 50; n += 1) {
    const mid = (lo + hi) * 0.5;
    if (Math.sinh(mid) / mid < k) lo = mid;
    else hi = mid;
  }
  const a = span / (lo + hi);
  // Lowest point of the curve, sideways from the first end. It can lie outside the span.
  const x0 = span * 0.5 - a * Math.atanh(rise / length);
  const y0 = Math.cosh(x0 / a);
  // Line used up between the lowest point and the first end.
  const s0 = a * Math.sinh(x0 / a);
  for (let i = 0; i < count; i += 1) {
    const s = (length * i) / last;
    const x = i === last ? span : x0 + a * Math.asinh((s - s0) / a);
    const t = x / span;
    out[at + i * 3] = ax + dx * t;
    out[at + i * 3 + 1] = i === last ? by : ay + a * (Math.cosh((x - x0) / a) - y0);
    out[at + i * 3 + 2] = az + dz * t;
  }
  return slack;
}
