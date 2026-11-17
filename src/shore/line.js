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
 * tip. Everything else follows. Slack is the length minus the gap. With slack the line
 * hangs in a catenary and pulls nothing. Without it the line is straight, and stretched
 * by however much the gap exceeds it. The tension is that stretch times the line's
 * stiffness, and the rod works it out, not this file: see setTipTether in rodFlex.js.
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
import { hangLine } from './lineCurve.js';

// Points drawn between the tip and the far end. More makes a deep sag smoother.
const HANG_POINTS = 48;
// One pixel wide whatever the distance: a real line is far thinner than a pixel.
const COLOR = 0xe6efe9;
const OPACITY = 0.6;
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
  const material = new THREE.LineBasicMaterial({ color: COLOR, transparent: true, opacity: OPACITY });
  const object = new THREE.Line(geometry, material);
  object.name = 'fishing-line';
  object.frustumCulled = false;

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

    update() {
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
      slack = hangLine(tip.x, tip.y, tip.z, end.x, end.y, end.z, length, positions, hangAt, HANG_POINTS + 1);
      geometry.attributes.position.needsUpdate = true;
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
