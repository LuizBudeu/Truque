/**
 * Hidden-information filtering: getPlayerView(state, playerIndex).
 *
 * The server never broadcasts full state — every client message carrying game
 * data goes through this single function. No other code path may serialize a
 * player's hidden cards for the opponent (PLANNING.md §3.4); test/views.test.js
 * asserts this for every phase. The RNG cursor and deck ORDER are hidden too:
 * decks are exposed as counts only.
 *
 * @typedef {import('./reducer.js').GameState} GameState
 * @typedef {import('./cards.js').Card} Card
 */

import { DANGER_SPACES } from './rules.js';

/**
 * What one player is allowed to see:
 * - own hand and own pending pick: full cards; opponent hand: count only
 * - decks: counts only
 * - opponent's pending pick: committed flag only — never the card, EXCEPT the
 *   danger-zone open play where the rules require early reveal (Rulebook 2.9 /
 *   §10 Q8), surfaced as `openCard`
 * - manilha, positions, graveyard, swaps, lastResolution: public
 *
 * @typedef {Object} PlayerView
 * @property {0|1} playerIndex - whose view this is
 * @property {string} phase
 * @property {number} round
 * @property {number|null} manilha
 * @property {Card|null} manilhaCard
 * @property {[number, number]} positions
 * @property {Card[]} hand - own cards
 * @property {number} opponentHandCount
 * @property {number} playDeckCount
 * @property {number} manilhaDeckCount
 * @property {Card[]} graveyard - public (Rulebook 2.11)
 * @property {[number, number]} swapsRemaining - public (swapped cards are revealed)
 * @property {[boolean, boolean]} swapDone
 * @property {boolean} selfCommitted
 * @property {boolean} opponentCommitted
 * @property {Card|null} selfPick - own committed card
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
  const opponent = 1 - playerIndex;
  const endangered = [0, 1].map((p) => state.positions[p] === DANGER_SPACES[p]);
  // Rulebook 2.9: open play only when exactly ONE player is endangered; the
  // revealed card belongs to the non-endangered player and only the
  // endangered player gets to see it early.
  const openPlay = state.phase === 'PICK_CARDS' && endangered[0] !== endangered[1];
  const openPlayer = endangered[0] ? 1 : 0;
  const openCard =
    openPlay && playerIndex !== openPlayer && state.pendingPicks[openPlayer]
      ? { ...state.pendingPicks[openPlayer] }
      : null;

  return {
    playerIndex,
    phase: state.phase,
    round: state.round,
    manilha: state.manilha,
    manilhaCard: state.manilhaCard ? { ...state.manilhaCard } : null,
    positions: [...state.positions],
    hand: state.hands[playerIndex].map((c) => ({ ...c })),
    opponentHandCount: state.hands[opponent].length,
    playDeckCount: state.playDeck.length,
    manilhaDeckCount: state.manilhaDeck.length,
    graveyard: state.graveyard.map((c) => ({ ...c })),
    swapsRemaining: [...state.swapsRemaining],
    swapDone: [...state.swapDone],
    selfCommitted: state.pendingPicks[playerIndex] !== null,
    opponentCommitted: state.pendingPicks[opponent] !== null,
    selfPick: state.pendingPicks[playerIndex] ? { ...state.pendingPicks[playerIndex] } : null,
    openCard,
    lastResolution: state.lastResolution ? structuredClone(state.lastResolution) : null,
    winner: state.winner,
  };
}
