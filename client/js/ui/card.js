/** Card element builder — the one place a Card becomes HTML. */

const RANK_LABELS = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
const SUIT_GLYPHS = { hearts: '♥', diamonds: '♦', spades: '♠', clubs: '♣' };

export function rankLabel(rank) {
  return RANK_LABELS[rank] ?? String(rank);
}

/**
 * @param {{rank: number, suit: string}} card
 * @param {{selected?: boolean, action?: string|null, index?: number, small?: boolean}} [opts]
 *   With `action` set the card is an interactive button carrying
 *   data-action/data-index; otherwise it is a static element.
 * @returns {string}
 */
export function cardHTML(card, { selected = false, action = null, index = null, small = false } = {}) {
  const cls = ['card', `suit-${card.suit}`, selected && 'selected', small && 'small']
    .filter(Boolean)
    .join(' ');
  const inner = `<span class="card-rank">${rankLabel(card.rank)}</span><span class="card-suit">${SUIT_GLYPHS[card.suit]}</span>`;
  const identity = `data-card="${card.rank}-${card.suit}"`;
  if (action === null) return `<span class="${cls}" ${identity}>${inner}</span>`;
  return `<button type="button" class="${cls}" ${identity} data-action="${action}" data-index="${index}">${inner}</button>`;
}
