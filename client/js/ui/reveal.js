/**
 * Round-result panel: both revealed cards (flip-ready), the modifier
 * breakdown per side ("9♦ +1 = 10"), special-rule badges, and the outcome
 * with the winner's side highlighted.
 */

import { distanceModifier } from '../../../shared/rules.js';
import { flipCardHTML, rankLabel, suitGlyphHTML } from './card.js';

const signed = (n) => (n > 0 ? `+${n}` : `${n}`);

/**
 * @param {Object} resolution - PlayerView.lastResolution
 * @param {[string, string]} [labels] - side names by player index
 *   (defaults to hotseat wording; online callers pass ['You', 'Opponent']
 *   in seat order).
 * @param {{small?: boolean}} [opts] - small cards for the sidebar placement
 */
export function revealHTML(resolution, labels = ['Player 1', 'Player 2'], { small = false } = {}) {
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
      : labels[resolution.winner] === 'You'
        ? 'You win the round'
        : `${labels[resolution.winner]} wins the round`;
  const effect = resolution.loserEffect ? ` — ${effectText(resolution, labels)}` : '';

  const side = (player) => {
    const winner = resolution.winner === player ? ' winner' : '';
    return `
      <div class="reveal-side side-p${player}${winner}">
        <span class="reveal-label">${labels[player]}</span>
        ${flipCardHTML(resolution.cards[player], { small })}
        <span class="breakdown">${breakdownHTML(resolution, player)}</span>
      </div>`;
  };

  return `
    <div class="reveal">
      <div class="reveal-cards">
        ${side(0)}
        <span class="reveal-vs">⚔</span>
        ${side(1)}
      </div>
      ${badges.length ? `<div class="badges">${badges.map((b) => `<span class="badge">${b}</span>`).join('')}</div>` : ''}
      <div class="reveal-outcome">${outcome}${effect}</div>
    </div>`;
}

/**
 * One side's value math. Every case shows how the effective value came to
 * be, so a spectator can follow the round without the rulebook:
 * manilha → flat 14 (Rulebook 2.7); K → modifiers removed (2.8);
 * otherwise base value plus the distance modifier (2.6, Table 1).
 */
function breakdownHTML(resolution, player) {
  const card = resolution.cards[player];
  const total = `<b>= ${resolution.effectiveValues[player]}</b>`;
  if (resolution.manilha !== null && card.rank === resolution.manilha) {
    return `Manilha ${total}`;
  }
  const base = `${rankLabel(card.rank)}${suitGlyphHTML(card.suit)}`;
  const mod = resolution.buffsRemoved ? 0 : distanceModifier(card.suit, resolution.distance);
  if (mod === 0) return `${base} ${total}`;
  return `${base} <em>${signed(mod)} dist</em> ${total}`;
}

function effectText(resolution, labels) {
  const loser = labels[1 - resolution.winner];
  const winner = labels[resolution.winner];
  // Online labels say "You": conjugate for second person.
  const you = loser === 'You';
  switch (resolution.loserEffect.type) {
    case 'RETREAT':
      return `${loser} ${you ? 'retreat' : 'retreats'} ${resolution.loserEffect.amount}`;
    case 'RETURN_TO_FIRST':
      return `${loser} ${you ? 'return to your' : 'returns to their'} first space (lost with K)`;
    case 'K_PUSH':
      return `${winner} may push ${you ? 'you' : loser} up to 3 spaces`;
    default:
      return '';
  }
}
