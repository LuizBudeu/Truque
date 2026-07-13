/** The active seat's hand: selectable cards, swap budget, own committed pick. */

import { cardHTML } from './card.js';

export function handHTML(view, ui, { online = false } = {}) {
  const cards = view.hand
    .map((card, index) =>
      cardHTML(card, { action: 'select-card', index, selected: ui.selected.includes(index) }),
    )
    .join('');
  const played = view.selfPick
    ? `<div class="self-pick"><span>You played</span>${cardHTML(view.selfPick, { small: true })}</div>`
    : '';
  const name = online ? 'Your hand' : `Player ${view.playerIndex + 1}'s hand`;
  return `
    <section class="hand-zone">
      <div class="hand-meta">
        <h3>${name}</h3>
        <span class="status-chip">Swaps left ${view.swapsRemaining[view.playerIndex]}</span>
        ${played}
      </div>
      <div class="hand">${cards}</div>
    </section>`;
}
