/** The active seat's hand: selectable cards plus the own committed pick. */

import { cardHTML } from './card.js';

export function handHTML(view, ui) {
  const cards = view.hand
    .map((card, index) =>
      cardHTML(card, { action: 'select-card', index, selected: ui.selected.includes(index) }),
    )
    .join('');
  const played = view.selfPick
    ? `<div class="self-pick">You played: ${cardHTML(view.selfPick)}</div>`
    : '';
  return `
    <section class="hand-zone">
      <h3>Player ${view.playerIndex + 1}'s hand</h3>
      <div class="hand">${cards}</div>
      ${played}
    </section>`;
}
