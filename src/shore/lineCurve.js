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
    // Down from the first end to a bottom point, then up to the second. The bottom sits
    // on the halfway line, as low as this length allows, so the two straight pieces add
    // up to `length`. Spreading the span along the whole drop would draw a longer line.
    const mx = (ax + bx) * 0.5;
    const mz = (az + bz) * 0.5;
    const half = span * 0.5;
    let lo = Math.min(ay, by) - length;
    let hi = Math.min(ay, by);
    for (let n = 0; n < 40; n += 1) {
      const mid = (lo + hi) * 0.5;
      const used = Math.hypot(half, ay - mid) + Math.hypot(half, by - mid);
      if (used > length) lo = mid;
      else hi = mid;
    }
    const low = (lo + hi) * 0.5;
    const d1 = Math.hypot(mx - ax, low - ay, mz - az);
    const d2 = Math.hypot(bx - mx, by - low, bz - mz);
    const total = d1 + d2;
    // One sample sits on the bottom. A sample on either side would chord across the
    // corner and draw the line short.
    let n1 = d2 === 0 ? last : Math.round((last * d1) / total);
    n1 = Math.min(last - (d2 === 0 ? 0 : 1), Math.max(d1 === 0 ? 0 : 1, n1));
    for (let i = 0; i <= n1; i += 1) {
      const t = n1 > 0 ? i / n1 : 0;
      const o = at + i * 3;
      out[o] = ax + (mx - ax) * t;
      out[o + 1] = ay + (low - ay) * t;
      out[o + 2] = az + (mz - az) * t;
    }
    for (let i = n1 + 1; i <= last; i += 1) {
      const t = (i - n1) / (last - n1);
      const o = at + i * 3;
      out[o] = mx + (bx - mx) * t;
      out[o + 1] = low + (by - low) * t;
      out[o + 2] = mz + (bz - mz) * t;
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

// A far end this far under the water, m, has all of its line lain. Shallower, less: the
// lain shape comes in as the lure goes down, it is not there the moment it is wet.
const LAY_BELOW = 0.5;

/**
 * A line lying fully slack on the water: from a point above the water it runs over the
 * water to straight above its far end, goes in there, and drops plumb to the far end
 * below. A lure sinking on a free line. Fills `out` like hangLine.
 * How a line comes to lie like this, and comes straight again, is shapeLine's business.
 */
function layLine(ax, ay, az, bx, by, bz, out, at, count) {
  const last = count - 1;
  // Samples shared out by length, with one on the surface.
  const d1 = Math.hypot(bx - ax, ay, bz - az);
  const d2 = -by;
  const n1 = Math.min(last - 1, Math.max(1, Math.round((last * d1) / (d1 + d2))));
  for (let i = 0; i <= n1; i += 1) {
    const t = i / n1;
    const o = at + i * 3;
    out[o] = ax + (bx - ax) * t;
    out[o + 1] = ay * (1 - t);
    out[o + 2] = az + (bz - az) * t;
  }
  for (let i = n1 + 1; i <= last; i += 1) {
    const t = (i - n1) / (last - n1);
    const o = at + i * 3;
    out[o] = bx;
    out[o + 1] = by * t;
    out[o + 2] = bz;
  }
}

// Slack much smaller than this, m, hardly shows. See shapeLine.
const SLACK_SOFT = 0.08;
// Scratch for shapeLine: the line as it would lie fully slack on the water.
let lain = new Float64Array(0);

/**
 * The line from (ax, ay, az) to (bx, by, bz) with `length` of it out, lying `lay` slack
 * on the water, 0 to 1. Fills `out` like hangLine and returns the same slack.
 *
 * This is the one place the two shapes meet. At 0 it is hangLine: straight, or sagging by
 * whatever slack it has. At 1, with the far end well under water, it is layLine: over
 * the water to above the far end and down. Between, every point is that far from one toward the other, so neither
 * a changing `lay` nor slack coming and going can move the line in one step.
 */
export function shapeLine(ax, ay, az, bx, by, bz, length, lay, out, at, count) {
  // A line sags by the square root of its slack: the first centimetre of slack on ten
  // metres of line drops its middle by a hand's breadth, in one frame. So the first of
  // the slack is drawn in gently. Slack well past SLACK_SOFT is drawn as it is.
  const gap = Math.hypot(bx - ax, by - ay, bz - az);
  const slack = length - gap;
  const drawn = slack > 0 ? gap + (slack * slack) / (slack + SLACK_SOFT) : length;
  hangLine(ax, ay, az, bx, by, bz, drawn, out, at, count);
  if (!(lay > 0) || !(ay > 0 && by < 0)) return slack;
  if (lain.length < count * 3) lain = new Float64Array(count * 3);
  layLine(ax, ay, az, bx, by, bz, lain, 0, count);
  // How far under the water the far end is decides how much there is to lay: a lure
  // just under the surface has no line hanging below it to speak of.
  const w = Math.min(1, lay) * Math.min(1, -by / LAY_BELOW);
  for (let i = 0; i < count * 3; i += 1) out[at + i] += (lain[i] - out[at + i]) * w;
  return slack;
}
