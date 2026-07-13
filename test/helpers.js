/**
 * Shared test utilities: card/state fixtures, a legal-action enumerator, a
 * seeded random-game driver, and structural invariant checks. Not a test file
 * (no .test suffix) — the runner ignores it.
 */

import { mulberry32, buildManilhaDeck, cardEquals } from '../shared/cards.js';
import { createInitialState, applyAction, PHASES, HAND_SIZE } from '../shared/reducer.js';
import { isLegalAction } from '../shared/validation.js';

/** Terse card literal: C(13, 'spades') */
export const C = (rank, suit) => ({ rank, suit });

/**
 * A hand-built mid-game state with known hands, ready for PICK_CARDS by
 * default. Override any field; positions [4,7] mean distance 2 (modifier 0).
 */
export function makeState(overrides = {}) {
  return {
    phase: 'PICK_CARDS',
    round: 1,
    manilha: null,
    manilhaCard: C(11, 'clubs'),
    positions: [4, 7],
    hands: [
      [C(2, 'hearts'), C(5, 'spades'), C(9, 'diamonds'), C(12, 'hearts')],
      [C(3, 'hearts'), C(7, 'spades'), C(10, 'diamonds'), C(13, 'hearts')],
    ],
    playDeck: [
      C(4, 'hearts'), C(4, 'spades'), C(4, 'diamonds'),
      C(6, 'hearts'), C(6, 'spades'), C(6, 'diamonds'),
      C(8, 'hearts'), C(8, 'spades'),
    ],
    manilhaDeck: buildManilhaDeck(),
    graveyard: [],
    swapsRemaining: [4, 4],
    swapDone: [true, true],
    pendingPicks: [null, null],
    lastResolution: null,
    winner: null,
    rngState: 1,
    ...overrides,
  };
}

/** Enumerate every legal action for both players in the current state. */
export function legalActions(state) {
  const candidates = [];
  for (const player of [0, 1]) {
    if (state.phase === 'SWAP_WINDOW') {
      candidates.push({ type: 'SKIP_SWAP', player });
      if (state.hands[player].length > 0) {
        candidates.push({ type: 'SWAP_CARDS', player, cards: [state.hands[player][0]] });
      }
    } else if (state.phase === 'PICK_CARDS') {
      for (const card of state.hands[player]) {
        candidates.push({ type: 'PLAY_CARD', player, card });
      }
    } else if (state.phase === 'WINNER_MOVE') {
      const range = state.lastResolution.winnerMoveRange;
      const pushes =
        state.lastResolution.loserEffect.type === 'K_PUSH' ? [0, 1, 2, 3] : [undefined];
      for (let selfOffset = -range; selfOffset <= range; selfOffset++) {
        for (const pushAmount of pushes) {
          candidates.push(
            pushAmount === undefined
              ? { type: 'CHOOSE_MOVE', player, selfOffset }
              : { type: 'CHOOSE_MOVE', player, selfOffset, pushAmount },
          );
        }
      }
    }
  }
  return candidates.filter((a) => isLegalAction(state, a.player, a).legal);
}

/**
 * Play a full seeded game with uniformly random legal actions. Calls
 * onStep(state, action) after every applied action.
 */
export function autoPlay(seed, { maxSteps = 5000, onStep } = {}) {
  const rng = mulberry32(seed ^ 0x9e3779b9);
  let state = createInitialState(seed);
  let steps = 0;
  while (state.winner === null && steps < maxSteps) {
    const actions = legalActions(state);
    if (actions.length === 0) {
      throw new Error(`no legal actions in phase ${state.phase} (round ${state.round})`);
    }
    const action = actions[Math.floor(rng() * actions.length)];
    state = applyAction(state, action);
    onStep?.(state, action);
    steps++;
  }
  return { state, steps };
}

/** Structural invariants that must hold after every single action. */
export function checkInvariants(state) {
  const fail = (msg) => {
    throw new Error(`Invariant violated: ${msg}\n${JSON.stringify(state, null, 2)}`);
  };

  if (!PHASES.includes(state.phase)) fail(`unknown phase ${state.phase}`);

  // Card conservation and uniqueness across all play-card zones (39 total).
  const zones = [
    ...state.hands[0],
    ...state.hands[1],
    ...state.playDeck,
    ...state.graveyard,
    ...state.pendingPicks.filter(Boolean),
  ];
  if (zones.length !== 39) fail(`expected 39 play cards, found ${zones.length}`);
  for (let i = 0; i < zones.length; i++) {
    if (zones.some((c, j) => j !== i && cardEquals(c, zones[i]))) {
      fail(`duplicate card ${zones[i].rank} of ${zones[i].suit}`);
    }
  }
  if (state.manilhaDeck.length !== 13) fail('manilha deck must always hold 13 cards');

  const [p0, p1] = state.positions;
  if (p0 < 0 || p1 > 11) fail(`position off board: [${p0}, ${p1}]`);
  if (p0 >= p1) fail(`pawns passed or share a space: [${p0}, ${p1}]`);

  for (const p of [0, 1]) {
    if (state.hands[p].length > HAND_SIZE) fail(`hand ${p} exceeds ${HAND_SIZE}`);
    if (state.swapsRemaining[p] < 0) fail(`negative swap budget for player ${p}`);
  }
  if (state.manilha !== null && (state.manilha < 2 || state.manilha > 10)) {
    fail(`manilha out of range: ${state.manilha}`);
  }
  if (state.winner !== null && state.phase !== 'GAME_OVER') {
    fail('winner set outside GAME_OVER');
  }
}
