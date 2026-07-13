// Hotseat flow logic (client/js/store.js): who acts next, and the derived
// move options handed to the renderer.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { nextSeat, buildModel } from '../client/js/store.js';
import { applyAction } from '../shared/reducer.js';
import { C, makeState } from './helpers.js';

const ui = { curtain: false, selected: [], offset: null, push: 0, graveyardOpen: false };

describe('nextSeat', () => {
  test('swap window: player 0 first, then player 1, in commit order', () => {
    const s = makeState({ phase: 'SWAP_WINDOW', swapDone: [false, false] });
    assert.equal(nextSeat(s), 0);
    assert.equal(nextSeat({ ...s, swapDone: [true, false] }), 1);
    assert.equal(nextSeat({ ...s, swapDone: [false, true] }), 0);
  });

  test('pick phase: player 0 first unless already committed', () => {
    const s = makeState();
    assert.equal(nextSeat(s), 0);
    const s1 = applyAction(s, { type: 'PLAY_CARD', player: 0, card: C(2, 'hearts') });
    assert.equal(nextSeat(s1), 1);
  });

  test('danger zone: the non-endangered player picks first (Rulebook 2.9)', () => {
    const s = makeState({ positions: [0, 7] });
    assert.equal(nextSeat(s), 1);
    const s1 = applyAction(s, { type: 'PLAY_CARD', player: 1, card: C(3, 'hearts') });
    assert.equal(nextSeat(s1), 0);
    // Both endangered → normal order
    assert.equal(nextSeat(makeState({ positions: [0, 11] })), 0);
  });

  test('winner move: the round winner; game over: nobody', () => {
    const winnerMove = makeState({
      phase: 'WINNER_MOVE',
      lastResolution: { winner: 1, winnerMoveRange: 2, loserEffect: { type: 'RETREAT', amount: 1 } },
    });
    assert.equal(nextSeat(winnerMove), 1);
    assert.equal(nextSeat(makeState({ phase: 'GAME_OVER', winner: 0 })), null);
  });
});

describe('buildModel', () => {
  test('provides the seat\'s filtered view', () => {
    const model = buildModel(makeState(), 1, ui);
    assert.equal(model.view.playerIndex, 1);
    assert.equal(model.view.opponentHandCount, 4);
    assert.equal(model.move, undefined);
  });

  test('winner move options carry per-offset legality', () => {
    const s = makeState({
      phase: 'WINNER_MOVE',
      positions: [6, 8],
      lastResolution: { winner: 0, winnerMoveRange: 2, loserEffect: { type: 'RETREAT', amount: 1 } },
    });
    const model = buildModel(s, 0, ui);
    assert.equal(model.move.pushes, null);
    const byValue = Object.fromEntries(model.move.offsets.map((o) => [o.value, o.legal]));
    assert.equal(byValue[1], true); // to 7, adjacent to the opponent
    assert.equal(byValue[2], false); // would share the opponent's space
    assert.equal(byValue[-2], true);
  });

  test('K push exposes push choices and validates offsets against the chosen push', () => {
    const s = makeState({
      phase: 'WINNER_MOVE',
      positions: [4, 5],
      lastResolution: { winner: 0, winnerMoveRange: 2, loserEffect: { type: 'K_PUSH', maxPush: 3 } },
    });
    // With push 0 the opponent stays adjacent: no advance possible.
    const stay = buildModel(s, 0, { ...ui, push: 0 });
    assert.deepEqual(stay.move.pushes, [0, 1, 2, 3]);
    assert.equal(stay.move.offsets.find((o) => o.value === 1).legal, false);
    // Pushing 2 opens the space ahead.
    const pushed = buildModel(s, 0, { ...ui, push: 2 });
    assert.equal(pushed.move.offsets.find((o) => o.value === 1).legal, true);
  });
});
