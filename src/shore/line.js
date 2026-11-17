/**
 * The fishing line: one thin strand from the reel, up the guides, out of the rod tip and
 * on to wherever its far end is.
 *
 * Owns: drawing that strand, and tying the rod tip to the far end with it, so a taut
 * line bends the rod.
 * Does not own: the shape of the hanging part (lineCurve.js), where the guides are
 * (rod.js), how the rod answers the pull (rodFlex.js), where the far end goes, how much
 * line is out, or any fishing rule. The outside sets the end and the length through
 * setEnd and setLength. The tension follows from those two and from where the tip is.
 *
 * Along the rod the line is straight from stop to stop: the reel's line roller, then
 * every guide ring. From the tip to the far end it hangs by how much line is out:
 * a catenary when there is more than the gap, straight when there is not.
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
  const stops = rod.lineStops;
  const points = stops + HANG_POINTS;
  const positions = new Float32Array(points * 3);
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
  // Set by tighten(): take the length from the gap on the next update.
  let spare = 0;

  return {
    object,
    // World space. tip is where the line leaves the rod. Both valid after update().
    tip,
    end,
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
    // Line out past the tip, metres.
    get length() {
      return length;
    },

    // Where the far end is: the lure, or the fish's mouth.
    setEnd(x, y, z) {
      end.set(x, y, z);
    },
    // How much line is out past the tip, metres.
    setLength(metres) {
      length = Math.max(0, metres);
      spare = null;
    },
    // Set the length from where the ends are at the next update: just taut, plus `extra`.
    tighten(extra = 0) {
      spare = extra;
    },

    // Call after rod.update(): the line follows the guides as they are this frame.
    update() {
      rod.linePath(path);
      for (let i = 0; i < stops; i += 1) path[i].toArray(positions, i * 3);
      tip.copy(path[stops - 1]);
      if (spare !== null) {
        length = tip.distanceTo(end) + spare;
        spare = null;
      }
      const at = (stops - 1) * 3;
      slack = hangLine(tip.x, tip.y, tip.z, end.x, end.y, end.z, length, positions, at, HANG_POINTS + 1);
      geometry.attributes.position.needsUpdate = true;

      // The rod works out the pull itself, inside its own small steps, from where its tip
      // is against this end and length.
      rod.setTipTether(end, length, Math.min(STIFFEST, STRETCH_FORCE / Math.max(length, 1e-3)));
    },

    dispose() {
      rod.setTipTether(null);
      geometry.dispose();
      material.dispose();
    },
  };
}
