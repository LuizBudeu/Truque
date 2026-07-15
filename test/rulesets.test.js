/**
 * V2 ruleset tests: scaled-triangle magic and board-shrink-on-reshuffle. Legacy
 * behaviour is asserted untouched here and throughout the existing suites — V2
 * lives entirely in its own policy object, so nothing Legacy can regress.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { resolveCombat } from '../shared/rules.js';
import { getRuleset, isRulesetId, RULESETS } from '../shared/rulesets/index.js';
import { applyAction } from '../shared/reducer.js';
import { C, makeState, autoPlay, checkInvariants } from './helpers.js';

const v2mod = getRuleset('v2').suitModifier;
const shrink = getRuleset('v2').onReshuffle;

describe('ruleset registry', () => {
  test('known ids resolve; unknown falls back to Legacy', () => {
    assert.equal(getRuleset('legacy').id, 'legacy');
    assert.equal(getRuleset('v2').id, 'v2');
    assert.equal(getRuleset(undefined).id, 'legacy');
    assert.equal(getRuleset('nonsense').id, 'legacy');
    assert.ok(isRulesetId('v2') && isRulesetId('legacy') && !isRulesetId('nonsense'));
  });

  test('v2 delegates non-magic suits to Legacy (no duplicated table)', () => {
    // Spades/diamonds must be byte-identical between the two rulesets.
    for (const dist of [0, 1, 2, 3, 4, 5, 8]) {
      for (const suit of ['spades', 'diamonds']) {
        const card = C(7, suit);
        assert.equal(
          v2mod(card, C(7, 'diamonds'), dist),
          RULESETS.legacy.suitModifier(card, C(7, 'diamonds'), dist),
          `${suit} @ ${dist}`,
        );
      }
    }
  });
});

describe('V2 scaled-triangle magic', () => {
  test('magic mirrors the opponent modifier and the cycle breaks the tie (dist 3)', () => {
    // ♥ vs ♦: magic +1, diamond +1 → tie → cycle → ♥ beats ♦.
    const vsBow = resolveCombat([C(5, 'hearts'), C(5, 'diamonds')], null, 3, v2mod);
    assert.deepEqual(vsBow.effectiveValues, [6, 6]);
    assert.equal(vsBow.winner, 0);
    assert.ok(vsBow.usedSuitCycle);

    // ♥ vs ♠: magic −1, sword −1 → tie → cycle → ♠ beats ♥.
    const vsSword = resolveCombat([C(5, 'hearts'), C(5, 'spades')], null, 3, v2mod);
    assert.deepEqual(vsSword.effectiveValues, [4, 4]);
    assert.equal(vsSword.winner, 1);

    // Legacy: ♥ stays flat 0, so the same duels resolve on raw value.
    assert.deepEqual(
      resolveCombat([C(5, 'hearts'), C(5, 'diamonds')], null, 3).effectiveValues,
      [5, 6],
    );
  });

  test('at the asymmetric extremes the swing can overturn a higher card', () => {
    // Distance 0: ♦ = −2, so magic vs ♦ is +2 — enough to beat a higher diamond.
    const res = resolveCombat([C(5, 'hearts'), C(8, 'diamonds')], null, 0, v2mod);
    assert.deepEqual(res.effectiveValues, [7, 6]); // 5+2 vs 8−2
    assert.equal(res.winner, 0);
  });

  test('magic vs magic carries no modifier (pure rank)', () => {
    const res = resolveCombat([C(9, 'hearts'), C(7, 'hearts')], null, 5, v2mod);
    assert.deepEqual(res.effectiveValues, [9, 7]);
    assert.equal(res.winner, 0);
  });

  test('a K in play strips the dynamic magic modifier too', () => {
    const res = resolveCombat([C(5, 'hearts'), C(13, 'spades')], null, 0, v2mod);
    assert.deepEqual(res.effectiveValues, [5, 13]); // magic buff removed, not −3
  });

  test('a magic-rank manilha card is still a flat 14', () => {
    const res = resolveCombat([C(5, 'hearts'), C(9, 'diamonds')], 5, 0, v2mod);
    assert.deepEqual(res.effectiveValues, [14, 7]); // 5 is manilha → 14; 9−2
  });
});

describe('V2 board shrink on reshuffle', () => {
  const at = (bounds, positions) => makeState({ ruleset: 'v2', bounds, positions });

  test('no shrink without a reshuffle', () => {
    const s = at({ min: 0, max: 11 }, [4, 7]);
    assert.deepEqual(shrink(s, false).bounds, { min: 0, max: 11 });
  });

  test('both edges retract by one, pawns clear of the edges stay put', () => {
    const s = shrink(at({ min: 0, max: 11 }, [4, 7]), true);
    assert.deepEqual(s.bounds, { min: 1, max: 10 });
    assert.deepEqual(s.positions, [4, 7]);
  });

  test('a pawn on a removed edge slides inward', () => {
    assert.deepEqual(shrink(at({ min: 0, max: 11 }, [0, 7]), true).positions, [1, 7]);
    assert.deepEqual(shrink(at({ min: 0, max: 11 }, [4, 11]), true).positions, [4, 10]);
    assert.deepEqual(shrink(at({ min: 0, max: 5 }, [0, 5]), true).positions, [1, 4]);
  });

  test('pawns jammed at a removed edge cascade without colliding', () => {
    // Both at the min edge: sliding p0 in bumps p1 along, order preserved.
    const s = shrink(at({ min: 0, max: 5 }, [0, 1]), true);
    assert.deepEqual(s.bounds, { min: 1, max: 4 });
    assert.deepEqual(s.positions, [1, 2]);
  });

  test('the shrink stops at a two-space floor', () => {
    // Width 3 would become width 1 — refused, board unchanged.
    const narrow = at({ min: 4, max: 6 }, [4, 6]);
    assert.deepEqual(shrink(narrow, true).bounds, { min: 4, max: 6 });
    // Width 4 shrinks to the width-2 floor.
    assert.deepEqual(shrink(at({ min: 4, max: 7 }, [5, 6]), true).bounds, { min: 5, max: 6 });
  });
});

describe('V2 engine integration', () => {
  test('a reshuffle during a round shrinks the board at the round boundary', () => {
    // One card left in the deck: refilling both hands forces a graveyard reshuffle.
    let s = makeState({
      ruleset: 'v2',
      playDeck: [C(4, 'spades')],
      graveyard: [C(6, 'spades'), C(6, 'diamonds'), C(8, 'spades'), C(8, 'hearts')],
    });
    s = applyAction(s, { type: 'PLAY_CARD', player: 0, card: C(9, 'diamonds') });
    s = applyAction(s, { type: 'PLAY_CARD', player: 1, card: C(3, 'hearts') });
    assert.equal(s.phase, 'WINNER_MOVE');
    assert.equal(s.lastResolution.winner, 0);
    s = applyAction(s, { type: 'CHOOSE_MOVE', player: 0, selfOffset: 0 });

    assert.equal(s.phase, 'SWAP_WINDOW');
    assert.deepEqual(s.bounds, { min: 1, max: 10 }); // shrank on the forced reshuffle
    assert.equal(s.pendingReshuffle, false); // flag consumed
  });

  test('the same round under Legacy leaves the board untouched', () => {
    let s = makeState({
      ruleset: 'legacy',
      playDeck: [C(4, 'spades')],
      graveyard: [C(6, 'spades'), C(6, 'diamonds'), C(8, 'spades'), C(8, 'hearts')],
    });
    s = applyAction(s, { type: 'PLAY_CARD', player: 0, card: C(9, 'diamonds') });
    s = applyAction(s, { type: 'PLAY_CARD', player: 1, card: C(3, 'hearts') });
    s = applyAction(s, { type: 'CHOOSE_MOVE', player: 0, selfOffset: 0 });
    assert.deepEqual(s.bounds, { min: 0, max: 11 });
  });
});

describe('full random games under both rulesets', () => {
  test('V2 games stay within their shrinking bounds, terminate, and do shrink', () => {
    let anyShrink = false;
    for (let seed = 1; seed <= 60; seed++) {
      const { state } = autoPlay(seed, { ruleset: 'v2', onStep: checkInvariants });
      assert.ok(state.winner !== null, `V2 seed ${seed} did not finish`);
      if (state.bounds.min > 0 || state.bounds.max < 11) anyShrink = true;
    }
    assert.ok(anyShrink, 'expected some V2 game to reshuffle and shrink the board');
  });

  test('Legacy games never touch the board bounds', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const { state } = autoPlay(seed, { onStep: checkInvariants });
      assert.deepEqual(state.bounds, { min: 0, max: 11 });
    }
  });
});
