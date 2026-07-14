/**
 * The manicule (☞) — the game's single attention pointer.
 *
 * A scribe drew a pointing hand in the margin to say "here: THIS is the thing".
 * Here it marks whatever the game is currently waiting on, and it is the only
 * mark on the screen allowed to do so: it sits by the opponent's name while it
 * is on them, by your hand while you must choose a card, and by the prompt when
 * there is a button to press. It never appears twice.
 *
 * WHERE it points is decided by `maniculeFocus()` in render.js, from the view
 * alone. This module only draws it.
 */

/** @param {{idle?: boolean}} [opts] - idle: sway gently (it is waiting on you) */
export function maniculeHTML({ idle = true } = {}) {
  return `<span class="manicule${idle ? ' idle' : ''}" aria-hidden="true">☞</span>`;
}
