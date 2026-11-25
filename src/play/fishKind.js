/**
 * What kind of fish is on the line: the numbers a fight takes from its species and size.
 *
 * Owns: one table per species, reading a fish of a given size off it, and the two
 * measurements of the body the rules need.
 * Does not own: what the numbers do. How it pulls and tires is fight.js, how its head
 * shakes reach the line is thump.js, its weight on the tip is tipWeight.js. Nor the
 * size itself: the school gives every fish one (src/fish/flock.js) and catch.js reads it.
 * No Three, no scene: it runs in Node. Rule: docs/FISHING-REQUIREMENTS.md section 14.
 * Design: docs/PLAY.md section 8.
 *
 * A new fish is a new table here. The rules of the cast do not change with it.
 *
 * Units: newtons, seconds, kilograms. Size is the body's scale: 1 is the model as made.
 */

/**
 * One row per body size, smallest first. A fish between two rows is read between them.
 *   size      the body's scale
 *   runFresh  how hard it pulls in a run at full stamina, N
 *   runSpent  and worn out, N
 *   tire      how fast it tires, against the rate in fight.js. Higher is spent sooner
 *   burst     how long it can pull flat out against a line that holds it, s: a run's worth
 *   recover   how long it takes to get that back, hanging on a line that is not drawing it, s
 *   dash      how fast it tears off across the line in a run, fresh, m/s
 *             Set against a real fish's burst speed: about 0.4 + 7.4 x its length, m/s,
 *             for fish under half a metre (Videler 1993). The table is a fifth or so over
 *             that, on purpose: it is a game, and a fish that crosses the picture reads
 *             better than one that is true to the metre. docs/PLAY.md section 8
 *   thump     how hard a shake of its head snatches the line at its peak, fresh, N
 *   beat      seconds between head shakes within a burst, fresh: [shortest, longest]
 *   load      what it weighs out of the water, kg. In the water it puts a share of that
 *             on the line (tipWeight.js), and that is all it pulls with when it is doing
 *             nothing: `rest`, N, worked out from it and never zero
 *
 * No two fish of a size are alike. Each has a nature, drawn once (drawNature) and its own
 * from then on: how strong, how fast, how lasting, how quick to recover, and how bold.
 * fishOf() lays it over the table. Nothing in a nature can carry a small fish over the
 * point where the reel gives line.
 *
 * The first two rows are the small fish: runFresh stays below the point where the reel
 * gives line (haul.js), so they never take any. The last two are the big ones: fresh,
 * they pull harder than the reel holds.
 */
import { SUNK_SHARE } from './tipWeight.js';

const KINDS = {
  dorade: [
    { size: 0.78, runFresh: 16.8, runSpent: 7.8, tire: 0.3, burst: 4, recover: 2.6, dash: 3.6, thump: 5.4, beat: [0.1, 0.16], load: 0.66 },
    { size: 0.95, runFresh: 22.8, runSpent: 9.6, tire: 0.26, burst: 4.5, recover: 2.8, dash: 4.2, thump: 7.2, beat: [0.11, 0.18], load: 1.02 },
    { size: 1.2, runFresh: 48, runSpent: 14.4, tire: 0.26, burst: 5.5, recover: 3.2, dash: 5.2, thump: 12, beat: [0.15, 0.24], load: 1.68 },
    { size: 1.4, runFresh: 58.8, runSpent: 16.8, tire: 0.22, burst: 6, recover: 3.4, dash: 6, thump: 15.6, beat: [0.17, 0.28], load: 2.16 },
  ],
};

// The body, for a fish of size 1 (0.45 m long, about a third as deep as it is long): how
// far its back stands over its middle, and how far its mouth is under its middle, m.
// Both go with the size. Where its back is, is reckoned from where its middle or its
// mouth is.
export const BACK_OVER = 0.08;
export const MOUTH_UNDER = 0.033;

const GRAVITY = 9.81;
// How far a fish's own nature can carry it from the table, either way, as a share: its
// strength, its speed, how long it lasts and how fast it recovers.
const VARIES = 0.15;
const RECOVERS_VARIES = 0.22;
// A bold fish bolts again when it has this much of a run back, a placid one waits for
// this much, as a share of what it can get back at all.
const GO_BOLD = 0.4;
const GO_PLACID = 0.85;

// A fish with nothing of its own: the table as it stands.
const PLAIN = { strength: 1, speed: 1, lasting: 1, recovery: 1, bold: 0.5 };

/**
 * One fish's own nature, drawn with random(), 0 to 1. strength, speed, lasting and
 * recovery are shares of the table's figure, about 1. bold is 0, placid, to 1.
 */
export function drawNature(random) {
  const about = (spread) => 1 + (random() * 2 - 1) * spread;
  return { strength: about(VARIES), speed: about(VARIES), lasting: about(VARIES), recovery: about(RECOVERS_VARIES), bold: random() };
}

const mix = (a, b, t) => a + (b - a) * t;

/**
 * The fish of this species and body size, with this nature (drawNature) or none. Sizes
 * off either end of the table read as the end row. Returns a new object with the columns
 * above, plus kind, size, rest, and goAt: the share of a run it has to have back before
 * it bolts again.
 */
export function fishOf(kind, size, nature = PLAIN) {
  const rows = KINDS[kind];
  if (!rows) throw new Error(`No such fish: ${kind}`);
  let i = 1;
  while (i < rows.length - 1 && size > rows[i].size) i += 1;
  const a = rows[i - 1];
  const b = rows[i];
  const t = Math.min(1, Math.max(0, (size - a.size) / (b.size - a.size)));
  const load = mix(a.load, b.load, t);
  return {
    kind,
    size,
    runFresh: mix(a.runFresh, b.runFresh, t) * nature.strength,
    runSpent: mix(a.runSpent, b.runSpent, t) * nature.strength,
    rest: load * GRAVITY * SUNK_SHARE,
    tire: mix(a.tire, b.tire, t) / nature.lasting,
    burst: mix(a.burst, b.burst, t),
    recover: mix(a.recover, b.recover, t) / nature.recovery,
    goAt: GO_PLACID + (GO_BOLD - GO_PLACID) * nature.bold,
    bold: nature.bold,
    dash: mix(a.dash, b.dash, t) * nature.speed,
    thump: mix(a.thump, b.thump, t) * nature.strength,
    beat: [mix(a.beat[0], b.beat[0], t), mix(a.beat[1], b.beat[1], t)],
    load,
  };
}

// How big a fish of this species this is among its kind: 0 the smallest in its table to
// 1 the biggest. Not held to that range: a size off either end reads past it.
export function bulkOf(kind, size) {
  const rows = KINDS[kind];
  if (!rows) throw new Error(`No such fish: ${kind}`);
  return (size - rows[0].size) / (rows[rows.length - 1].size - rows[0].size);
}

// The hardest any fish of any kind pulls, N.
export const HARDEST_RUN = Math.max(...Object.values(KINDS).flat().map((row) => row.runFresh)) * (1 + VARIES);
