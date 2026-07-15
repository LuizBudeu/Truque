/**
 * View diffing → animation plan (Phase 4).
 *
 * Pure and DOM-free so the choreography is testable in Node: given the
 * previously rendered PlayerView and the next one, return an ordered list of
 * steps. main.js — the only module allowed to touch the DOM — executes them
 * (class toggles + FLIP transforms) after rendering the FINAL state, so
 * animations are pure decoration: a click mid-animation always hits real UI.
 * Never touches game state — views only (PLANNING.md §8).
 *
 * Step shapes:
 * - { type: 'reveal', duration }
 *     Both picks flip face-up; the winner glow and modifier breakdown are
 *     choreographed by CSS delays under a single `.animate` class.
 * - { type: 'pawn-slide', moves: [{ player, from, to }], duration }
 *     One step per transition; simultaneous moves (tie retreat) share it.
 * - { type: 'board-shrink', from, to, duration }
 *     V2 only: the board bounds narrowed on a reshuffle; the removed edge spaces
 *     collapse away. `from`/`to` are the { min, max } extents.
 * - { type: 'manilha-flip', duration }
 *     The new round's manilha card flips over.
 */

/** Per-step durations (ms) — single source of truth for executor waits.
 *  Keep in sync with the CSS animation/transition timings. */
export const DURATIONS = {
  reveal: 1200,
  pawnSlide: 520,
  boardShrink: 560,
  manilhaFlip: 600,
};

const sameCard = (a, b) => !!a && !!b && a.rank === b.rank && a.suit === b.suit;

/**
 * Build the animation plan for one view transition.
 *
 * Returns [] when there is nothing to animate or the pair is not comparable:
 * first render after (re)connect, or a hotseat seat switch (the views belong
 * to different players, so a diff would animate the wrong perspective).
 *
 * @param {import('../../shared/views.js').PlayerView|null} prev
 * @param {import('../../shared/views.js').PlayerView|null} next
 * @returns {Array<Object>}
 */
export function buildAnimationPlan(prev, next) {
  if (!prev || !next) return [];
  if (prev.playerIndex !== next.playerIndex) return [];

  const steps = [];

  // Reveal: the round resolved, i.e. we left PICK_CARDS with a resolution in
  // hand. A concession also leaves PICK_CARDS but resolves nothing — skip it.
  if (
    prev.phase === 'PICK_CARDS' &&
    next.phase !== 'PICK_CARDS' &&
    next.lastResolution !== null &&
    next.concededBy === null
  ) {
    steps.push({ type: 'reveal', duration: DURATIONS.reveal });
  }

  // Pawn movement — after the reveal so cards flip before pieces slide.
  const moves = [];
  for (const player of [0, 1]) {
    if (prev.positions[player] !== next.positions[player]) {
      moves.push({ player, from: prev.positions[player], to: next.positions[player] });
    }
  }
  if (moves.length > 0) {
    steps.push({ type: 'pawn-slide', moves, duration: DURATIONS.pawnSlide });
  }

  // Board shrink (V2): the bounds narrowed on a reshuffle. After the pawns settle,
  // the removed edge spaces collapse away.
  if (prev.bounds && next.bounds && (prev.bounds.min !== next.bounds.min || prev.bounds.max !== next.bounds.max)) {
    steps.push({
      type: 'board-shrink',
      from: { ...prev.bounds },
      to: { ...next.bounds },
      duration: DURATIONS.boardShrink,
    });
  }

  // A new manilha was drawn (null during SWAP_WINDOW, a card from DRAW_MANILHA
  // on). Fires on the SWAP_WINDOW → PICK_CARDS transition each round.
  if (next.manilhaCard !== null && !sameCard(prev.manilhaCard, next.manilhaCard)) {
    steps.push({ type: 'manilha-flip', duration: DURATIONS.manilhaFlip });
  }

  return steps;
}
