// Animation plan tests: buildAnimationPlan is pure (view pair → step list),
// so the whole reveal/slide/flip choreography is verified in Node against
// real reducer transitions — no DOM involved.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { buildAnimationPlan } from '../client/js/animate.js';
import { applyAction } from '../shared/reducer.js';
import { getPlayerView } from '../shared/views.js';
import { C, makeState } from './helpers.js';

const view = (state, seat = 0) => getPlayerView(state, seat);
const types = (plan) => plan.map((s) => s.type);

describe('guards', () => {
  test('no plan without a previous view (first render / reconnect)', () => {
    assert.deepEqual(buildAnimationPlan(null, view(makeState())), []);
  });

  test('no plan across a hotseat seat switch', () => {
    const s = makeState();
    assert.deepEqual(buildAnimationPlan(view(s, 0), view(s, 1)), []);
  });

  test('no steps when nothing observable changed (selection-style rerender)', () => {
    const s = makeState();
    assert.deepEqual(buildAnimationPlan(view(s, 0), view(s, 0)), []);
  });

  test('a mid-pick commit (self or opponent) animates nothing', () => {
    const s0 = makeState();
    const s1 = applyAction(s0, { type: 'PLAY_CARD', player: 0, card: C(2, 'hearts') });
    assert.deepEqual(buildAnimationPlan(view(s0, 0), view(s1, 0)), []);
    assert.deepEqual(buildAnimationPlan(view(s0, 1), view(s1, 1)), []);
  });
});

describe('reveal', () => {
  test('completing the picks plays the reveal for both seats', () => {
    const s0 = makeState();
    const s1 = applyAction(s0, { type: 'PLAY_CARD', player: 0, card: C(9, 'diamonds') });
    const s2 = applyAction(s1, { type: 'PLAY_CARD', player: 1, card: C(7, 'spades') });
    assert.equal(s2.phase, 'WINNER_MOVE');
    for (const seat of [0, 1]) {
      // The loser's forced retreat resolves atomically with the reveal, so
      // the same transition flips the cards, THEN slides the loser's pawn.
      const plan = buildAnimationPlan(view(s1, seat), view(s2, seat));
      assert.deepEqual(types(plan), ['reveal', 'pawn-slide']);
      assert.ok(plan[0].duration > 0);
      assert.deepEqual(plan[1].moves, [{ player: 1, from: 7, to: 8 }]);
    }
  });

  test('a tie reveals, then slides both pawns together', () => {
    // 9♦ vs 9♥ at distance 2 (modifier 0): numeric tie... broken by suit
    // cycle — so force a REAL tie with double J (§10 Q2b).
    const s0 = makeState({
      hands: [
        [C(11, 'hearts'), C(5, 'spades')],
        [C(11, 'diamonds'), C(7, 'spades')],
      ],
    });
    const s1 = applyAction(s0, { type: 'PLAY_CARD', player: 0, card: C(11, 'hearts') });
    const s2 = applyAction(s1, { type: 'PLAY_CARD', player: 1, card: C(11, 'diamonds') });
    assert.equal(s2.lastResolution.winner, 'tie');
    const plan = buildAnimationPlan(view(s1, 0), view(s2, 0));
    assert.deepEqual(types(plan), ['reveal', 'pawn-slide']);
    assert.deepEqual(plan[1].moves, [
      { player: 0, from: 4, to: 3 },
      { player: 1, from: 7, to: 8 },
    ]);
  });

  test('a concession leaving PICK_CARDS does not replay a stale reveal', () => {
    const s0 = makeState({
      lastResolution: {
        winner: 0,
        cards: [C(9, 'diamonds'), C(7, 'spades')],
        effectiveValues: [9, 7],
        manilha: null,
        usedSuitCycle: false,
        inverted: false,
        buffsRemoved: false,
        loserEffect: { type: 'RETREAT', amount: 1 },
        winnerMoveRange: 2,
        distance: 2,
      },
    });
    const s1 = applyAction(s0, { type: 'CONCEDE', player: 1 });
    assert.equal(s1.phase, 'GAME_OVER');
    assert.deepEqual(buildAnimationPlan(view(s0, 0), view(s1, 0)), []);
  });
});

describe('pawn slides', () => {
  test("the winner's chosen move slides their pawn", () => {
    const s0 = makeState({
      phase: 'WINNER_MOVE',
      lastResolution: {
        winner: 0,
        cards: [C(9, 'diamonds'), C(7, 'spades')],
        effectiveValues: [9, 7],
        manilha: null,
        usedSuitCycle: false,
        inverted: false,
        buffsRemoved: false,
        loserEffect: { type: 'RETREAT', amount: 1 },
        winnerMoveRange: 2,
        distance: 2,
      },
      positions: [4, 8], // loser already retreated 7 → 8
    });
    const s1 = applyAction(s0, { type: 'CHOOSE_MOVE', player: 0, selfOffset: 2 });
    const plan = buildAnimationPlan(view(s0, 0), view(s1, 0));
    assert.equal(types(plan)[0], 'pawn-slide');
    assert.deepEqual(plan[0].moves, [{ player: 0, from: 4, to: 6 }]);
  });
});

describe('manilha flip', () => {
  test('closing the swap window flips the freshly drawn manilha', () => {
    const s0 = makeState({ phase: 'SWAP_WINDOW', swapDone: [true, false], manilhaCard: null });
    const s1 = applyAction(s0, { type: 'SKIP_SWAP', player: 1 });
    assert.equal(s1.phase, 'PICK_CARDS');
    assert.notEqual(s1.manilhaCard, null);
    const plan = buildAnimationPlan(view(s0, 0), view(s1, 0));
    assert.deepEqual(types(plan), ['manilha-flip']);
  });

  test('an unchanged manilha card does not re-flip', () => {
    const s = makeState(); // manilhaCard J♣ present in both views
    const s1 = applyAction(s, { type: 'PLAY_CARD', player: 0, card: C(2, 'hearts') });
    assert.deepEqual(buildAnimationPlan(view(s, 0), view(s1, 0)), []);
  });
});

describe('board shrink (V2)', () => {
  test('narrowed bounds emit a board-shrink step carrying the extents', () => {
    const before = view(makeState({ ruleset: 'v2', bounds: { min: 0, max: 11 }, positions: [4, 7] }));
    const after = view(makeState({ ruleset: 'v2', bounds: { min: 1, max: 10 }, positions: [4, 7] }));
    const plan = buildAnimationPlan(before, after);
    assert.deepEqual(types(plan), ['board-shrink']);
    assert.deepEqual(plan[0].from, { min: 0, max: 11 });
    assert.deepEqual(plan[0].to, { min: 1, max: 10 });
  });

  test('a real reshuffle round slides the winner, then collapses the edges', () => {
    // One card left in the deck forces a reshuffle when the hands refill.
    let s0 = makeState({
      ruleset: 'v2',
      playDeck: [C(4, 'spades')],
      graveyard: [C(6, 'spades'), C(6, 'diamonds'), C(8, 'spades'), C(8, 'hearts')],
    });
    s0 = applyAction(s0, { type: 'PLAY_CARD', player: 0, card: C(9, 'diamonds') });
    s0 = applyAction(s0, { type: 'PLAY_CARD', player: 1, card: C(3, 'hearts') });
    const s1 = applyAction(s0, { type: 'CHOOSE_MOVE', player: 0, selfOffset: 1 });
    assert.deepEqual(s1.bounds, { min: 1, max: 10 });

    const plan = buildAnimationPlan(view(s0, 0), view(s1, 0));
    assert.deepEqual(types(plan), ['pawn-slide', 'board-shrink']);
    assert.deepEqual(plan[1].to, { min: 1, max: 10 });
  });

  test('Legacy never emits a board-shrink step', () => {
    const before = view(makeState({ positions: [4, 7] }));
    const after = view(makeState({ positions: [3, 7] }));
    assert.ok(!types(buildAnimationPlan(before, after)).includes('board-shrink'));
  });
});
