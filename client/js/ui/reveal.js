/** Round-result panel: both revealed cards, values, special-rule badges, outcome. */

import { cardHTML } from './card.js';

export function revealHTML(resolution) {
  const badges = [];
  if (resolution.manilha !== null && resolution.cards.some((c) => c.rank === resolution.manilha)) {
    badges.push('Manilha played — worth 14');
  }
  if (resolution.buffsRemoved) badges.push('K removed the distance modifiers');
  if (resolution.usedSuitCycle) badges.push('Decided by suit order');
  if (resolution.inverted) badges.push('J inverted the result!');

  const outcome =
    resolution.winner === 'tie'
      ? 'Tie — both pawns retreat 1'
      : `Player ${resolution.winner + 1} wins the round`;
  const effect = resolution.loserEffect ? ` — ${effectText(resolution)}` : '';

  return `
    <div class="reveal">
      <div class="reveal-cards">
        <div class="reveal-side">
          <span class="reveal-label">P1</span>
          ${cardHTML(resolution.cards[0])}
          <span class="reveal-value">= ${resolution.effectiveValues[0]}</span>
        </div>
        <span class="reveal-vs">vs</span>
        <div class="reveal-side">
          <span class="reveal-label">P2</span>
          ${cardHTML(resolution.cards[1])}
          <span class="reveal-value">= ${resolution.effectiveValues[1]}</span>
        </div>
      </div>
      ${badges.length ? `<div class="badges">${badges.map((b) => `<span class="badge">${b}</span>`).join('')}</div>` : ''}
      <div class="reveal-outcome">${outcome}${effect}</div>
    </div>`;
}

function effectText(resolution) {
  const loser = `Player ${2 - resolution.winner}`;
  switch (resolution.loserEffect.type) {
    case 'RETREAT':
      return `${loser} retreats ${resolution.loserEffect.amount}`;
    case 'RETURN_TO_FIRST':
      return `${loser} returns to their first space (lost with K)`;
    case 'K_PUSH':
      return `the winner pushes ${loser} up to 3 spaces`;
    default:
      return '';
  }
}
