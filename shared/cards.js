/**
 * Deck construction and shuffling.
 *
 * Pure module: no Node APIs, no DOM, no Math.random(). All randomness comes
 * from an injected RNG created by `mulberry32(seed)` so games and tests are
 * reproducible.
 */

/**
 * A playing card. Combat values are computed by the rules engine from
 * (card, manilha, distance) — never stored on the card itself.
 *
 * Ranks: 2–10 numeric, 11 = J, 12 = Q, 13 = K, 14 = A.
 *
 * @typedef {Object} Card
 * @property {number} rank - 2..14
 * @property {'hearts'|'diamonds'|'spades'|'clubs'} suit - clubs appear only in the manilha deck
 */

/** Suits of the play deck (♣ is manilha-only). Rulebook 2.3. */
export const PLAY_SUITS = ['hearts', 'diamonds', 'spades'];

/** All ranks, ascending. 11=J, 12=Q, 13=K, 14=A. */
export const RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

/**
 * Create a deterministic PRNG from a 32-bit seed (mulberry32).
 *
 * @param {number} seed
 * @returns {() => number} function returning floats in [0, 1)
 */
export function mulberry32(seed) {
  throw new Error('Not implemented (Phase 1)');
}

/**
 * Build the 36-card play deck: ranks 2–A of ♥ ♦ ♠. Rulebook 2.3; §10 Q7.
 *
 * @returns {Card[]} unshuffled deck
 */
export function buildPlayDeck() {
  throw new Error('Not implemented (Phase 1)');
}

/**
 * Build the 13-card manilha deck: ranks 2–A of ♣. Face cards and A drawn
 * from this deck mean the round has no manilha. Rulebook 2.7; §10 Q7.
 *
 * @returns {Card[]} unshuffled deck
 */
export function buildManilhaDeck() {
  throw new Error('Not implemented (Phase 1)');
}

/**
 * Return a shuffled copy of `cards` (Fisher–Yates). Does not mutate input.
 *
 * @param {Card[]} cards
 * @param {() => number} rng - injected PRNG, e.g. from mulberry32
 * @returns {Card[]}
 */
export function shuffle(cards, rng) {
  throw new Error('Not implemented (Phase 1)');
}
