/** Manilha cluster (right side in Figure 2): the ♣ pile and the drawn card,
 *  flip-ready so the executor can animate the per-round reveal. */

import { cardBackHTML, flipCardHTML, rankLabel, suitGlyphHTML } from './card.js';

export function manilhaHTML(view, t) {
  let slot;
  let note;
  if (!view.manilhaCard) {
    slot = '<span class="card pile-empty"></span>';
    note = t('manilha.beforeReveal');
  } else if (view.manilha === null) {
    // Rulebook 2.7: face cards and A cannot be manilha.
    slot = flipCardHTML(view.manilhaCard);
    note = t('manilha.faceCard');
  } else {
    slot = flipCardHTML(view.manilhaCard);
    note = t('manilha.everyRank', { rank: rankLabel(view.manilha) });
  }
  return `
    <div class="manilha-panel">
      <h3>${t('manilha.title')}</h3>
      <div class="manilha-row">
        <div class="pile">
          <div class="pile-cards">${cardBackHTML()}</div>
          <span class="pile-label">${suitGlyphHTML('clubs')} ${t('manilha.pile')}</span>
        </div>
        <div class="manilha-slot">${slot}</div>
      </div>
      <div class="manilha-note">${note}</div>
    </div>`;
}
