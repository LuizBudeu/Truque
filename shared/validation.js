/**
 * Legality checks: which actions a given player may take in the current state.
 *
 * Used by the server to reject illegal client actions before they reach the
 * reducer, and by the client to enable/disable UI affordances (legal-move
 * hints). Pure module.
 *
 * @typedef {import('./reducer.js').GameState} GameState
 * @typedef {import('./reducer.js').Action} Action
 */

/**
 * Check whether `action` by `playerIndex` is legal in `state`.
 *
 * Covers at minimum: phase gating, turn/commit order (including the
 * danger-zone open-play sequence, Rulebook 2.9), card ownership, swap budget
 * (max 4 per game, Rulebook 2.10), and winner-move ranges (0–2 base, 0–5
 * with Q, K push placement — Rulebook 2.4/2.8).
 *
 * @param {GameState} state
 * @param {0|1} playerIndex
 * @param {Action} action
 * @returns {{ legal: boolean, reason?: string }} reason is set when illegal
 */
export function isLegalAction(state, playerIndex, action) {
  throw new Error('Not implemented (Phase 1)');
}
