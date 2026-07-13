/**
 * Hidden-information filtering: getPlayerView(state, playerIndex).
 *
 * The server never broadcasts full state — every client message carrying game
 * data goes through this single function. No other code path may serialize a
 * player's hidden cards for the opponent (PLANNING.md §3.4); test/views.test.js
 * asserts this for every phase.
 *
 * @typedef {import('./reducer.js').GameState} GameState
 * @typedef {import('./cards.js').Card} Card
 */

/**
 * What one player is allowed to see:
 * - own hand: full cards; opponent hand: count only
 * - decks: counts only
 * - opponent's pending pick: committed flag only — never the card, EXCEPT the
 *   danger-zone open play where the rules require early reveal (Rulebook 2.9 /
 *   §10 Q8), surfaced here as `openCard`
 * - manilha, positions, graveyard, lastResolution, swapsRemaining: public
 *
 * @typedef {Object} PlayerView
 * @property {0|1} playerIndex - whose view this is
 * @property {string} phase
 * @property {number} round
 * @property {number|null} manilha
 * @property {[number, number]} positions
 * @property {Card[]} hand - own cards
 * @property {number} opponentHandCount
 * @property {number} playDeckCount
 * @property {number} manilhaDeckCount
 * @property {Card[]} graveyard - public (Rulebook 2.11)
 * @property {[number, number]} swapsRemaining
 * @property {boolean} selfCommitted
 * @property {boolean} opponentCommitted
 * @property {Card|null} openCard - opponent's revealed pick in danger-zone open play
 * @property {?Object} lastResolution
 * @property {0|1|'draw'|null} winner
 */

/**
 * Produce the filtered view of `state` for one player.
 *
 * @param {GameState} state
 * @param {0|1} playerIndex
 * @returns {PlayerView}
 */
export function getPlayerView(state, playerIndex) {
  throw new Error('Not implemented (Phase 1)');
}
