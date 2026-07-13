// Scenario tests: full games driven end-to-end through the reducer alone —
// seeded random games with invariants checked after every action, plus a
// fully scripted multi-round game with hand-verified expectations.
// Add a scripted scenario here for every bug found.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { applyAction } from '../shared/reducer.js';
import { C, makeState, autoPlay, checkInvariants } from './helpers.js';

describe('seeded random games', () => {
  test('complete games play out through function calls alone, invariants intact', () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const { state, steps } = autoPlay(seed, { onStep: checkInvariants });
      assert.notEqual(state.winner, null, `seed ${seed}: game did not finish in ${steps} steps`);
      assert.equal(state.phase, 'GAME_OVER');
    }
  });

  test('same seed and policy → identical game (reproducible bugs)', () => {
    const a = autoPlay(99);
    const b = autoPlay(99);
    assert.equal(a.steps, b.steps);
    assert.deepEqual(a.state, b.state);
  });
});

describe('scripted three-round game', () => {
  // manilhaDeck of face cards only → every round is guaranteed manilha-less,
  // keeping the script's combat math deterministic.
  const noManilhaDeck = Array.from({ length: 13 }, () => C(11, 'clubs'));

  test('plays exactly as hand-computed', () => {
    let s = makeState({
      hands: [
        [C(7, 'spades'), C(9, 'diamonds'), C(11, 'hearts'), C(2, 'hearts')],
        [C(5, 'spades'), C(10, 'diamonds'), C(13, 'hearts'), C(3, 'hearts')],
      ],
      manilhaDeck: noManilhaDeck,
      manilhaCard: C(11, 'clubs'),
    });

    // Round 1: 7♠ (7) vs 5♠ (5) at distance 2 → player 0 wins, player 1
    // retreats to 8; winner advances 2 → [6, 8].
    s = applyAction(s, { type: 'PLAY_CARD', player: 0, card: C(7, 'spades') });
    s = applyAction(s, { type: 'PLAY_CARD', player: 1, card: C(5, 'spades') });
    assert.equal(s.lastResolution.winner, 0);
    assert.deepEqual(s.positions, [4, 8]);
    s = applyAction(s, { type: 'CHOOSE_MOVE', player: 0, selfOffset: 2 });
    assert.deepEqual(s.positions, [6, 8]);
    assert.equal(s.round, 2);
    assert.equal(s.phase, 'SWAP_WINDOW');

    // Round 2: both skip swapping; J♥ vs K♥ — K wins numerically (13 vs 11,
    // buffs removed), the J flips it: player 0 wins, player 1 lost WITH K and
    // returns to their first space (11). Winner stays put.
    s = applyAction(s, { type: 'SKIP_SWAP', player: 0 });
    s = applyAction(s, { type: 'SKIP_SWAP', player: 1 });
    assert.equal(s.manilha, null); // face card → no manilha
    s = applyAction(s, { type: 'PLAY_CARD', player: 0, card: C(11, 'hearts') });
    s = applyAction(s, { type: 'PLAY_CARD', player: 1, card: C(13, 'hearts') });
    assert.equal(s.lastResolution.inverted, true);
    assert.equal(s.lastResolution.winner, 0);
    assert.deepEqual(s.positions, [6, 11]);
    s = applyAction(s, { type: 'CHOOSE_MOVE', player: 0, selfOffset: 0 });
    assert.equal(s.round, 3);

    // Round 3: player 1 is endangered → player 0 must play open first
    // (Rulebook 2.9). 2♥ (2) vs 3♥ (3) → player 1 wins, player 0 retreats
    // to 5; winner advances 2 → [5, 9].
    s = applyAction(s, { type: 'SKIP_SWAP', player: 0 });
    s = applyAction(s, { type: 'SKIP_SWAP', player: 1 });
    assert.throws(
      () => applyAction(s, { type: 'PLAY_CARD', player: 1, card: C(3, 'hearts') }),
      /open first/,
    );
    s = applyAction(s, { type: 'PLAY_CARD', player: 0, card: C(2, 'hearts') });
    s = applyAction(s, { type: 'PLAY_CARD', player: 1, card: C(3, 'hearts') });
    assert.equal(s.lastResolution.winner, 1);
    assert.deepEqual(s.positions, [5, 11]);
    s = applyAction(s, { type: 'CHOOSE_MOVE', player: 1, selfOffset: 2 });
    assert.deepEqual(s.positions, [5, 9]);
    assert.equal(s.round, 4);

    // Hands refilled from the known deck order every round.
    assert.deepEqual(s.hands[0], [C(9, 'diamonds'), C(4, 'hearts'), C(4, 'diamonds'), C(6, 'spades')]);
    assert.deepEqual(s.hands[1], [C(10, 'diamonds'), C(4, 'spades'), C(6, 'hearts'), C(6, 'diamonds')]);
    assert.equal(s.playDeck.length, 2);
    assert.equal(s.graveyard.length, 6);
  });
});
