/**
 * The V2 ruleset: Legacy plus two mechanics playtesting suggested. Written as
 * overrides over `legacy` — it changes only two seams and delegates everything
 * else back to the base, so no logic is duplicated (see PLANNING §7).
 *
 *   1. Board shrink on reshuffle — each time the play deck is exhausted and the
 *      graveyard is reshuffled in, both board edges retract by one space. A pawn
 *      on a removed space slides inward (never an instant loss). Compresses long
 *      games; pressures the trailing player, so it hastens a decisive ending.
 *   2. Scaled-triangle magic — ♥ stops being a flat neutral; its modifier tracks
 *      the opponent's suit through the existing suit cycle, scaled by distance.
 *
 * @typedef {import('./legacy.js').Ruleset} Ruleset
 * @typedef {import('../cards.js').Card} Card
 */

import { legacy } from './legacy.js';
import { distanceModifier, boardSize } from '../rules.js';

/** Smallest board the shrink will leave: two distinct danger spaces. */
const MIN_BOARD_WIDTH = 2;

/**
 * ♥ (magic) as a scaled triangle. Its magnitude is the opponent suit's current
 * distance-modifier magnitude; its sign follows the suit cycle — ♥ beats ♦ (`+`),
 * ♠ beats ♥ (`−`), ♥ vs ♥ is 0. So magic is neutral mid-board (all modifiers 0)
 * and a real value swing at the extremes, always aimed at the opponent's suit.
 * Rulebook V2; sign convention per PLANNING §10.
 *
 * @param {Card|null} opponentCard
 * @param {number} distance
 * @returns {number}
 */
function magicModifier(opponentCard, distance) {
  if (!opponentCard || opponentCard.suit === 'hearts') return 0;
  const magnitude = Math.abs(distanceModifier(opponentCard.suit, distance));
  return opponentCard.suit === 'diamonds' ? magnitude : -magnitude; // beats ♦, loses to ♠
}

/** @type {Ruleset} */
export const v2 = {
  ...legacy,
  id: 'v2',

  suitModifier(card, opponentCard, distance) {
    return card.suit === 'hearts'
      ? magicModifier(opponentCard, distance)
      : legacy.suitModifier(card, opponentCard, distance);
  },

  onReshuffle(state, reshuffled) {
    if (!reshuffled) return state;
    const newMin = state.bounds.min + 1;
    const newMax = state.bounds.max - 1;
    // Stop before the board gets narrower than two spaces — a game this long has
    // its pawns pinned already; the floor just prevents a degenerate board.
    if (boardSize({ min: newMin, max: newMax }) < MIN_BOARD_WIDTH) return state;

    // Compact the pawns inward: any pawn on a removed edge slides to the new
    // edge, pushing the other along if they collide, always keeping p0 < p1.
    let [p0, p1] = state.positions;
    p0 = Math.max(p0, newMin);
    p1 = Math.max(p1, p0 + 1);
    p1 = Math.min(p1, newMax);
    p0 = Math.min(p0, p1 - 1);

    return { ...state, bounds: { min: newMin, max: newMax }, positions: [p0, p1] };
  },
};
