/**
 * Combat resolution: distance modifiers, manilha, suit-cycle tiebreak, and
 * special cards (A, K, Q, J).
 *
 * Pure module. Every rule cites its rulebook section; ambiguities follow the
 * decisions recorded in docs/PLANNING.md §10.
 *
 * @typedef {import('./cards.js').Card} Card
 */

/**
 * Suit cycle for tiebreaks and the A special: ♥ beats ♦, ♦ beats ♠, ♠ beats ♥.
 * Rulebook 2.5.
 */
export const SUIT_CYCLE = { hearts: 'diamonds', diamonds: 'spades', spades: 'hearts' };

/**
 * The outcome of comparing the two revealed cards, consumed by the reducer
 * (to constrain WINNER_MOVE and apply forced movement) and by the client
 * (to animate and show the modifier breakdown).
 *
 * `winner` is the player index after ALL specials, including J inversion
 * (§10 Q2: inversion applies last; double J = tie).
 *
 * @typedef {Object} Resolution
 * @property {0|1|'tie'} winner
 * @property {[number, number]} effectiveValues - modified values shown in the breakdown
 * @property {boolean} usedSuitCycle - decided by suit order (numeric tie, or A forcing it)
 * @property {boolean} inverted - a single J inverted the result
 * @property {Object} loserEffect - forced movement for the loser, e.g.
 *   retreat 1 (base, Rulebook 2.4), retreat 2 (lost against A, 2.8),
 *   pushed up to 3 at winner's choice capped at danger space (lost against K, 2.8),
 *   return to own first space (lost WITH K, 2.8 / §10 Q1)
 * @property {Object} winnerMove - allowed move range for the winner:
 *   0–2 either direction (2.4), 0–5 with Q (2.8 / §10 Q3),
 *   plus K's push-placement choice (2.8)
 */

/**
 * Distance modifier for a suit. Rulebook 2.6, Table 1:
 * ♠ +3/+1/0/-1/-2/-3 and ♦ -2/-1/0/+1/+2/+3 for distance 0/1/2/3/4/5+;
 * ♥ always 0.
 *
 * @param {'hearts'|'diamonds'|'spades'} suit
 * @param {number} distance - spaces between the pawns (0+)
 * @returns {number}
 */
export function distanceModifier(suit, distance) {
  throw new Error('Not implemented (Phase 1)');
}

/**
 * Effective numeric value of a card this round:
 * manilha rank counts as 14 (Rulebook 2.7); otherwise base rank plus
 * distance modifier — unless a K was played by either player, which removes
 * all suit buffs for both cards (Rulebook 2.8).
 *
 * @param {Card} card
 * @param {number|null} manilha - manilha rank (2–10) or null (no manilha)
 * @param {number} distance
 * @param {boolean} buffsRemoved - true when a K is in play this round
 * @returns {number}
 */
export function effectiveValue(card, manilha, distance, buffsRemoved) {
  throw new Error('Not implemented (Phase 1)');
}

/**
 * Resolve a round: compare effective values (Rulebook 2.4/2.5), break numeric
 * ties by suit cycle, apply specials in order — A forces suit-order comparison
 * (2.8), K removes buffs and shapes movement (2.8), Q widens the winner's move
 * (2.8), J inverts the result last (2.8 / §10 Q2). A true tie (§10 Q5): equal
 * modified values with no special deciding — both retreat 1 (2.4); a player
 * already on their danger space then loses (§10 Q4), both there = draw (§10 Q9).
 *
 * @param {[Card, Card]} cards - picks of player 0 and player 1
 * @param {number|null} manilha
 * @param {number} distance
 * @returns {Resolution}
 */
export function resolveCombat(cards, manilha, distance) {
  throw new Error('Not implemented (Phase 1)');
}
