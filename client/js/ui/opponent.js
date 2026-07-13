/**
 * Opponent row (top of the table, per Figure 2): their hand face-down, swap
 * budget, and a "card committed" cue during the secret pick. Never receives
 * card data — only counts and flags from the PlayerView.
 */

import { cardBackHTML } from './card.js';

export function opponentHTML(view, { t, online = false } = {}) {
  const name = online ? t('player.opponent') : t('player.n', { n: 2 - view.playerIndex });
  const backs = Array.from({ length: view.opponentHandCount }, () =>
    cardBackHTML({ small: true }),
  ).join('');
  const committed =
    view.phase === 'PICK_CARDS' && view.opponentCommitted
      ? `<span class="status-chip committed">${t('chip.committed')}</span>`
      : '';
  return `
    <div class="opponent-row">
      <div class="opponent-id">
        <span class="seat-badge seat-${1 - view.playerIndex}">${name}</span>
        <span class="status-chip">${t('chip.swapsLeft', { n: view.swapsRemaining[1 - view.playerIndex] })}</span>
        ${committed}
      </div>
      <div class="opponent-hand">${backs}</div>
    </div>`;
}
