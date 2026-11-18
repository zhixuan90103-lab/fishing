/**
 * One short line of text over the view that shows for a moment and fades.
 *
 * Owns: the element and its timing.
 * Does not own: what is said or when. startShore.js decides both. The game tells the
 * player what to do through the rod, the fish and the hand, not in words: the one thing
 * said this way is that the line has broken (docs/FISHING-REQUIREMENTS.md section 16).
 */

// How long the line stays up, and how long it takes to fade, ms.
const SHOWN_FOR = 2600;
const FADE_FOR = 500;

/** container: the stage, holding #ui-root. */
export function mountNotice(container) {
  const root = container.querySelector('#ui-root') || container;
  const el = document.createElement('p');
  el.className = 'shore-notice';
  el.style.cssText = `position:absolute;left:50%;top:34%;transform:translateX(-50%);margin:0;padding:10px 18px;border-radius:999px;background:rgba(0,0,0,0.55);color:#fff;font:600 17px/1.2 sans-serif;white-space:nowrap;pointer-events:none;opacity:0;transition:opacity ${FADE_FOR}ms;z-index:3;`;
  root.appendChild(el);
  let hideAt = 0;

  return {
    say(text) {
      el.textContent = text;
      el.style.opacity = '1';
      clearTimeout(hideAt);
      hideAt = setTimeout(() => { el.style.opacity = '0'; }, SHOWN_FOR);
    },
    remove() {
      clearTimeout(hideAt);
      el.remove();
    },
  };
}
