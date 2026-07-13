/**
 * Client bootstrap and screen routing: menu → room → game (Phase 2).
 *
 * Phase 2 runs hotseat: this module drives shared/reducer.js directly, with a
 * pick-confirmation curtain so picks stay secret on one device. Phase 3 swaps
 * the direct reducer calls for net.js (hotseat stays behind a debug flag).
 */

export {};
