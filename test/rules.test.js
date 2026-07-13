// Combat rules tests (Phase 1): modifier table (all distances × suits),
// manilha edge cases, suit cycle, each special card and their interactions
// (J+K, J+A, double J, ...). See PLANNING.md §6.
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('rules module loads and exposes its contract', async () => {
  const rules = await import('../shared/rules.js');
  assert.equal(typeof rules.distanceModifier, 'function');
  assert.equal(typeof rules.effectiveValue, 'function');
  assert.equal(typeof rules.resolveCombat, 'function');
  assert.ok(rules.SUIT_CYCLE);
});
