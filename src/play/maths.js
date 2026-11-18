/**
 * The two small sums every rule in this folder uses.
 *
 * Owns: easing a value toward another at a rate, and drawing a number from a range.
 * Does not own: any rule. No Three, no scene: it runs in Node.
 *
 * They were written out in a dozen places. One place means one way to get the frame
 * rate out of an ease, and one way to take a random number.
 */

// `value` after dt seconds of closing on `to` at `rate`, 1/s. The same at any frame rate,
// for a `to` that holds still through the frame.
export function toward(value, to, rate, dt) {
  return value + (to - value) * (1 - Math.exp(-rate * dt));
}

// A number between range[0] and range[1], drawn with random(), 0 to 1.
export function between(random, range) {
  return range[0] + random() * (range[1] - range[0]);
}
