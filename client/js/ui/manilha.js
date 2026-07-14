/**
 * The manilha (Rulebook 2.7), at the centre of the field sheet's top row.
 *
 * A ♣ card is drawn face-down and turned over, but what it leaves behind is a
 * RULING — "every seven rules this round" — not a card in play. So it resolves
 * into a wax seal stamped on the sheet: the ruling rank, pressed in red wax.
 * A face card or an Ace rules nothing, and the wax sets grey and void.
 *
 * The seal keeps the flip machinery from card.js (a face-down back turning
 * over) so the executor in main.js can still animate the per-round reveal by
 * adding `.animate` to `.manilha-slot`.
 */

import { cardBackHTML, rankLabel } from './card.js';

/** The turned card's face: a seal bearing the rank that rules the round. */
function sealHTML(rank, { voided = false } = {}) {
  return `<span class="seal${voided ? ' void' : ''}"><span class="seal-rank">${rankLabel(rank)}</span></span>`;
}

/** A seal that has to be turned over first: back → front, like the card it was. */
function flipSealHTML(face) {
  return `<span class="flip"><span class="flip-inner"><span class="flip-face flip-back">${cardBackHTML()}</span><span class="flip-face flip-front">${face}</span></span></span>`;
}

export function manilhaHTML(view, t) {
  let slot;
  let note;
  if (!view.manilhaCard) {
    // Nothing drawn yet: the wax is not pressed, so the seal is only its outline.
    slot = '<span class="seal empty"></span>';
    note = t('manilha.beforeReveal');
  } else if (view.manilha === null) {
    // Rulebook 2.7: face cards and A cannot be manilha — the wax is void.
    slot = flipSealHTML(sealHTML(view.manilhaCard.rank, { voided: true }));
    note = t('manilha.faceCard');
  } else {
    slot = flipSealHTML(sealHTML(view.manilha));
    note = t('manilha.everyRank', { rank: rankLabel(view.manilha) });
  }
  return `
    <div class="manilha-panel">
      <div class="manilha-slot">${slot}</div>
      <div class="seal-label">${t('manilha.title')}</div>
      <div class="manilha-note">${note}</div>
    </div>`;
}
