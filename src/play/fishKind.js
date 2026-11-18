/**
 * What kind of fish is on the line: the numbers a fight takes from its species and size.
 *
 * Owns: one table per species, and reading a fish of a given size off it.
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
 *   rest      and between runs, N. Never zero: the line stays tight
 *   tire      how fast it tires, against the rates in fight.js. Higher is spent sooner
 *   runFor    how long its runs last, against the times in fight.js
 *   thump     how hard a shake of its head snatches the line at its peak, fresh, N
 *   beat      seconds between head shakes within a burst, fresh: [shortest, longest]
 *   load      what it weighs on the rod tip once out of the water, kg
 *
 * The first two rows are the small fish: runFresh stays below the point where the reel
 * gives line (haul.js), so they never take any. The last two are the big ones: fresh,
 * they pull harder than the reel holds, and less than breaks the line (snap.js).
 */
const KINDS = {
  dorade: [
    { size: 0.78, runFresh: 2.8, runSpent: 1.3, rest: 0.5, tire: 1.9, runFor: 0.55, thump: 0.9, beat: [0.1, 0.16], load: 0.11 },
    { size: 0.95, runFresh: 3.8, runSpent: 1.6, rest: 0.7, tire: 1.6, runFor: 0.65, thump: 1.2, beat: [0.11, 0.18], load: 0.17 },
    { size: 1.2, runFresh: 8, runSpent: 2.4, rest: 1.2, tire: 1.1, runFor: 0.95, thump: 2, beat: [0.15, 0.24], load: 0.28 },
    { size: 1.4, runFresh: 9.8, runSpent: 2.8, rest: 1.6, tire: 0.9, runFor: 1.1, thump: 2.6, beat: [0.17, 0.28], load: 0.36 },
  ],
};

const mix = (a, b, t) => a + (b - a) * t;

/**
 * The fish of this species and body size. Sizes off either end of the table read as the
 * end row. Returns a new object with the columns above, plus kind and size.
 */
export function fishOf(kind, size) {
  const rows = KINDS[kind];
  if (!rows) throw new Error(`No such fish: ${kind}`);
  let i = 1;
  while (i < rows.length - 1 && size > rows[i].size) i += 1;
  const a = rows[i - 1];
  const b = rows[i];
  const t = Math.min(1, Math.max(0, (size - a.size) / (b.size - a.size)));
  return {
    kind,
    size,
    runFresh: mix(a.runFresh, b.runFresh, t),
    runSpent: mix(a.runSpent, b.runSpent, t),
    rest: mix(a.rest, b.rest, t),
    tire: mix(a.tire, b.tire, t),
    runFor: mix(a.runFor, b.runFor, t),
    thump: mix(a.thump, b.thump, t),
    beat: [mix(a.beat[0], b.beat[0], t), mix(a.beat[1], b.beat[1], t)],
    load: mix(a.load, b.load, t),
  };
}

// The hardest any fish of any kind pulls, N. The line's breaking point has to stay above it.
export const HARDEST_RUN = Math.max(...Object.values(KINDS).flat().map((row) => row.runFresh));
