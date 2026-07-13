/**
 * Client state container and model derivation.
 *
 * Hotseat mode: holds the authoritative GameState — the client IS the server
 * — and dispatches through the shared reducer. Online mode (Phase 3) never
 * touches this state: main.js feeds server views straight to buildViewModel.
 * Either way rendering only ever sees a PlayerView, so hidden information
 * stays filtered exactly the same offline and online.
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

/** Hotseat entry point: filter the full state for a seat, then derive the model. */
export function buildModel(state, seat, ui) {
  return buildViewModel(getPlayerView(state, seat), ui);
}

/**
 * Build the render model from a PlayerView: the view, the UI state, and —
 * during WINNER_MOVE — the legality of every move option so the renderer can
 * disable buttons. Legality is derived from the view's PUBLIC fields alone
 * (phase, positions, lastResolution), which is exactly why this works both
 * in hotseat and online, where the server view is all the client has.
 *
 * @param {import('../../shared/views.js').PlayerView} view
 * @param {Object} ui - {curtain, selected, offset, push, graveyardOpen}
 * @param {Object} [extra] - mode-specific model fields (e.g. online, banner)
 */
export function buildViewModel(view, ui, extra = {}) {
  const seat = view.playerIndex;
  const model = { screen: 'game', seat, view, ui, ...extra };

  if (view.phase === 'WINNER_MOVE' && view.lastResolution.winner === seat) {
    const resolution = view.lastResolution;
    // The public slice of state that CHOOSE_MOVE legality depends on.
    const publicState = {
      phase: view.phase,
      positions: view.positions,
      lastResolution: resolution,
    };
    const isPush = resolution.loserEffect.type === 'K_PUSH';
    const offsets = [];
    for (let value = -resolution.winnerMoveRange; value <= resolution.winnerMoveRange; value++) {
      const action = { type: 'CHOOSE_MOVE', player: seat, selfOffset: value };
      if (isPush) action.pushAmount = ui.push;
      offsets.push({ value, legal: isLegalAction(publicState, seat, action).legal });
    }
    model.move = {
      offsets,
      pushes: isPush ? [0, 1, 2, 3] : null,
      range: resolution.winnerMoveRange,
    };
  }
  return model;
}
