/**
 * Combat resolution: distance modifiers, manilha, suit-cycle tiebreak, the
 * special cards (A, K, Q, J), and board geometry helpers.
 *
 * Pure module. Every rule cites its rulebook section; ambiguities follow the
 * decisions recorded in docs/PLANNING.md §10.
 *
 * @typedef {import('./cards.js').Card} Card
 */

import { JACK, QUEEN, KING, ACE } from './cards.js';

// ---------------------------------------------------------------------------
// Board geometry (Rulebook 2.3, Figure 1/2)
// ---------------------------------------------------------------------------

/** 12 linear spaces, indices 0–11, 6 per side. */
export const BOARD_SIZE = 12;

/** Each player's first space ("casa de perigo"). Rulebook 2.9. */
export const DANGER_SPACES = [0, 11];

/**
 * The starting (and Legacy-permanent) board extent. Under a ruleset that shrinks
 * the board (V2), the live extent lives on `state.bounds`; these helpers derive
 * geometry from whatever bounds they are handed. Default = the full board, so
 * callers with no shrinking ruleset (and existing tests) stay unchanged.
 */
export const DEFAULT_BOUNDS = { min: 0, max: BOARD_SIZE - 1 };

/** The two players' danger spaces (first spaces) for a given board extent. */
export function dangerSpaces(bounds = DEFAULT_BOUNDS) {
  return [bounds.min, bounds.max];
}

/** Number of playable spaces for a given board extent. */
export function boardSize(bounds = DEFAULT_BOUNDS) {
  return bounds.max - bounds.min + 1;
}

/** Direction each player advances in (toward the opponent's tower). */
export const ADVANCE_DIR = [1, -1];

/** Starting positions: one space from center each, two spaces apart. Rulebook 2.3. */
export const START_POSITIONS = [4, 7];

/** Distance = number of spaces between the pawns (0 = adjacent). Rulebook 2.6. */
export function distanceBetween(positions) {
  return positions[1] - positions[0] - 1;
}

/** Position after `player` retreats `spaces` toward their own tower (may be off-board). */
export function retreatTarget(player, position, spaces) {
  return position - ADVANCE_DIR[player] * spaces;
}

/** Pushed beyond the danger space = out of the field. Rulebook 2.12. */
export function isBeyondDanger(player, position, bounds = DEFAULT_BOUNDS) {
  return player === 0 ? position < bounds.min : position > bounds.max;
}

/** Clamp a retreat at the player's danger space (used by K's push, Rulebook 2.8). */
export function clampToDanger(player, position, bounds = DEFAULT_BOUNDS) {
  return player === 0
    ? Math.max(position, bounds.min)
    : Math.min(position, bounds.max);
}

// ---------------------------------------------------------------------------
// Card comparison
// ---------------------------------------------------------------------------

/**
 * Suit cycle: each suit beats the one it maps to — ♥ beats ♦, ♦ beats ♠,
 * ♠ beats ♥. Rulebook 2.5.
 */
export const SUIT_CYCLE = { hearts: 'diamonds', diamonds: 'spades', spades: 'hearts' };

/**
 * Compare two suits on the cycle. Rulebook 2.5.
 *
 * @returns {0|1|'tie'} index of the winning card; 'tie' when suits are equal
 */
export function suitCycleCompare(suitA, suitB) {
  if (suitA === suitB) return 'tie';
  return SUIT_CYCLE[suitA] === suitB ? 0 : 1;
}

// Rulebook 2.6, Table 1: modifier per suit at distance 0/1/2/3/4/5+.
const MODIFIER_TABLE = {
  spades: [3, 1, 0, -1, -2, -3],
  diamonds: [-2, -1, 0, 1, 2, 3],
  hearts: [0, 0, 0, 0, 0, 0],
};

/**
 * Distance modifier for a suit. Rulebook 2.6, Table 1.
 *
 * @param {'hearts'|'diamonds'|'spades'} suit
 * @param {number} distance - spaces between the pawns (0+)
 * @returns {number}
 */
export function distanceModifier(suit, distance) {
  return MODIFIER_TABLE[suit][Math.min(distance, 5)];
}

/**
 * The Legacy suit modifier, expressed as a ruleset seam:
 * `(card, opponentCard, distance) → number`. Legacy ignores the opponent card
 * entirely (♥ is a flat 0). A ruleset varies combat by supplying its own
 * function of this shape (V2's ♥ reads `opponentCard`); the engine never
 * branches on the ruleset, it just calls the seam it was handed.
 * Rulebook 2.6, Table 1.
 *
 * @param {Card} card
 * @param {Card|null} _opponentCard - unused by Legacy
 * @param {number} distance
 * @returns {number}
 */
export function legacySuitModifier(card, _opponentCard, distance) {
  return distanceModifier(card.suit, distance);
}

/**
 * Effective numeric value of a card this round.
 *
 * A card of manilha rank is a flat 14, immune to distance modifiers
 * (Rulebook 2.7 "worth 14 points"; §10 Q12). Otherwise base rank plus the
 * distance modifier — unless a K removed all suit buffs this round
 * (Rulebook 2.8).
 *
 * @param {Card} card
 * @param {number|null} manilha - manilha rank (2–10) or null (no manilha)
 * @param {number} distance
 * @param {boolean} [buffsRemoved] - true when a K is in play this round
 * @param {Card|null} [opponentCard] - the other revealed card (some rulesets' modifiers depend on it)
 * @param {(card: Card, opponentCard: Card|null, distance: number) => number} [suitModifier] - ruleset seam; defaults to Legacy
 * @returns {number}
 */
export function effectiveValue(
  card,
  manilha,
  distance,
  buffsRemoved = false,
  opponentCard = null,
  suitModifier = legacySuitModifier,
) {
  if (manilha !== null && card.rank === manilha) return 14;
  // A K strips ALL distance/suit modifiers this round (Rulebook 2.8), which also
  // neutralizes any ruleset's dynamic suit modifier — the seam is bypassed here.
  return card.rank + (buffsRemoved ? 0 : suitModifier(card, opponentCard, distance));
}

/**
 * The outcome of comparing the two revealed cards, consumed by the reducer
 * (to apply forced movement and constrain the winner's move) and by the
 * client (to animate and show the modifier breakdown).
 *
 * `winner` is the player index after ALL specials, including J inversion
 * (§10 Q2: inversion applies last; double J = tie; inverting a tie stays a tie).
 *
 * @typedef {Object} Resolution
 * @property {0|1|'tie'} winner
 * @property {[Card, Card]} cards - the revealed picks (public after reveal)
 * @property {[number, number]} effectiveValues
 * @property {number|null} manilha
 * @property {boolean} usedSuitCycle - decided by suit order (numeric tie, or A forcing it)
 * @property {boolean} inverted - a single J inverted the result
 * @property {boolean} buffsRemoved - a K removed distance modifiers this round
 * @property {?{type: 'RETREAT', amount: 1|2}
 *   | ?{type: 'RETURN_TO_FIRST'}
 *   | ?{type: 'K_PUSH', maxPush: 3}} loserEffect - null on a tie
 * @property {?number} winnerMoveRange - 2 base, 5 with Q; null on a tie
 */

/**
 * Resolve a round.
 *
 * Order of evaluation:
 * 1. K removes all distance modifiers for both cards (Rulebook 2.8).
 * 2. If either card is an A, victory is decided purely by the suit cycle —
 *    numeric values, manilha included, are ignored (Rulebook 2.8; §10 Q14).
 *    Same suit → tie.
 * 3. Otherwise compare effective values; equal values are broken by the
 *    suit cycle (Rulebook 2.5; §10 Q11).
 * 4. J inverts the result last (§10 Q2c). Both J → tie (§10 Q2b); a single J
 *    on a tie leaves it a tie.
 * 5. Loser's movement effect, keyed to the final winner/loser: losing with K
 *    returns to own first space and takes precedence over any other retreat
 *    (Rulebook 2.8; §10 Q1/Q14); losing against A retreats 2 (2.8); losing
 *    against K becomes the winner's push of up to 3 (2.8); base loss retreats
 *    1 (2.4). Winner's own move: 0–2, or 0–5 with Q (2.4/2.8; §10 Q3).
 *
 * @param {[Card, Card]} cards - picks of player 0 and player 1
 * @param {number|null} manilha
 * @param {number} distance
 * @param {(card: Card, opponentCard: Card|null, distance: number) => number} [suitModifier] - ruleset seam; defaults to Legacy
 * @returns {Resolution}
 */
export function resolveCombat(cards, manilha, distance, suitModifier = legacySuitModifier) {
  const buffsRemoved = cards.some((c) => c.rank === KING); // Rulebook 2.8, K
  const effectiveValues = cards.map((c, i) =>
    effectiveValue(c, manilha, distance, buffsRemoved, cards[1 - i], suitModifier),
  );

  let base;
  let usedSuitCycle = false;
  if (cards.some((c) => c.rank === ACE)) {
    // Rulebook 2.8: A forces the win condition to be the suit order.
    usedSuitCycle = true;
    base = suitCycleCompare(cards[0].suit, cards[1].suit);
  } else if (effectiveValues[0] !== effectiveValues[1]) {
    base = effectiveValues[0] > effectiveValues[1] ? 0 : 1; // Rulebook 2.5
  } else {
    // Rulebook 2.5: numeric tie → suit cycle decides (§10 Q11).
    usedSuitCycle = true;
    base = suitCycleCompare(cards[0].suit, cards[1].suit);
  }

  // Rulebook 2.8: J inverts the round result — always last (§10 Q2c).
  const jacks = cards.map((c) => c.rank === JACK);
  let winner;
  let inverted = false;
  if (jacks[0] && jacks[1]) {
    winner = 'tie'; // §10 Q2b
  } else if ((jacks[0] || jacks[1]) && base !== 'tie') {
    winner = 1 - base;
    inverted = true;
  } else {
    winner = base;
  }

  const resolution = {
    winner,
    cards: [{ ...cards[0] }, { ...cards[1] }],
    effectiveValues,
    manilha,
    usedSuitCycle,
    inverted,
    buffsRemoved,
    loserEffect: null,
    winnerMoveRange: null,
  };
  if (winner === 'tie') return resolution;

  const winnerCard = cards[winner];
  const loserCard = cards[1 - winner];
  resolution.winnerMoveRange = winnerCard.rank === QUEEN ? 5 : 2; // Rulebook 2.8, Q; §10 Q3
  resolution.loserEffect =
    loserCard.rank === KING
      ? { type: 'RETURN_TO_FIRST' } // Rulebook 2.8; §10 Q1, precedence per §10 Q14
      : winnerCard.rank === ACE
        ? { type: 'RETREAT', amount: 2 } // Rulebook 2.8, A
        : winnerCard.rank === KING
          ? { type: 'K_PUSH', maxPush: 3 } // Rulebook 2.8, K
          : { type: 'RETREAT', amount: 1 }; // Rulebook 2.4
  return resolution;
}
