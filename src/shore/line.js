/**
 * The fishing line: one thin strand from the reel, up the guides, out of the rod tip and
 * on to wherever its far end is.
 *
 * Owns: drawing that strand, and tying the rod tip to the far end with it, so a taut
 * line bends the rod.
 * Does not own: the shape of the hanging part (lineCurve.js), where the guides are
 * (rod.js), how the rod answers the pull (rodFlex.js), where the far end goes, how much
 * line is out, or any fishing rule.
 *
 * The outside gives two things: where the far end is, and how much line is out past the
 * tip. The pull follows from those alone. Slack is the length minus the gap. With slack
 * the line pulls nothing. Without it the line is stretched by however much the gap
 * exceeds it, and the tension is that stretch times the line's stiffness: the rod works
 * it out, not this file, see setTipTether in rodFlex.js.
 * What the line looks like is another matter and is simulated: lineCurve.js. It is told
 * the two ends, the length and the pull, and nothing about loose or tight: how slack it
 * lies comes of what has happened to it. That is only drawn. It never changes the pull.
 *
 * Each frame, after rod.update(): read the guides, draw, hand the rod the end and length
 * for its next step.
 *
 * A far end that cannot hold the tip back (a lure in the air, or hanging under the tip)
 * is drawn the same but not tied: setTied(false).
 *
 * With the line wound right in, the far end is not a place in the world at all: it sits
 * at the tip and goes wherever the tip goes. stow() says so, and the end is then taken
 * from this frame's tip, so it cannot trail a fast swing by a frame.
 *
 * Everything is in world space. Units: metres, newtons.
 */

import * as THREE from 'three/webgpu';
import { createLineCurve } from './lineCurve.js';

// Points drawn between the tip and the far end. More makes a deep sag smoother, and the
// string they are simulated as slower to settle.
const HANG_POINTS = 48;
// One pixel wide whatever the distance: a real line is far thinner than a pixel.
const COLOR = 0xe6efe9;
const OPACITY = 0.6;
// Under the water the line fades: it is this many metres down before it is at about a
// third of its strength. A line as bright below the surface as above it reads as lying
// on the water, and a lure sinking on it looks as if it were sliding in toward the rod.
const FADE_DEPTH = 0.45;
// How hard the line resists stretching: newtons to stretch it by its own length. About
// right for 0.25 mm nylon. A longer line is softer end to end, as a real one is.
const STRETCH_FORCE = 120;
// The line is not allowed stiffer than this end to end, N/m. Short lines would otherwise
// be far stiffer than the rod, which is the soft part anyway.
const STIFFEST = 60;

export function createFishingLine(rod) {
  // The strand: `stops` points along the rod, then HANG_POINTS more out to the far end.
  // The last stop is the tip, and the hanging part starts from it.
  const stops = rod.lineStops;
  const positions = new Float32Array((stops + HANG_POINTS) * 3);
  const hangAt = (stops - 1) * 3;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  // White with its own strength at every point: 1 in the air, less the deeper it lies.
  const shade = new Float32Array((stops + HANG_POINTS) * 4).fill(1);
  geometry.setAttribute('color', new THREE.BufferAttribute(shade, 4));
  const material = new THREE.LineBasicMaterial({ color: COLOR, transparent: true, opacity: OPACITY, vertexColors: true });
  const object = new THREE.Line(geometry, material);
  object.name = 'fishing-line';
  object.frustumCulled = false;

  // The hanging part's shape, simulated.
  const curve = createLineCurve(HANG_POINTS + 1);
  const hang = new Float64Array((HANG_POINTS + 1) * 3);
  const path = Array.from({ length: stops }, () => new THREE.Vector3());
  const tip = new THREE.Vector3();
  const end = new THREE.Vector3();
  let length = 0;
  let slack = 0;
  // tighten() asks for the length to be taken from the gap. That needs the tip, so it
  // waits for the next update. null: nothing asked.
  let fitSpare = 0;
  // Whether the far end can hold the tip back.
  let tied = true;
  // Wound right in: the far end rides this far straight below the tip. null: it is a
  // place in the world, given by setEnd.
  let stowed = null;
  const stiffnessAt = (metres) => Math.min(STIFFEST, STRETCH_FORCE / Math.max(metres, 1e-3));

  return {
    object,
    // World space. tip is where the line leaves the rod. Both valid after update().
    tip,
    end,
    // Line out past the tip, metres.
    get length() {
      return length;
    },
    // Line out minus the straight gap from tip to end, metres. Above zero the line hangs
    // loose. Below zero it is stretched by that much and pulling.
    get slack() {
      return slack;
    },
    // How hard the line pulls on the rod tip right now, newtons. 0 while it is loose.
    // What a given tension means (line runs out, line breaks) is the caller's rule.
    get tension() {
      return rod.tipTension;
    },

    // How hard the line pulls per metre it is stretched, at the length now out, N/m.
    get stiffness() {
      return stiffnessAt(length);
    },

    // Whether the far end can hold the tip back. In the water, or on a fish, it can. A
    // lure in the air or hanging under the tip cannot: the line is drawn and pulls nothing.
    setTied(yes) {
      tied = yes;
    },
    // Where the far end is: the lure, or the fish's mouth.
    setEnd(x, y, z) {
      end.set(x, y, z);
      stowed = null;
    },
    // Wound right in: the far end rides `drop` metres straight below the tip, and that is
    // all the line there is out. `end` is valid after the next update(). setEnd undoes it.
    stow(drop) {
      stowed = drop;
    },
    // How much line is out past the tip, metres.
    setLength(metres) {
      length = Math.max(0, metres);
      fitSpare = null;
    },
    // Take the length from where the ends are at the next update: just taut, plus `spare`.
    // A negative spare leaves the line shorter than the gap, so it starts out pulling.
    tighten(spare = 0) {
      fitSpare = spare;
    },

    // dt: seconds since the last update, for the hanging part's own motion.
    update(dt) {
      rod.linePath(path);
      for (let i = 0; i < stops; i += 1) path[i].toArray(positions, i * 3);
      tip.copy(path[stops - 1]);
      if (stowed !== null) {
        end.set(tip.x, tip.y - stowed, tip.z);
        length = stowed;
        fitSpare = null;
      }
      if (fitSpare !== null) {
        length = tip.distanceTo(end) + fitSpare;
        fitSpare = null;
      }
      // Wound right in there is nothing to hang: the string starts afresh at the next cast.
      if (stowed !== null) curve.reset();
      slack = curve.step(dt, tip.x, tip.y, tip.z, end.x, end.y, end.z, length, tied ? rod.tipTension : 0, hang, 0);
      positions.set(hang, hangAt);
      for (let i = 0; i < stops + HANG_POINTS; i += 1) {
        const depth = -positions[i * 3 + 1];
        shade[i * 4 + 3] = depth > 0 ? Math.exp(-depth / FADE_DEPTH) : 1;
      }
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.color.needsUpdate = true;
      if (tied) rod.setTipTether(end, length, stiffnessAt(length));
      else rod.setTipTether(null);
    },

    dispose() {
      rod.setTipTether(null);
      geometry.dispose();
      material.dispose();
    },
  };
}
