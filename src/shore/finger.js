/**
 * The player's one finger, and its desktop stand-ins.
 *
 * Owns: whether a pointer is down on the view, whether the space bar is down, and
 * reporting how far a pressed pointer has dragged.
 * Does not own: what a press means, which of the two counts as the finger, or what a
 * drag does. startShore.js decides those: a drag turns the view only without a phone.
 * Design: docs/PLAY.md section 11.
 *
 * On a phone the finger is the touch. On a desktop a press on the view is how the view
 * is turned, so it cannot also be the finger: the space bar is.
 */

/** element: what is pressed, the visible canvas. */
export function createFinger(element) {
  let touching = false;
  let key = false;
  let dragged = null;

  const onDown = (e) => {
    touching = true;
    element.setPointerCapture(e.pointerId);
  };
  const onUp = () => {
    touching = false;
  };
  const onMove = (e) => {
    if (touching && dragged) dragged(e.movementX, e.movementY);
  };
  const onKey = (e) => {
    if (e.code !== 'Space') return;
    key = e.type === 'keydown';
    e.preventDefault();
  };
  element.addEventListener('pointerdown', onDown);
  element.addEventListener('pointerup', onUp);
  element.addEventListener('pointercancel', onUp);
  element.addEventListener('pointermove', onMove);
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);

  return {
    // A pointer is down on the view.
    get touching() {
      return touching;
    },
    // The space bar is down.
    get key() {
      return key;
    },
    // Call fn(dx, dy), CSS pixels, each time a pressed pointer moves.
    onDrag(fn) {
      dragged = fn;
    },
    dispose() {
      element.removeEventListener('pointerdown', onDown);
      element.removeEventListener('pointerup', onUp);
      element.removeEventListener('pointercancel', onUp);
      element.removeEventListener('pointermove', onMove);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
    },
  };
}
