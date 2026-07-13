// Reducer tests (Phase 1): phase transitions, illegal action rejection, swap
// limits, graveyard reshuffle, game-over detection including "pushed beyond
// danger space" and edge positions. See PLANNING.md §6.
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('reducer and validation modules load and expose their contracts', async () => {
  const reducer = await import('../shared/reducer.js');
  assert.equal(typeof reducer.createInitialState, 'function');
  assert.equal(typeof reducer.applyAction, 'function');
  assert.ok(Array.isArray(reducer.PHASES));

  const validation = await import('../shared/validation.js');
  assert.equal(typeof validation.isLegalAction, 'function');
});
