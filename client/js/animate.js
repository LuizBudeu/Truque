/**
 * View diffing → animation sequences (Phase 2/4). Reads previous vs next
 * PlayerView and plays transitions (pawn slides, card flips, manilha reveal,
 * modifier breakdown) before committing the final render. Keeps a small queue
 * so rapid server messages don't cut animations short. Never touches game
 * state — views only (PLANNING.md §8).
 */

export {};
