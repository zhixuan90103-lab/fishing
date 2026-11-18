/**
 * Leading a hooked fish with the rod.
 *
 * Owns: how fast a rod carried to one side of a fish brings it round that way, and how
 * hard the angler is hauling against one that will not come.
 * Does not own: where the rod points (the phone, handed in), the fish's own course
 * (course.js) or pull (fight.js), or what a hard-working hand looks like (strain.js gets
 * the second number, the rod shows it).
 * No Three, no scene: it runs in Node. Rule: docs/FISHING-REQUIREMENTS.md section 11.
 * Design: docs/PLAY.md section 8.
 *
 * The line draws a fish's head over toward where the rod points, and it swims across
 * that way. But only a fish that is not fighting can be led. Resting, it comes. In a run
 * it does not: hauling the rod against it is a trial of strength, and all it does is
 * load the line and the hand. So a fish that has run out of the picture is brought back
 * once it rests or is spent, not before.
 *
 * Units: metres, seconds, radians. Level directions are (x, z) unit vectors.
 */

// How fast a resting fish comes across with the rod square to it, m/s.
const LED_REST = 2.6;
// In a run: fresh, it does not come at all. Worn right out, at this share of that.
const LED_SPENT = 0.3;
// A rod within this of pointing at the fish, radians, leads it nowhere: it takes a pull
// meant as one.
const LED_FROM = 10 * Math.PI / 180;

/**
 * (toX, toZ): the direction from the rod tip out to the fish. (rodX, rodZ): the
 * direction the rod points, or 0, 0 for unknown. running, stamina: the fish's.
 * Writes out.across: how fast the rod brings it across the line, m/s, positive to the
 * left of the line out to it. And out.against: how hard the rod is being hauled against
 * a fish that will not come, 0 to 1.
 */
export function leadFish(toX, toZ, rodX, rodZ, running, stamina, out) {
  // How far the rod points to the left of the fish's bearing.
  const rodOff = Math.atan2(rodZ * toX - rodX * toZ, rodX * toX + rodZ * toZ);
  const pull = rodX || rodZ ? Math.min(Math.PI / 2, Math.max(0, Math.abs(rodOff) - LED_FROM)) : 0;
  const yields = running ? LED_SPENT * (1 - stamina) : 1;
  out.across = Math.sin(pull) * Math.sign(rodOff) * LED_REST * yields;
  out.against = Math.sin(pull) * (1 - yields);
  return out;
}
