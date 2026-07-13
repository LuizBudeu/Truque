/**
 * Game state machine: createInitialState + applyAction.
 *
 * Pure module. State is never mutated — every transition returns new objects
 * (plain spreads). The same reducer runs on the server (authoritative) and on
 * the client (hotseat mode, optimistic checks).
 *
 * @typedef {import('./cards.js').Card} Card
 */

/**
 * Round phases, in loop order. Names mirror the rulebook (PLANNING.md §3.2).
 * SWAP_WINDOW precedes DRAW_MANILHA: swaps happen "while the next manilha is
 * not yet revealed" (Rulebook 2.10 / §10 Q6).
 */
export const PHASES = [
  'ROUND_START',
  'SWAP_WINDOW',
  'DRAW_MANILHA',
  'PICK_CARDS',
  'REVEAL',
  'RESOLVE',
  'WINNER_MOVE',
  'DRAW_CARDS',
  'GAME_OVER',
];

/**
 * Full game state — server-side truth. Clients only ever see the filtered
 * view from views.js.
 *
 * Board: 12 spaces, indices 0–11. Player 0's danger space is 0, player 1's
 * is 11 (Rulebook 2.9). Starting positions are one space from center each,
 * two spaces apart (Rulebook 2.3, Figure 1): positions [4, 7].
 *
 * @typedef {Object} GameState
 * @property {string} phase - one of PHASES
 * @property {number} round - 1-based round counter
 * @property {number|null} manilha - manilha rank 2–10, or null (face card / A drawn, Rulebook 2.7)
 * @property {[number, number]} positions - board index per player
 * @property {[Card[], Card[]]} hands - 4 cards each (Rulebook 2.3)
 * @property {Card[]} playDeck
 * @property {Card[]} manilhaDeck
 * @property {Card[]} graveyard - public discard, reshuffled into playDeck when it empties (Rulebook 2.11)
 * @property {[number, number]} swapsRemaining - 4 per player per game (Rulebook 2.10)
 * @property {[Card|null, Card|null]} pendingPicks - committed picks this round
 * @property {?Object} lastResolution - Resolution from rules.js, for client animation
 * @property {0|1|'draw'|null} winner - simultaneous elimination is a draw (§10 Q9)
 */

/**
 * Actions accepted by the reducer. Drafted set (finalized in Phase 1):
 * - { type: 'SWAP_CARDS', player, cards: Card[] }      SWAP_WINDOW, Rulebook 2.10
 * - { type: 'SKIP_SWAP', player }                      SWAP_WINDOW
 * - { type: 'PLAY_CARD', player, card: Card }          PICK_CARDS; when exactly one
 *     player is on their danger space, the opponent must commit AND reveal first
 *     (Rulebook 2.9 / §10 Q8), making picks sequential that round
 * - { type: 'CHOOSE_MOVE', player, offset }            WINNER_MOVE, Rulebook 2.4/2.8
 * - { type: 'ADVANCE' }                                system tick for automatic phases
 *     (DRAW_MANILHA, REVEAL, RESOLVE, DRAW_CARDS)
 *
 * @typedef {Object} Action
 * @property {string} type
 * @property {0|1} [player]
 */

/**
 * Build the initial state for a fresh game: both decks shuffled with the
 * seeded RNG, 4 cards dealt to each player, pawns at [4, 7], phase ROUND_START.
 *
 * @param {number} seed - RNG seed chosen by the server (or test)
 * @returns {GameState}
 */
export function createInitialState(seed) {
  throw new Error('Not implemented (Phase 1)');
}

/**
 * Apply an action to the state and return the next state. Throws (or returns
 * a rejection — decided in Phase 1) on illegal actions; callers should gate
 * with validation.js first. Never mutates `state`.
 *
 * @param {GameState} state
 * @param {Action} action
 * @returns {GameState}
 */
export function applyAction(state, action) {
  throw new Error('Not implemented (Phase 1)');
}
