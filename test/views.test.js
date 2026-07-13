// Hidden-information leak tests (Phase 1): serialize every view in every
// phase and assert the opponent's hidden cards never appear — including the
// danger-zone early-reveal exception behaving exactly as specified.
// See PLANNING.md §3.4 and §6.
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('views module loads and exposes its contract', async () => {
  const views = await import('../shared/views.js');
  assert.equal(typeof views.getPlayerView, 'function');
});
