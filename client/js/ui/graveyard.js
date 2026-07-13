/** Graveyard modal — public discard pile, inspectable at any time (Rulebook 2.11). */

import { cardHTML } from './card.js';

export function graveyardHTML(view) {
  const cards = view.graveyard.length
    ? view.graveyard.map((c) => cardHTML(c, { small: true })).join('')
    : '<p class="hint">Empty — no cards discarded yet.</p>';
  // data-action="noop" keeps clicks inside the panel from hitting the backdrop.
  return `
    <div class="modal-backdrop" data-action="close-graveyard">
      <div class="modal" data-action="noop">
        <h2>Graveyard (${view.graveyard.length})</h2>
        <div class="graveyard-cards">${cards}</div>
        <button type="button" data-action="close-graveyard">Close</button>
      </div>
    </div>`;
}
