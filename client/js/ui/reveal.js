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
 * @param {Object} opts
 * @param {(key: string, params?: object) => any} opts.t - bound translator
 * @param {[string, string]} opts.labels - side names by player index (built by
 *   render.js: ['Player 1','Player 2'] in hotseat, 'You'/'Opponent' online).
 * @param {0|1|null} [opts.youIndex] - the local player's side, for conjugation
 *   and the "You win" phrasing; null in hotseat.
 * @param {boolean} [opts.small] - small cards for the sidebar placement
 */
export function revealHTML(resolution, { t, labels, youIndex = null, small = false }) {
  const badges = [];
  if (resolution.manilha !== null && resolution.cards.some((c) => c.rank === resolution.manilha)) {
    badges.push(t('reveal.manilhaPlayed'));
  }
  if (resolution.buffsRemoved) badges.push(t('reveal.kRemoved'));
  if (resolution.usedSuitCycle) badges.push(t('reveal.suitOrder'));
  if (resolution.inverted) badges.push(t('reveal.jInverted'));

  const outcome =
    resolution.winner === 'tie'
      ? t('reveal.tie')
      : resolution.winner === youIndex
        ? t('reveal.youWin')
        : t('reveal.winsRound', { label: labels[resolution.winner] });
  const effect = resolution.loserEffect ? ` — ${effectText(resolution, labels, youIndex, t)}` : '';

  const side = (player) => {
    const winner = resolution.winner === player ? ' winner' : '';
    return `
      <div class="reveal-side side-p${player}${winner}">
        <span class="reveal-label">${labels[player]}</span>
        ${flipCardHTML(resolution.cards[player], { small })}
        <span class="breakdown">${breakdownHTML(resolution, player, t)}</span>
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
function breakdownHTML(resolution, player, t) {
  const card = resolution.cards[player];
  const total = `<b>= ${resolution.effectiveValues[player]}</b>`;
  if (resolution.manilha !== null && card.rank === resolution.manilha) {
    return `${t('reveal.manilhaWord')} ${total}`;
  }
  const base = `${rankLabel(card.rank)}${suitGlyphHTML(card.suit)}`;
  const mod = resolution.buffsRemoved ? 0 : distanceModifier(card.suit, resolution.distance);
  if (mod === 0) return `${base} ${total}`;
  return `${base} <em>${signed(mod)} ${t('reveal.dist')}</em> ${total}`;
}

function effectText(resolution, labels, youIndex, t) {
  const loserIndex = 1 - resolution.winner;
  const loser = labels[loserIndex];
  const winner = labels[resolution.winner];
  // Online labels say "You": conjugate for second person when the loser is us.
  const you = loserIndex === youIndex;
  switch (resolution.loserEffect.type) {
    case 'RETREAT':
      return t('effect.retreat', { loser, winner, you, n: resolution.loserEffect.amount });
    case 'RETURN_TO_FIRST':
      return t('effect.returnToFirst', { loser, winner, you });
    case 'K_PUSH':
      return t('effect.kPush', { loser, winner, you });
    default:
      return '';
  }
}
