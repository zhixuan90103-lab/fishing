/**
 * The button that asks to read the phone's motion.
 *
 * Owns: the button, what it says, and taking itself away once it is not needed.
 * Does not own: asking the browser (phoneLook.js) or what the motion is used for.
 * startShore.js hands in the asking and says when the phone has started answering.
 *
 * A browser only lets a page read a phone's motion after a tap, so there has to be
 * something to tap. This is that and nothing else: it is not a hint about how to play.
 */

const ASK = '允许手机转动';
const REFUSED = '没有转动权限，仍用拖动看画面';

/** root: #ui-root, or null. ask: returns a promise of whether the phone may be read. */
export function mountPhoneAsk(root, ask) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = ASK;
  button.style.cssText = 'position:absolute;left:50%;top:16px;transform:translateX(-50%);margin:0;padding:10px 16px;border:0;border-radius:999px;background:rgba(0,0,0,0.55);color:#fff;font:15px/1.2 sans-serif;pointer-events:auto;z-index:3;';
  root?.appendChild(button);
  let asked = false;
  button.addEventListener('click', () => {
    if (asked) return;
    asked = true;
    ask().then((ok) => {
      if (ok) button.remove();
      else button.textContent = REFUSED;
    });
  });
  return {
    // The phone is answering: nothing left to ask.
    done() { button.remove(); },
    remove() { button.remove(); },
  };
}
