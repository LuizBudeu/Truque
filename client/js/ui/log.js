/**
 * Round-history log: a compact, scrollable list of every resolved round —
 * both revealed cards and who won — beyond the detailed last-round panel.
 * Pure model → HTML like the rest of ui/*.js; reads only PUBLIC view fields
 * (view.history holds resolutions, whose cards are already revealed).
 */

import { rankLabel, suitGlyphHTML } from './card.js';

/**
 * @param {import('../../../shared/views.js').PlayerView} view
 * @param {Object} opts
 * @param {(key: string, params?: object) => any} opts.t - bound translator
 * @param {[string, string]} opts.labels - side names by player index
 * @param {0|1|null} [opts.youIndex] - the local player's side (for "You"), or null
 */
export function roundLogHTML(view, { t, labels, youIndex = null }) {
  const history = view.history ?? [];
  if (history.length === 0) return '';

  // Newest round on top — that is the one a returning player cares about.
  const rows = [...history]
    .reverse()
    .map((entry) => logRowHTML(entry, { t, labels, youIndex }))
    .join('');

  return `
    <section class="panel log-panel">
      <h3 class="side-title">${t('side.roundLog')}</h3>
      <ol class="round-log">${rows}</ol>
    </section>`;
}

function logRowHTML(entry, { t, labels, youIndex }) {
  const outcome =
    entry.winner === 'tie'
      ? t('log.tie')
      : entry.winner === youIndex
        ? t('log.youWon')
        : t('log.wonBy', { label: labels[entry.winner] });
  return `
    <li class="log-entry">
      <span class="log-round">${t('log.round', { n: entry.round })}</span>
      <span class="log-cards">
        ${miniCardHTML(entry.cards[0], entry.winner === 0)}
        <span class="log-vs">·</span>
        ${miniCardHTML(entry.cards[1], entry.winner === 1)}
      </span>
      <span class="log-outcome">${outcome}</span>
    </li>`;
}

/** Rank + suit glyph only — a card small enough to sit inline in a log row. */
function miniCardHTML(card, won) {
  return `<span class="log-card suit-${card.suit}${won ? ' won' : ''}">${rankLabel(card.rank)}${suitGlyphHTML(card.suit)}</span>`;
}
