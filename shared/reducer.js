/**
 * Game state machine: createInitialState + applyAction.
 *
 * Pure module. State is never mutated — every transition returns new objects
 * (plain spreads). The same reducer runs on the server (authoritative) and on
 * the client (hotseat mode, optimistic checks).
 *
 * The conceptual round loop (PLANNING.md §3.2) is
 *   ROUND_START → SWAP_WINDOW → DRAW_MANILHA → PICK_CARDS → REVEAL →
 *   RESOLVE → WINNER_MOVE → DRAW_CARDS → ROUND_START
 * but only the phases that WAIT for player input are observable resting
 * states; the automatic steps (manilha draw, reveal, resolution, card draw)
 * resolve atomically inside a transition. So `state.phase` is always one of
 * PHASES below.
 *
 * @typedef {import('./cards.js').Card} Card
 * @typedef {import('./rules.js').Resolution} Resolution
 */

import { mulberry32, shuffle, buildPlayDeck, buildManilhaDeck, cardEquals } from './cards.js';
import {
  resolveCombat,
  distanceBetween,
  retreatTarget,
  isBeyondDanger,
  clampToDanger,
  DANGER_SPACES,
  ADVANCE_DIR,
  START_POSITIONS,
} from './rules.js';
import { isLegalAction } from './validation.js';

/** Observable resting phases (see module comment). */
export const PHASES = ['SWAP_WINDOW', 'PICK_CARDS', 'WINNER_MOVE', 'GAME_OVER'];

/** Cards dealt to each player. Rulebook 2.3. */
export const HAND_SIZE = 4;

/** Swap budget per player per game. Rulebook 2.10. */
export const SWAP_BUDGET = 4;

/**
 * Full game state — server-side truth. Clients only ever see the filtered
 * view from views.js.
 *
 * Board: 12 spaces, indices 0–11. Player 0's danger space is 0 and they
 * advance in +1 direction; player 1's danger space is 11. `positions[0] <
 * positions[1]` always holds — pawns never pass or share a space (§10 Q14).
 *
 * @typedef {Object} GameState
 * @property {'SWAP_WINDOW'|'PICK_CARDS'|'WINNER_MOVE'|'GAME_OVER'} phase
 * @property {number} round - 1-based round counter
 * @property {number|null} manilha - manilha rank 2–10, or null (face card / A drawn, or not yet drawn)
 * @property {Card|null} manilhaCard - the drawn ♣ card, for display
 * @property {[number, number]} positions - board index per player
 * @property {[Card[], Card[]]} hands
 * @property {Card[]} playDeck
 * @property {Card[]} manilhaDeck - all 13 ♣, reshuffled before every draw (Rulebook 2.7)
 * @property {Card[]} graveyard - public discard, reshuffled into playDeck when it empties (Rulebook 2.11)
 * @property {[number, number]} swapsRemaining - of SWAP_BUDGET (Rulebook 2.10)
 * @property {[boolean, boolean]} swapDone - player closed this round's swap window
 *   (auto-closed when their budget is 0)
 * @property {[Card|null, Card|null]} pendingPicks - committed picks this round
 * @property {?(Resolution & {distance: number})} lastResolution - for client animation
 * @property {0|1|'draw'|null} winner - simultaneous elimination is a draw (§10 Q9)
 * @property {0|1|null} concededBy - who conceded, when the game ended that way
 * @property {number} rngState - serializable RNG cursor; advanced by every shuffle
 */

/**
 * Actions accepted by the reducer:
 * - { type: 'SWAP_CARDS', player, cards: Card[] }  SWAP_WINDOW; repeatable while
 *     budget remains (Rulebook 2.10)
 * - { type: 'SKIP_SWAP', player }                  SWAP_WINDOW; "done swapping"
 * - { type: 'PLAY_CARD', player, card: Card }      PICK_CARDS; when exactly one
 *     player is on their danger space, the opponent must commit first and their
 *     card is public (Rulebook 2.9; §10 Q8)
 * - { type: 'CHOOSE_MOVE', player, selfOffset, pushAmount? }  WINNER_MOVE;
 *     selfOffset is advance-positive within ±winnerMoveRange; pushAmount
 *     (0–3) is required exactly when the winner played K
 * - { type: 'CONCEDE', player }                    any phase; immediate loss
 *     (digital-only convenience, not in the rulebook)
 *
 * @typedef {Object} Action
 * @property {string} type
 * @property {0|1} player
 */

/**
 * Build the initial state for a fresh game: play deck shuffled with the
 * seeded RNG, 4 cards dealt to each player, pawns at [4, 7], first round's
 * swap window open.
 *
 * @param {number} seed - RNG seed chosen by the server (or test)
 * @returns {GameState}
 */
export function createInitialState(seed) {
  const { cards: deck, rngState } = shuffled(buildPlayDeck(), seed >>> 0);
  return {
    phase: 'SWAP_WINDOW',
    round: 1,
    manilha: null,
    manilhaCard: null,
    positions: [...START_POSITIONS],
    hands: [deck.slice(0, HAND_SIZE), deck.slice(HAND_SIZE, HAND_SIZE * 2)],
    playDeck: deck.slice(HAND_SIZE * 2),
    manilhaDeck: buildManilhaDeck(),
    graveyard: [],
    swapsRemaining: [SWAP_BUDGET, SWAP_BUDGET],
    swapDone: [false, false],
    pendingPicks: [null, null],
    lastResolution: null,
    winner: null,
    concededBy: null,
    rngState,
  };
}

/**
 * Apply an action and return the next state. Throws on illegal actions —
 * callers wanting a soft check gate with validation.js first (the server
 * turns the throw into a REJECTED message). Never mutates `state`.
 *
 * @param {GameState} state
 * @param {Action} action
 * @returns {GameState}
 */
export function applyAction(state, action) {
  const { legal, reason } = isLegalAction(state, action?.player, action);
  if (!legal) throw new Error(`Illegal action ${action?.type ?? '?'}: ${reason}`);
  switch (action.type) {
    case 'SWAP_CARDS':
      return applySwapCards(state, action);
    case 'SKIP_SWAP':
      return applySkipSwap(state, action);
    case 'PLAY_CARD':
      return applyPlayCard(state, action);
    case 'CHOOSE_MOVE':
      return applyChooseMove(state, action);
    case 'CONCEDE':
      return applyConcede(state, action);
    /* c8 ignore next 2 -- unreachable: validation rejects unknown types */
    default:
      throw new Error(`Unhandled action type ${action.type}`);
  }
}

// ---------------------------------------------------------------------------
// Action handlers
// ---------------------------------------------------------------------------

/** Rulebook 2.10: discard revealed cards to the graveyard, draw the same count. */
function applySwapCards(state, { player, cards }) {
  const kept = state.hands[player].filter((c) => !cards.some((x) => cardEquals(x, c)));
  const discarded = state.hands[player].filter((c) => cards.some((x) => cardEquals(x, c)));
  const afterDraw = draw(
    state.playDeck,
    [...state.graveyard, ...discarded],
    discarded.length,
    state.rngState,
  );
  const swapsRemaining = setIndex(state.swapsRemaining, player, state.swapsRemaining[player] - discarded.length);
  return maybeCloseSwapWindow({
    ...state,
    hands: setIndex(state.hands, player, [...kept, ...afterDraw.drawn]),
    playDeck: afterDraw.playDeck,
    graveyard: afterDraw.graveyard,
    rngState: afterDraw.rngState,
    swapsRemaining,
    // Budget exhausted → nothing left to do in the window.
    swapDone: swapsRemaining[player] === 0 ? setIndex(state.swapDone, player, true) : state.swapDone,
  });
}

function applySkipSwap(state, { player }) {
  return maybeCloseSwapWindow({ ...state, swapDone: setIndex(state.swapDone, player, true) });
}

function applyPlayCard(state, { player, card }) {
  const picked = state.hands[player].find((c) => cardEquals(c, card));
  const next = {
    ...state,
    hands: setIndex(state.hands, player, state.hands[player].filter((c) => !cardEquals(c, card))),
    pendingPicks: setIndex(state.pendingPicks, player, picked),
  };
  // Both committed → reveal and resolve (Rulebook 2.4).
  return next.pendingPicks[0] && next.pendingPicks[1] ? resolveRound(next) : next;
}

/**
 * Immediate loss on request. Digital-only convenience (not in the rulebook):
 * the opponent wins on the spot; `concededBy` lets clients word the result.
 */
function applyConcede(state, { player }) {
  return { ...gameOver(state, 1 - player), concededBy: player };
}

function applyChooseMove(state, { player, selfOffset, pushAmount }) {
  const winner = player;
  const loser = 1 - winner;
  let next = state;

  if (state.lastResolution.loserEffect.type === 'K_PUSH') {
    // Rulebook 2.8: push up to 3, capped at the loser's first space — unless
    // they already stand there, where any push shoves them off (§10 Q14).
    if (pushAmount > 0 && state.positions[loser] === DANGER_SPACES[loser]) {
      return gameOver(state, winner);
    }
    const pushed = clampToDanger(loser, retreatTarget(loser, state.positions[loser], pushAmount));
    next = { ...state, positions: setIndex(state.positions, loser, pushed) };
  }

  const target = next.positions[winner] + ADVANCE_DIR[winner] * selfOffset;
  return finishRound({ ...next, positions: setIndex(next.positions, winner, target) });
}

// ---------------------------------------------------------------------------
// Automatic steps (REVEAL/RESOLVE, DRAW_CARDS, DRAW_MANILHA)
// ---------------------------------------------------------------------------

/** Both picks are in: reveal, resolve combat, apply the loser's forced movement. */
function resolveRound(state) {
  const distance = distanceBetween(state.positions);
  const resolution = resolveCombat([...state.pendingPicks], state.manilha, distance);
  let next = {
    ...state,
    graveyard: [...state.graveyard, ...state.pendingPicks], // Rulebook 2.11
    pendingPicks: [null, null],
    lastResolution: { ...resolution, distance },
  };

  if (resolution.winner === 'tie') {
    // Rulebook 2.4: both retreat 1. On the danger space that means elimination
    // (§10 Q4); both eliminated is a draw (§10 Q9).
    const out = [0, 1].map((p) => next.positions[p] === DANGER_SPACES[p]);
    if (out[0] && out[1]) return gameOver(next, 'draw');
    if (out[0]) return gameOver(next, 1);
    if (out[1]) return gameOver(next, 0);
    next = { ...next, positions: [next.positions[0] - 1, next.positions[1] + 1] };
    return finishRound(next);
  }

  const winner = resolution.winner;
  const loser = 1 - winner;
  const effect = resolution.loserEffect;
  if (effect.type === 'RETREAT') {
    const target = retreatTarget(loser, next.positions[loser], effect.amount);
    if (isBeyondDanger(loser, target)) {
      // Rulebook 2.12: pushed beyond the danger space — out of the field.
      return gameOver(
        { ...next, positions: setIndex(next.positions, loser, DANGER_SPACES[loser]) },
        winner,
      );
    }
    next = { ...next, positions: setIndex(next.positions, loser, target) };
  } else if (effect.type === 'RETURN_TO_FIRST') {
    // Rulebook 2.8: lost with K — back to own first space (§10 Q1).
    next = { ...next, positions: setIndex(next.positions, loser, DANGER_SPACES[loser]) };
  }
  // K_PUSH is the winner's choice — applied in CHOOSE_MOVE. The winner always
  // takes their own move after the loser's forced movement (§10 Q13).
  return { ...next, phase: 'WINNER_MOVE' };
}

/** Rulebook 2.4: both draw back to hand size; then the next round's swap window. */
function finishRound(state) {
  let { playDeck, graveyard, rngState } = state;
  let hands = state.hands;
  for (const p of [0, 1]) {
    const result = draw(playDeck, graveyard, HAND_SIZE - hands[p].length, rngState);
    ({ playDeck, graveyard, rngState } = result);
    hands = setIndex(hands, p, [...hands[p], ...result.drawn]);
  }
  return maybeCloseSwapWindow({
    ...state,
    phase: 'SWAP_WINDOW',
    round: state.round + 1,
    manilha: null, // the manilha card returns to its pile (Rulebook 2.7)
    manilhaCard: null,
    hands,
    playDeck,
    graveyard,
    rngState,
    swapDone: [state.swapsRemaining[0] === 0, state.swapsRemaining[1] === 0],
  });
}

/**
 * When both players closed the swap window: reshuffle the manilha pile and
 * reveal its top card (Rulebook 2.7; window precedes the reveal per §10 Q6),
 * then wait for picks.
 */
function maybeCloseSwapWindow(state) {
  if (!(state.swapDone[0] && state.swapDone[1])) return state;
  const { cards: manilhaDeck, rngState } = shuffled(state.manilhaDeck, state.rngState);
  const manilhaCard = manilhaDeck[0];
  return {
    ...state,
    phase: 'PICK_CARDS',
    manilhaDeck,
    manilhaCard,
    // Rulebook 2.7: face cards and A cannot be manilha — no manilha this round.
    manilha: manilhaCard.rank <= 10 ? manilhaCard.rank : null,
    rngState,
  };
}

function gameOver(state, winner) {
  return { ...state, phase: 'GAME_OVER', winner };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Copy of `arr` with `arr[index]` replaced. */
function setIndex(arr, index, value) {
  return arr.map((v, i) => (i === index ? value : v));
}

/** Shuffle with the serializable RNG cursor, returning the advanced cursor. */
function shuffled(cards, rngState) {
  const rng = mulberry32(rngState);
  const result = shuffle(cards, rng);
  return { cards: result, rngState: (rng() * 4294967296) >>> 0 };
}

/**
 * Draw `count` cards, reshuffling the graveyard into the deck when it runs
 * out (Rulebook 2.11).
 */
function draw(playDeck, graveyard, count, rngState) {
  const drawn = [];
  for (let i = 0; i < count; i++) {
    if (playDeck.length === 0) {
      /* c8 ignore next 3 -- card conservation makes a double-empty impossible */
      if (graveyard.length === 0) {
        throw new Error('Both play deck and graveyard are empty');
      }
      ({ cards: playDeck, rngState } = shuffled(graveyard, rngState));
      graveyard = [];
    }
    drawn.push(playDeck[0]);
    playDeck = playDeck.slice(1);
  }
  return { playDeck, graveyard, drawn, rngState };
}
