/**
 * Legality checks: which actions a given player may take in the current state.
 *
 * Used by the server to reject illegal client actions before they reach the
 * reducer (the reducer also gates on this and throws), and by the client to
 * enable/disable UI affordances. Pure module.
 *
 * @typedef {import('./reducer.js').GameState} GameState
 * @typedef {import('./reducer.js').Action} Action
 */

import { cardEquals } from './cards.js';
import {
  retreatTarget,
  clampToDanger,
  DANGER_SPACES,
  ADVANCE_DIR,
  BOARD_SIZE,
} from './rules.js';

const LEGAL = { legal: true };
const illegal = (reason) => ({ legal: false, reason });

/**
 * Check whether `action` by `playerIndex` is legal in `state`.
 *
 * @param {GameState} state
 * @param {0|1} playerIndex - the acting player as known by the caller (the
 *   server uses its socket→player mapping; must match action.player)
 * @param {Action} action
 * @returns {{ legal: boolean, reason?: string }}
 */
export function isLegalAction(state, playerIndex, action) {
  if (!action || typeof action.type !== 'string') return illegal('malformed action');
  if (state.phase === 'GAME_OVER') return illegal('game is over');
  if (playerIndex !== 0 && playerIndex !== 1) return illegal('invalid player');
  if (action.player !== playerIndex) return illegal('action.player does not match acting player');

  switch (action.type) {
    case 'SWAP_CARDS':
      return checkSwapCards(state, action);
    case 'SKIP_SWAP':
      return checkSkipSwap(state, action);
    case 'PLAY_CARD':
      return checkPlayCard(state, action);
    case 'CHOOSE_MOVE':
      return checkChooseMove(state, action);
    default:
      return illegal(`unknown action type ${action.type}`);
  }
}

/** Rulebook 2.10: 1+ own cards, within the per-game budget, window still open. */
function checkSwapCards(state, { player, cards }) {
  if (state.phase !== 'SWAP_WINDOW') return illegal('not in the swap window');
  if (state.swapDone[player]) return illegal('swap window already closed for this player');
  if (!Array.isArray(cards) || cards.length === 0) return illegal('must swap at least one card');
  if (cards.length > state.swapsRemaining[player]) {
    return illegal(`only ${state.swapsRemaining[player]} swaps remaining`);
  }
  for (let i = 0; i < cards.length; i++) {
    if (!isCard(cards[i])) return illegal('malformed card');
    if (!state.hands[player].some((c) => cardEquals(c, cards[i]))) {
      return illegal('card not in hand');
    }
    if (cards.some((c, j) => j !== i && cardEquals(c, cards[i]))) {
      return illegal('duplicate card in swap request');
    }
  }
  return LEGAL;
}

function checkSkipSwap(state, { player }) {
  if (state.phase !== 'SWAP_WINDOW') return illegal('not in the swap window');
  if (state.swapDone[player]) return illegal('swap window already closed for this player');
  return LEGAL;
}

/**
 * Rulebook 2.9: when exactly one player is on their danger space, the
 * opponent plays open — they must commit before the endangered player.
 * Both endangered → normal simultaneous play.
 */
function checkPlayCard(state, { player, card }) {
  if (state.phase !== 'PICK_CARDS') return illegal('not in the pick phase');
  if (state.pendingPicks[player]) return illegal('already committed a card');
  if (!isCard(card)) return illegal('malformed card');
  if (!state.hands[player].some((c) => cardEquals(c, card))) return illegal('card not in hand');

  const endangered = [0, 1].map((p) => state.positions[p] === DANGER_SPACES[p]);
  if (endangered[0] !== endangered[1]) {
    const openPlayer = endangered[0] ? 1 : 0;
    if (player !== openPlayer && !state.pendingPicks[openPlayer]) {
      return illegal('opponent must play open first (danger zone)');
    }
  }
  return LEGAL;
}

/**
 * Winner's move: |selfOffset| within the resolution's range, landing on the
 * board (a winner never retreats off their own end, §10 Q14) and never
 * passing or sharing a space with the opponent. pushAmount 0–3 is required
 * exactly when the winner played K (Rulebook 2.8).
 */
function checkChooseMove(state, { player, selfOffset, pushAmount }) {
  if (state.phase !== 'WINNER_MOVE') return illegal('no winner move pending');
  const resolution = state.lastResolution;
  if (resolution.winner !== player) return illegal('only the round winner moves');

  if (!Number.isInteger(selfOffset) || Math.abs(selfOffset) > resolution.winnerMoveRange) {
    return illegal(`selfOffset must be an integer within ±${resolution.winnerMoveRange}`);
  }

  const loser = 1 - player;
  let loserPos = state.positions[loser];
  let loserEliminated = false;
  if (resolution.loserEffect.type === 'K_PUSH') {
    if (!Number.isInteger(pushAmount) || pushAmount < 0 || pushAmount > resolution.loserEffect.maxPush) {
      return illegal(`pushAmount must be an integer 0–${resolution.loserEffect.maxPush}`);
    }
    if (pushAmount > 0 && loserPos === DANGER_SPACES[loser]) {
      loserEliminated = true; // Rulebook 2.8: already on the last space (§10 Q14)
    } else {
      loserPos = clampToDanger(loser, retreatTarget(loser, loserPos, pushAmount));
    }
  } else if (pushAmount !== undefined && pushAmount !== 0) {
    return illegal('pushAmount only applies when the winner played K');
  }

  const target = state.positions[player] + ADVANCE_DIR[player] * selfOffset;
  if (target < 0 || target >= BOARD_SIZE) return illegal('move leaves the board');
  if (!loserEliminated) {
    const passes = player === 0 ? target >= loserPos : target <= loserPos;
    if (passes) return illegal('cannot pass or share a space with the opponent');
  }
  return LEGAL;
}

function isCard(card) {
  return (
    card !== null &&
    typeof card === 'object' &&
    Number.isInteger(card.rank) &&
    typeof card.suit === 'string'
  );
}
