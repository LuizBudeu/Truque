/** Your own sheet, below the spread: selectable cards, swap budget, own pick. */

import { cardHTML } from './card.js';
import { maniculeHTML } from './manicule.js';

/** @param {{manicule?: boolean}} opts - manicule: it is on you to choose a card */
export function handHTML(view, ui, { t, online = false, manicule = false } = {}) {
  // A card of the manilha rank is a flat 14 this round (Rulebook 2.7): it wears
  // a gold star so the ruling on the seal is visible where you are choosing.
  // `view.manilha` is null before the draw and on a void seal, so both are silent.
  const rules = (card) => view.manilha !== null && card.rank === view.manilha;
  const cards = view.hand
    .map((card, index) =>
      cardHTML(card, {
        action: 'select-card',
        index,
        selected: ui.selected.includes(index),
        spark: rules(card) ? t('hand.manilhaCard') : null,
      }),
    )
    .join('');
  const played = view.selfPick
    ? `<div class="self-pick"><span>${t('hand.youPlayed')}</span>${cardHTML(view.selfPick, { small: true })}</div>`
    : '';
  const name = online ? t('hand.yours') : t('hand.playerN', { n: view.playerIndex + 1 });
  return `
    <section class="hand-sheet vellum">
      <div class="hand-head">
        ${manicule ? maniculeHTML() : ''}
        <h3>${name}</h3>
        ${played}
        <span class="status-chip">${t('chip.swapsLeft', { n: view.swapsRemaining[view.playerIndex] })}</span>
      </div>
      <div class="hand">${cards}</div>
    </section>`;
}
