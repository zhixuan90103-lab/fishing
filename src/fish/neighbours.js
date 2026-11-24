/**
 * What each free fish can tell from the fish around it.
 *
 * Owns: for every free fish, the way its near neighbours are heading, how fast and how
 * deep they are, which way the fish it can see lie, how many are near, and whether one
 * right beside it has just bolted.
 * Does not own: what the fish does with any of it (behaviors.js), or giving way to a
 * fish that is too close (measureCrowd in swim.js).
 * No Three, no scene: it runs in Node. Design: docs/FISH-SCHOOL.md section 3.
 *
 * A fish knows only this. Nothing here is about the school as a whole: there is no
 * centre, no shared heading and no leader. A school is what forty fish doing this make.
 * A fish does not see what is right behind it. Fish that someone has taken out of the
 * school are seen by nobody: a fish on a line does not lead the others about.
 *
 * Units: metres, radians.
 */

import { FREE } from './states.js';

// Near neighbours: a fish takes its heading, speed and depth from fish within this, the
// nearer the more.
export const SEE = 3.2;
// It can make out fish this far off, and is drawn toward them, the further the less.
const SEE_FAR = 12;
// Closer than this a neighbour draws it no nearer.
const SPACING = 1.1;
// A metre up or down counts as this many metres: a school is flatter than it is wide.
const DEPTH_COUNTS = 1.6;
// It does not see fish within this cosine of straight behind.
const BLIND = -0.75;
// A neighbour that bolts within this startles it.
const ALARM_RANGE = 1.5;

export function makeSense(count) {
  return {
    // Mean heading of near neighbours, a level vector of length 0 to 1.
    alignX: new Float64Array(count),
    alignZ: new Float64Array(count),
    // Mean speed, m/s, and depth, m, of near neighbours. Only when near is above 0.
    speed: new Float64Array(count),
    y: new Float64Array(count),
    // How many near neighbours, weighed by how near.
    near: new Float64Array(count),
    // Which way the fish it can see lie and are too far: a level vector of length 0 to 1.
    toX: new Float64Array(count),
    toZ: new Float64Array(count),
    // It can see at least one other fish.
    seen: new Uint8Array(count),
    // How many fish right beside it are bolting.
    alarm: new Float64Array(count),
    // Scratch: each fish's heading as a level vector, worked out once a frame.
    headX: new Float64Array(count),
    headZ: new Float64Array(count),
  };
}

export function senseNeighbours(fishes, sense) {
  const n = fishes.length;
  const { headX, headZ } = sense;
  for (let i = 0; i < n; i++) {
    headX[i] = Math.sin(fishes[i].yaw);
    headZ[i] = Math.cos(fishes[i].yaw);
  }
  const far2 = SEE_FAR * SEE_FAR;
  for (let i = 0; i < n; i++) {
    const a = fishes[i];
    let alignX = 0, alignZ = 0, speed = 0, y = 0, near = 0, toX = 0, toZ = 0, drawn = 0, seen = 0, alarm = 0;
    if (a.state === FREE) {
      const fx = headX[i];
      const fz = headZ[i];
      for (let j = 0; j < n; j++) {
        if (j === i) continue;
        const b = fishes[j];
        if (b.state !== FREE) continue;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const dy = (b.y - a.y) * DEPTH_COUNTS;
        const level2 = dx * dx + dz * dz;
        const d2 = level2 + dy * dy;
        if (d2 > far2 || level2 < 1e-12) continue;
        const level = Math.sqrt(level2);
        const d = Math.sqrt(d2);
        if (d > 0.5 && (dx * fx + dz * fz) / level < BLIND) continue;
        seen = 1;
        if (d < SEE) {
          const w = 1 - d / SEE;
          alignX += headX[j] * w;
          alignZ += headZ[j] * w;
          speed += b.speed * w;
          y += b.y * w;
          near += w;
          if (b.darting && d < ALARM_RANGE) alarm += 1;
        }
        if (d > SPACING) {
          // Rising to full at the edge of near sight, then falling off with distance.
          const pull = d < SEE ? (d - SPACING) / (SEE - SPACING) : SEE / d;
          toX += (dx / level) * pull;
          toZ += (dz / level) * pull;
          drawn += pull;
        }
      }
    }
    sense.alignX[i] = near > 0 ? alignX / near : 0;
    sense.alignZ[i] = near > 0 ? alignZ / near : 0;
    sense.speed[i] = near > 0 ? speed / near : 0;
    sense.y[i] = near > 0 ? y / near : 0;
    sense.near[i] = near;
    sense.toX[i] = drawn > 0 ? toX / drawn : 0;
    sense.toZ[i] = drawn > 0 ? toZ / drawn : 0;
    sense.seen[i] = seen;
    sense.alarm[i] = alarm;
  }
}
