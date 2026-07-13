// Scenario tests (Phase 1): full scripted games with fixed seeds acting as
// regression tests — add one for every bug found. See PLANNING.md §6.
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('cards module loads and exposes its contract', async () => {
  const cards = await import('../shared/cards.js');
  assert.equal(typeof cards.mulberry32, 'function');
  assert.equal(typeof cards.buildPlayDeck, 'function');
  assert.equal(typeof cards.buildManilhaDeck, 'function');
  assert.equal(typeof cards.shuffle, 'function');
  assert.equal(cards.PLAY_SUITS.length, 3);
  assert.equal(cards.RANKS.length, 13);
});
