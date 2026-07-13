/**
 * Table piles (left cluster in Figure 2): the face-down draw pile and the
 * graveyard. The graveyard pile is the button that opens the full modal —
 * the discard is public at any time (Rulebook 2.11).
 */

import { cardBackHTML, cardHTML } from './card.js';

export function pilesHTML(view, t) {
  const top = view.graveyard.at(-1);
  const graveTop = top
    ? cardHTML(top, { small: true })
    : '<span class="card small pile-empty"></span>';
  return `
    <div class="pile-cluster">
      <div class="pile">
        <div class="pile-cards">${view.playDeckCount > 0 ? cardBackHTML({ small: true }) : '<span class="card small pile-empty"></span>'}</div>
        <span class="pile-label">${t('piles.deck')} <b>${view.playDeckCount}</b></span>
      </div>
      <button type="button" class="pile as-button" data-action="open-graveyard">
        <div class="pile-cards">${graveTop}</div>
        <span class="pile-label">${t('piles.graveyard')} <b>${view.graveyard.length}</b></span>
      </button>
    </div>`;
}
