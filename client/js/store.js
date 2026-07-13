/**
 * Hotseat state container and model derivation (Phase 2).
 *
 * Holds the authoritative GameState — in hotseat the client IS the server —
 * and exposes pure helpers to derive what the UI needs. Rendering never reads
 * the raw state: it goes through getPlayerView(state, seat), so hidden
 * information stays filtered exactly as it will be online. In Phase 3 the
 * state moves to the server and this store holds the last received view
 * instead (net.js dispatches, same subscribe API).
 */

import { createInitialState, applyAction } from '../../shared/reducer.js';
import { getPlayerView } from '../../shared/views.js';
import { isLegalAction } from '../../shared/validation.js';
import { DANGER_SPACES } from '../../shared/rules.js';

let state = null;
const listeners = new Set();

export function getState() {
  return state;
}

export function newGame(seed) {
  state = createInitialState(seed);
  emit();
}

/** Apply a game action through the shared reducer. Throws on illegal actions. */
export function dispatch(action) {
  state = applyAction(state, action);
  emit();
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit() {
  for (const listener of listeners) listener(state);
}

/**
 * The seat that must act next, or null when nobody can (GAME_OVER).
 * Hotseat serializes the simultaneous phases: player 0 goes first except when
 * the danger-zone open-play rule forces the opponent of the endangered player
 * to commit first (Rulebook 2.9).
 *
 * @param {import('../../shared/reducer.js').GameState} state
 * @returns {0|1|null}
 */
export function nextSeat(state) {
  switch (state.phase) {
    case 'SWAP_WINDOW':
      if (!state.swapDone[0]) return 0;
      return state.swapDone[1] ? null : 1;
    case 'PICK_CARDS': {
      const endangered = [0, 1].map((p) => state.positions[p] === DANGER_SPACES[p]);
      const order = endangered[0] !== endangered[1] ? (endangered[0] ? [1, 0] : [0, 1]) : [0, 1];
      for (const p of order) if (!state.pendingPicks[p]) return p;
      return null;
    }
    case 'WINNER_MOVE':
      return state.lastResolution.winner;
    default:
      return null;
  }
}

/**
 * Build the render model for one seat: their filtered view, the UI state, and
 * — during WINNER_MOVE — the legality of every move option so the renderer
 * can disable buttons without touching the full state.
 *
 * @param {import('../../shared/reducer.js').GameState} state
 * @param {0|1} seat
 * @param {Object} ui - {curtain, selected, offset, push, graveyardOpen}
 */
export function buildModel(state, seat, ui) {
  const model = { screen: 'game', seat, view: getPlayerView(state, seat), ui };

  if (state.phase === 'WINNER_MOVE' && state.lastResolution.winner === seat) {
    const resolution = state.lastResolution;
    const isPush = resolution.loserEffect.type === 'K_PUSH';
    const offsets = [];
    for (let value = -resolution.winnerMoveRange; value <= resolution.winnerMoveRange; value++) {
      const action = { type: 'CHOOSE_MOVE', player: seat, selfOffset: value };
      if (isPush) action.pushAmount = ui.push;
      offsets.push({ value, legal: isLegalAction(state, seat, action).legal });
    }
    model.move = {
      offsets,
      pushes: isPush ? [0, 1, 2, 3] : null,
      range: resolution.winnerMoveRange,
    };
  }
  return model;
}
