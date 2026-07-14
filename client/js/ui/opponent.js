/**
 * The head of the field sheet (top of the table, per Figure 2): who you face,
 * their hand face-down, their swap budget, and a "card committed" cue during
 * the secret pick. Never receives card data — only counts and flags from the
 * PlayerView.
 */

import { cardBackHTML } from './card.js';
import { maniculeHTML } from './manicule.js';

/** @param {{manicule?: boolean}} opts - manicule: the game is waiting on them */
export function opponentHTML(view, { t, online = false, manicule = false } = {}) {
  const name = online ? t('player.opponent') : t('player.n', { n: 2 - view.playerIndex });
  const backs = Array.from({ length: view.opponentHandCount }, () =>
    cardBackHTML({ small: true }),
  ).join('');
  const committed =
    view.phase === 'PICK_CARDS' && view.opponentCommitted
      ? `<span class="status-chip committed">${t('chip.committed')}</span>`
      : '';
  return `
    <div class="sheet-head">
      ${manicule ? maniculeHTML() : ''}
      <span class="who">${name}</span>
      <div class="opponent-hand">${backs}</div>
      ${committed}
      <span class="status-chip">${t('chip.swapsLeft', { n: view.swapsRemaining[1 - view.playerIndex] })}</span>
    </div>`;
}
