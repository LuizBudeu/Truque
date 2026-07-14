/** Graveyard modal — public discard pile, inspectable at any time (Rulebook 2.11). */

import { cardHTML } from './card.js';

export function graveyardHTML(view, t) {
  const cards = view.graveyard.length
    ? view.graveyard.map((c) => cardHTML(c, { small: true })).join('')
    : `<p class="hint">${t('grave.empty')}</p>`;
  // data-action="noop" keeps clicks inside the panel from hitting the backdrop.
  return `
    <div class="modal-backdrop" data-action="close-graveyard">
      <div class="modal vellum" data-action="noop">
        <h2>${t('grave.title', { n: view.graveyard.length })}</h2>
        <div class="graveyard-cards">${cards}</div>
        <button type="button" data-action="close-graveyard">${t('common.close')}</button>
      </div>
    </div>`;
}
