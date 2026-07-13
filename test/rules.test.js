// Combat rules: modifier table (all distances × suits), manilha edge cases,
// suit cycle, each special card and their interactions (J+K, J+A, double J).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  distanceModifier,
  effectiveValue,
  suitCycleCompare,
  resolveCombat,
  distanceBetween,
} from '../shared/rules.js';
import { C } from './helpers.js';

describe('distance modifiers (Rulebook 2.6, Table 1)', () => {
  const table = [
    // [distance, spades, diamonds, hearts]
    [0, 3, -2, 0],
    [1, 1, -1, 0],
    [2, 0, 0, 0],
    [3, -1, 1, 0],
    [4, -2, 2, 0],
    [5, -3, 3, 0],
    [9, -3, 3, 0], // 5+ column applies to anything farther
  ];
  for (const [distance, spades, diamonds, hearts] of table) {
    test(`distance ${distance}: ♠${spades} ♦${diamonds} ♥${hearts}`, () => {
      assert.equal(distanceModifier('spades', distance), spades);
      assert.equal(distanceModifier('diamonds', distance), diamonds);
      assert.equal(distanceModifier('hearts', distance), hearts);
    });
  }

  test('distanceBetween counts spaces between pawns', () => {
    assert.equal(distanceBetween([4, 7]), 2);
    assert.equal(distanceBetween([5, 6]), 0);
    assert.equal(distanceBetween([0, 11]), 10);
  });
});

describe('effective value', () => {
  test('applies the suit modifier to the base rank', () => {
    assert.equal(effectiveValue(C(7, 'spades'), null, 0), 10);
    assert.equal(effectiveValue(C(7, 'diamonds'), null, 0), 5);
    assert.equal(effectiveValue(C(7, 'hearts'), null, 0), 7);
  });

  test('manilha rank is a flat 14, immune to modifiers (Rulebook 2.7; §10 Q12)', () => {
    assert.equal(effectiveValue(C(5, 'spades'), 5, 0), 14); // not 17
    assert.equal(effectiveValue(C(5, 'diamonds'), 5, 0), 14); // not 12
    assert.equal(effectiveValue(C(5, 'hearts'), 5, 3), 14);
  });

  test('K removes suit buffs (Rulebook 2.8)', () => {
    assert.equal(effectiveValue(C(7, 'spades'), null, 0, true), 7);
    assert.equal(effectiveValue(C(7, 'diamonds'), null, 5, true), 7);
    // ...but not the manilha's 14 (a flat value, not a buff)
    assert.equal(effectiveValue(C(5, 'spades'), 5, 0, true), 14);
  });
});

describe('suit cycle (Rulebook 2.5)', () => {
  test('♥ beats ♦, ♦ beats ♠, ♠ beats ♥; same suit is a tie', () => {
    assert.equal(suitCycleCompare('hearts', 'diamonds'), 0);
    assert.equal(suitCycleCompare('diamonds', 'spades'), 0);
    assert.equal(suitCycleCompare('spades', 'hearts'), 0);
    assert.equal(suitCycleCompare('diamonds', 'hearts'), 1);
    assert.equal(suitCycleCompare('hearts', 'hearts'), 'tie');
  });
});

describe('combat resolution — numeric order', () => {
  test('higher effective value wins (Rulebook 2.5)', () => {
    const res = resolveCombat([C(10, 'hearts'), C(8, 'hearts')], null, 2);
    assert.equal(res.winner, 0);
    assert.deepEqual(res.effectiveValues, [10, 8]);
    assert.equal(res.usedSuitCycle, false);
    assert.deepEqual(res.loserEffect, { type: 'RETREAT', amount: 1 }); // Rulebook 2.4
    assert.equal(res.winnerMoveRange, 2);
  });

  test('distance modifiers can flip the outcome', () => {
    // 7♠ vs 8♦: at distance 0 → 10 vs 6; at distance 5 → 4 vs 11
    assert.equal(resolveCombat([C(7, 'spades'), C(8, 'diamonds')], null, 0).winner, 0);
    assert.equal(resolveCombat([C(7, 'spades'), C(8, 'diamonds')], null, 5).winner, 1);
  });

  test('equal modified values are broken by the suit cycle (§10 Q11)', () => {
    // distance 3: 6♥ = 6, 5♦ = 5+1 = 6 → cycle: ♥ beats ♦
    const res = resolveCombat([C(6, 'hearts'), C(5, 'diamonds')], null, 3);
    assert.equal(res.winner, 0);
    assert.equal(res.usedSuitCycle, true);
  });
});

describe('manilha (Rulebook 2.7)', () => {
  test('manilha-rank card beats a K', () => {
    const res = resolveCombat([C(3, 'hearts'), C(13, 'spades')], 3, 2);
    assert.equal(res.winner, 0);
    assert.deepEqual(res.effectiveValues, [14, 13]);
  });

  test('two manilha cards tie numerically; the suit cycle decides', () => {
    const res = resolveCombat([C(3, 'hearts'), C(3, 'spades')], 3, 2);
    assert.equal(res.winner, 1); // ♠ beats ♥
    assert.equal(res.usedSuitCycle, true);
  });

  test('no manilha (null) — plain ranks apply', () => {
    const res = resolveCombat([C(3, 'hearts'), C(10, 'hearts')], null, 2);
    assert.equal(res.winner, 1);
  });
});

describe('A — forces suit-order victory (Rulebook 2.8)', () => {
  test('A wins on the cycle → loser retreats 2', () => {
    const res = resolveCombat([C(14, 'hearts'), C(10, 'diamonds')], null, 5);
    assert.equal(res.winner, 0);
    assert.equal(res.usedSuitCycle, true);
    assert.deepEqual(res.loserEffect, { type: 'RETREAT', amount: 2 });
  });

  test('A can lose on the cycle — normal loss for the A player', () => {
    // A♦ vs 2♥: ♥ beats ♦ regardless of rank
    const res = resolveCombat([C(14, 'diamonds'), C(2, 'hearts')], null, 2);
    assert.equal(res.winner, 1);
    assert.deepEqual(res.loserEffect, { type: 'RETREAT', amount: 1 });
  });

  test('A beats a manilha card via suit order — numeric 14 is ignored (§10 Q14)', () => {
    const res = resolveCombat([C(14, 'spades'), C(5, 'hearts')], 5, 2);
    assert.equal(res.winner, 0); // ♠ beats ♥
    assert.deepEqual(res.loserEffect, { type: 'RETREAT', amount: 2 });
  });

  test('A vs a same-suit card is a true tie', () => {
    const res = resolveCombat([C(14, 'hearts'), C(7, 'hearts')], null, 2);
    assert.equal(res.winner, 'tie');
    assert.equal(res.loserEffect, null);
  });

  test('A vs A: cycle decides, winner applies the A effect', () => {
    const res = resolveCombat([C(14, 'diamonds'), C(14, 'spades')], null, 2);
    assert.equal(res.winner, 0); // ♦ beats ♠
    assert.deepEqual(res.loserEffect, { type: 'RETREAT', amount: 2 });
  });
});

describe('K — removes buffs, pushes on win, returns home on loss (Rulebook 2.8)', () => {
  test('K removes distance modifiers for BOTH cards', () => {
    // 9♠ at distance 0 would be 12; with a K in play it stays 9
    const res = resolveCombat([C(9, 'spades'), C(13, 'hearts')], null, 0);
    assert.equal(res.buffsRemoved, true);
    assert.deepEqual(res.effectiveValues, [9, 13]);
    assert.equal(res.winner, 1);
    assert.deepEqual(res.loserEffect, { type: 'K_PUSH', maxPush: 3 });
    assert.equal(res.winnerMoveRange, 2);
  });

  test('losing with K → return to own first space (§10 Q1)', () => {
    const res = resolveCombat([C(13, 'spades'), C(9, 'hearts')], 9, 2); // manilha beats K
    assert.equal(res.winner, 1);
    assert.deepEqual(res.loserEffect, { type: 'RETURN_TO_FIRST' });
  });

  test('K vs K: cycle decides; loser (with K) returns to first space', () => {
    const res = resolveCombat([C(13, 'hearts'), C(13, 'spades')], null, 2);
    assert.equal(res.winner, 1); // ♠ beats ♥
    assert.deepEqual(res.loserEffect, { type: 'RETURN_TO_FIRST' });
  });

  test('losing with K against a winning A: return-to-first takes precedence (§10 Q14)', () => {
    // A♦ vs K♠: A forces the cycle, ♦ beats ♠ → A wins, K loser goes home
    const res = resolveCombat([C(14, 'diamonds'), C(13, 'spades')], null, 2);
    assert.equal(res.winner, 0);
    assert.deepEqual(res.loserEffect, { type: 'RETURN_TO_FIRST' });
  });
});

describe('Q — winner moves up to 5 (Rulebook 2.8; §10 Q3)', () => {
  test('winning with Q extends the move range to 5', () => {
    const res = resolveCombat([C(12, 'hearts'), C(5, 'hearts')], null, 2);
    assert.equal(res.winner, 0);
    assert.equal(res.winnerMoveRange, 5);
    assert.deepEqual(res.loserEffect, { type: 'RETREAT', amount: 1 });
  });

  test('losing with Q is a normal loss (§10 Q2a)', () => {
    const res = resolveCombat([C(12, 'hearts'), C(13, 'hearts')], null, 2);
    assert.equal(res.winner, 1);
    assert.deepEqual(res.loserEffect, { type: 'K_PUSH', maxPush: 3 });
  });
});

describe('J — inverts the round result, always last (Rulebook 2.8; §10 Q2)', () => {
  test('J winning numerically becomes the loser', () => {
    const res = resolveCombat([C(11, 'hearts'), C(9, 'hearts')], null, 2);
    assert.equal(res.inverted, true);
    assert.equal(res.winner, 1);
    assert.deepEqual(res.loserEffect, { type: 'RETREAT', amount: 1 });
  });

  test('J losing numerically becomes the winner', () => {
    const res = resolveCombat([C(11, 'hearts'), C(12, 'hearts')], null, 2);
    assert.equal(res.inverted, true);
    assert.equal(res.winner, 0);
  });

  test('J vs K: K wins numerically, inversion hands J the win, K goes home (§10 Q2a)', () => {
    const res = resolveCombat([C(13, 'spades'), C(11, 'hearts')], null, 2);
    assert.equal(res.winner, 1);
    assert.equal(res.inverted, true);
    assert.deepEqual(res.loserEffect, { type: 'RETURN_TO_FIRST' });
  });

  test('J vs A: suit comparison first, inversion after (§10 Q2c)', () => {
    // A♦ vs J♠: cycle says A wins; the J flips it
    const res = resolveCombat([C(14, 'diamonds'), C(11, 'spades')], null, 2);
    assert.equal(res.usedSuitCycle, true);
    assert.equal(res.inverted, true);
    assert.equal(res.winner, 1);
    assert.deepEqual(res.loserEffect, { type: 'RETREAT', amount: 1 });
  });

  test('double J is a tie (§10 Q2b)', () => {
    // Even when modifiers would separate them (distance 0: J♠=14, J♦=9)
    const res = resolveCombat([C(11, 'spades'), C(11, 'diamonds')], null, 0);
    assert.equal(res.winner, 'tie');
    assert.equal(res.loserEffect, null);
  });

  test('a single J on a tie leaves it a tie', () => {
    // A♥ vs J♥: A forces suit order, same suit → tie; inversion changes nothing
    const res = resolveCombat([C(14, 'hearts'), C(11, 'hearts')], null, 2);
    assert.equal(res.winner, 'tie');
  });
});
