/**
 * The Legacy ruleset: the finalized rules the designers signed off, and the base
 * every other ruleset extends.
 *
 * A ruleset is a plain policy object — data plus pure seam functions the reducer
 * calls at its points of variation. Stating Legacy explicitly (rather than as a
 * default branch) is what lets the engine stay free of `ruleset === …` checks: it
 * always calls the seam, and Legacy's seam happens to be today's behavior.
 *
 * @typedef {import('../cards.js').Card} Card
 * @typedef {import('../reducer.js').GameState} GameState
 *
 * @typedef {Object} Ruleset
 * @property {string} id
 * @property {{ min: number, max: number }} initialBounds - board extent at game start
 * @property {(card: Card, opponentCard: Card|null, distance: number) => number} suitModifier
 * @property {(state: GameState, reshuffled: boolean) => GameState} onReshuffle
 */

import { legacySuitModifier, DEFAULT_BOUNDS } from '../rules.js';

/** @type {Ruleset} */
export const legacy = {
  id: 'legacy',
  initialBounds: DEFAULT_BOUNDS,
  suitModifier: legacySuitModifier,
  // The board never changes in Legacy — reshuffles are invisible to geometry.
  onReshuffle: (state, _reshuffled) => state,
};
