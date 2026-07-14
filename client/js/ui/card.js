/** Card element builders — the one place a Card becomes HTML. */

const RANK_LABELS = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };

export function rankLabel(rank) {
  return RANK_LABELS[rank] ?? String(rank);
}

/**
 * Every visible suit mark goes through this element: the actual character
 * comes from CSS (`.suit-glyph[data-suit]::before`), so the fantasy-suit
 * theme (♠→🗡 ♦→🏹 ♥→🔮 ♣→💀) is a pure presentation switch — one class on
 * the screen root — and the renderers stay theme-agnostic.
 */
export function suitGlyphHTML(suit) {
  return `<i class="suit-glyph" data-suit="${suit}"></i>`;
}

/** Court cards and the ace show their letter as the centerpiece; number
 *  cards show the suit glyph large (the rulebook's weapon-class emblem). */
const isCourt = (rank) => rank >= 11;

/**
 * @param {{rank: number, suit: string}} card
 * @param {{selected?: boolean, action?: string|null, index?: number, small?: boolean, spark?: string|null}} [opts]
 *   With `action` set the card is an interactive button carrying
 *   data-action/data-index; otherwise it is a static element. `spark` is the
 *   label for the gold star pinned to the card — set it only when the card
 *   rules the round (see handHTML); it is the caller's job to know that.
 * @returns {string}
 */
export function cardHTML(
  card,
  { selected = false, action = null, index = null, small = false, spark = null } = {},
) {
  const cls = ['card', `suit-${card.suit}`, selected && 'selected', small && 'small', spark && 'sparked']
    .filter(Boolean)
    .join(' ');
  const rank = rankLabel(card.rank);
  const corner = `<span class="card-corner"><b>${rank}</b>${suitGlyphHTML(card.suit)}</span>`;
  const center = isCourt(card.rank)
    ? `<span class="card-center court">${rank}</span>`
    : `<span class="card-center">${suitGlyphHTML(card.suit)}</span>`;
  const star = spark ? `<span class="card-spark" title="${spark}"></span>` : '';
  const inner = `${corner}${center}<span class="card-corner mirrored"><b>${rank}</b>${suitGlyphHTML(card.suit)}</span>${star}`;
  const identity = `data-card="${card.rank}-${card.suit}"`;
  if (action === null) return `<span class="${cls}" ${identity}>${inner}</span>`;
  return `<button type="button" class="${cls}" ${identity} data-action="${action}" data-index="${index}">${inner}</button>`;
}

/** A face-down card: carries NO identity attribute — backs must never leak. */
export function cardBackHTML({ small = false } = {}) {
  const cls = ['card', 'card-back', small && 'small'].filter(Boolean).join(' ');
  return `<span class="${cls}"><span class="card-back-emblem">❖</span></span>`;
}

/**
 * A card wrapped for a 3D flip. Rendered face-up (the final state); when the
 * animation executor adds `.animate` to an ancestor, CSS plays back → front.
 */
export function flipCardHTML(card, opts = {}) {
  return `<span class="flip"><span class="flip-inner"><span class="flip-face flip-back">${cardBackHTML(opts)}</span><span class="flip-face flip-front">${cardHTML(card, opts)}</span></span></span>`;
}
