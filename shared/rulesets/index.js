/**
 * Ruleset registry. `state.ruleset` stores only an id (a string); the policy
 * object lives here in code, so both server and client resolve it identically
 * from `getRuleset(id)` — nothing about the ruleset is ever serialized beyond
 * the id.
 *
 * @typedef {import('./legacy.js').Ruleset} Ruleset
 */

import { legacy } from './legacy.js';
import { v2 } from './v2.js';

/** @type {Record<string, Ruleset>} */
export const RULESETS = {
  legacy,
  v2,
};

/** Ruleset applied when none is specified (back-compat: old state has no id). */
export const DEFAULT_RULESET = 'legacy';

/** Whether `id` names a known ruleset (used to validate untrusted input). */
export function isRulesetId(id) {
  return Object.prototype.hasOwnProperty.call(RULESETS, id);
}

/** Resolve an id to its policy object, falling back to Legacy. */
export function getRuleset(id) {
  return RULESETS[id] ?? RULESETS[DEFAULT_RULESET];
}
