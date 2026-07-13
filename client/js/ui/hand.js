/** The active seat's hand: selectable cards, swap budget, own committed pick. */

import { cardHTML } from './card.js';

export function handHTML(view, ui, { t, online = false } = {}) {
  const cards = view.hand
    .map((card, index) =>
      cardHTML(card, { action: 'select-card', index, selected: ui.selected.includes(index) }),
    )
    .join('');
  const played = view.selfPick
    ? `<div class="self-pick"><span>${t('hand.youPlayed')}</span>${cardHTML(view.selfPick, { small: true })}</div>`
    : '';
  const name = online ? t('hand.yours') : t('hand.playerN', { n: view.playerIndex + 1 });
  return `
    <section class="hand-zone">
      <div class="hand-meta">
        <h3>${name}</h3>
        <span class="status-chip">${t('chip.swapsLeft', { n: view.swapsRemaining[view.playerIndex] })}</span>
        ${played}
      </div>
      <div class="hand">${cards}</div>
    </section>`;
}
