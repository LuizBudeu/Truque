// Reducer: phase transitions, swap flow, danger-zone ordering, special-card
// movement, game-over detection, graveyard reshuffle, illegal action rejection.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { createInitialState, applyAction, HAND_SIZE, SWAP_BUDGET } from '../shared/reducer.js';
import { isLegalAction } from '../shared/validation.js';
import { C, makeState } from './helpers.js';

describe('createInitialState', () => {
  test('deals 4 cards each from a 39-card deck, pawns at [4, 7] (Rulebook 2.3)', () => {
    const s = createInitialState(42);
    assert.equal(s.phase, 'SWAP_WINDOW');
    assert.equal(s.round, 1);
    assert.deepEqual(s.positions, [4, 7]);
    assert.equal(s.hands[0].length, HAND_SIZE);
    assert.equal(s.hands[1].length, HAND_SIZE);
    assert.equal(s.playDeck.length, 39 - 2 * HAND_SIZE);
    assert.equal(s.manilhaDeck.length, 13);
    assert.deepEqual(s.swapsRemaining, [SWAP_BUDGET, SWAP_BUDGET]);
    assert.equal(s.manilha, null);
    assert.equal(s.winner, null);
  });

  test('is deterministic per seed', () => {
    assert.deepEqual(createInitialState(7), createInitialState(7));
    assert.notDeepEqual(createInitialState(7).hands, createInitialState(8).hands);
  });
});

describe('swap window (Rulebook 2.10)', () => {
  const swapState = () => makeState({ phase: 'SWAP_WINDOW', swapDone: [false, false] });

  test('swapping discards to the graveyard and draws the same count', () => {
    const s0 = swapState();
    const s1 = applyAction(s0, {
      type: 'SWAP_CARDS',
      player: 0,
      cards: [C(2, 'hearts'), C(5, 'spades')],
    });
    assert.equal(s1.hands[0].length, 4);
    assert.deepEqual(s1.graveyard, [C(2, 'hearts'), C(5, 'spades')]); // revealed
    assert.ok(s1.hands[0].some((c) => c.rank === 4)); // drew from the deck
    assert.deepEqual(s1.swapsRemaining, [2, 4]);
    assert.equal(s1.phase, 'SWAP_WINDOW'); // window still open
  });

  test('multiple swaps allowed while budget remains; budget is enforced', () => {
    const s0 = swapState();
    const s1 = applyAction(s0, { type: 'SWAP_CARDS', player: 0, cards: [C(2, 'hearts')] });
    const s2 = applyAction(s1, { type: 'SWAP_CARDS', player: 0, cards: [C(9, 'diamonds')] });
    assert.deepEqual(s2.swapsRemaining, [2, 4]);
    const overBudget = { type: 'SWAP_CARDS', player: 0, cards: s2.hands[0].slice(0, 3) };
    assert.equal(isLegalAction(s2, 0, overBudget).legal, false);
  });

  test('exhausting the budget auto-closes the player\'s window', () => {
    const s0 = swapState();
    const s1 = applyAction(s0, { type: 'SWAP_CARDS', player: 0, cards: s0.hands[0] });
    assert.deepEqual(s1.swapsRemaining, [0, 4]);
    assert.equal(s1.swapDone[0], true);
    assert.equal(isLegalAction(s1, 0, { type: 'SKIP_SWAP', player: 0 }).legal, false);
  });

  test('both players done → manilha is drawn and picks open (§10 Q6)', () => {
    const s0 = swapState();
    const s1 = applyAction(s0, { type: 'SKIP_SWAP', player: 0 });
    assert.equal(s1.phase, 'SWAP_WINDOW');
    const s2 = applyAction(s1, { type: 'SKIP_SWAP', player: 1 });
    assert.equal(s2.phase, 'PICK_CARDS');
    assert.notEqual(s2.manilhaCard, null);
    assert.equal(s2.manilhaCard.suit, 'clubs');
    // Rulebook 2.7: numeric card → manilha rank; face/A → no manilha
    if (s2.manilhaCard.rank <= 10) assert.equal(s2.manilha, s2.manilhaCard.rank);
    else assert.equal(s2.manilha, null);
  });

  test('swapping with an empty deck reshuffles the graveyard (Rulebook 2.11)', () => {
    const s0 = makeState({
      phase: 'SWAP_WINDOW',
      swapDone: [false, false],
      playDeck: [],
      graveyard: [C(3, 'spades'), C(6, 'hearts'), C(8, 'diamonds')],
    });
    const s1 = applyAction(s0, { type: 'SWAP_CARDS', player: 0, cards: [C(2, 'hearts')] });
    assert.equal(s1.hands[0].length, 4);
    assert.equal(s1.graveyard.length, 0);
    assert.equal(s1.playDeck.length, 3); // 3 + discarded 1 − drawn 1
  });
});

describe('pick and resolve (Rulebook 2.4)', () => {
  test('first commit stays pending; second commit resolves the round', () => {
    const s0 = makeState();
    const s1 = applyAction(s0, { type: 'PLAY_CARD', player: 0, card: C(9, 'diamonds') });
    assert.equal(s1.phase, 'PICK_CARDS');
    assert.deepEqual(s1.pendingPicks[0], C(9, 'diamonds'));
    assert.equal(s1.hands[0].length, 3);
    assert.equal(s1.lastResolution, null);

    // 9♦ (9) beats 7♠ (7) at distance 2 → player 0 wins, player 1 retreats 1
    const s2 = applyAction(s1, { type: 'PLAY_CARD', player: 1, card: C(7, 'spades') });
    assert.equal(s2.phase, 'WINNER_MOVE');
    assert.equal(s2.lastResolution.winner, 0);
    assert.equal(s2.lastResolution.distance, 2);
    assert.deepEqual(s2.positions, [4, 8]); // loser already retreated (§10 Q13)
    assert.deepEqual(s2.pendingPicks, [null, null]);
    assert.deepEqual(s2.graveyard.slice(-2), [C(9, 'diamonds'), C(7, 'spades')]);
  });

  test('winner move ends the round: both draw back to 4, next swap window', () => {
    const s0 = makeState();
    const s1 = applyAction(s0, { type: 'PLAY_CARD', player: 0, card: C(9, 'diamonds') });
    const s2 = applyAction(s1, { type: 'PLAY_CARD', player: 1, card: C(7, 'spades') });
    const s3 = applyAction(s2, { type: 'CHOOSE_MOVE', player: 0, selfOffset: 2 });
    assert.deepEqual(s3.positions, [6, 8]);
    assert.equal(s3.round, 2);
    assert.equal(s3.phase, 'SWAP_WINDOW');
    assert.deepEqual(s3.swapDone, [false, false]);
    assert.equal(s3.hands[0].length, 4);
    assert.equal(s3.hands[1].length, 4);
    assert.equal(s3.manilha, null); // manilha card returned to its pile
    assert.equal(s3.manilhaCard, null);
  });

  test('winner may retreat to manipulate distance (§10 Q3)', () => {
    const s0 = makeState();
    const s1 = applyAction(s0, { type: 'PLAY_CARD', player: 0, card: C(9, 'diamonds') });
    const s2 = applyAction(s1, { type: 'PLAY_CARD', player: 1, card: C(7, 'spades') });
    const s3 = applyAction(s2, { type: 'CHOOSE_MOVE', player: 0, selfOffset: -2 });
    assert.deepEqual(s3.positions, [2, 8]);
  });
});

describe('winner move limits (§10 Q14)', () => {
  const moveState = (positions, extra = {}) =>
    makeState({
      phase: 'WINNER_MOVE',
      positions,
      lastResolution: {
        winner: 0,
        winnerMoveRange: 2,
        loserEffect: { type: 'RETREAT', amount: 1 },
        ...extra,
      },
    });

  test('only the winner may move, within the resolution range', () => {
    const s = moveState([4, 8]);
    assert.equal(isLegalAction(s, 1, { type: 'CHOOSE_MOVE', player: 1, selfOffset: 1 }).legal, false);
    assert.equal(isLegalAction(s, 0, { type: 'CHOOSE_MOVE', player: 0, selfOffset: 3 }).legal, false);
    assert.equal(isLegalAction(s, 0, { type: 'CHOOSE_MOVE', player: 0, selfOffset: 2 }).legal, true);
  });

  test('cannot pass or share a space with the opponent', () => {
    const s = moveState([6, 8]);
    assert.equal(isLegalAction(s, 0, { type: 'CHOOSE_MOVE', player: 0, selfOffset: 2 }).legal, false);
    assert.equal(isLegalAction(s, 0, { type: 'CHOOSE_MOVE', player: 0, selfOffset: 1 }).legal, true);
  });

  test('cannot retreat off the board', () => {
    const s = moveState([1, 8]);
    assert.equal(isLegalAction(s, 0, { type: 'CHOOSE_MOVE', player: 0, selfOffset: -2 }).legal, false);
    assert.equal(isLegalAction(s, 0, { type: 'CHOOSE_MOVE', player: 0, selfOffset: -1 }).legal, true);
  });

  test('Q extends the range to 5 (Rulebook 2.8)', () => {
    const s = moveState([2, 9], { winnerMoveRange: 5 });
    assert.equal(isLegalAction(s, 0, { type: 'CHOOSE_MOVE', player: 0, selfOffset: 5 }).legal, true);
  });
});

describe('special-card movement', () => {
  test('losing against A retreats 2 and can eliminate (Rulebook 2.8/2.12)', () => {
    const s0 = makeState({
      positions: [1, 7],
      hands: [
        [C(7, 'diamonds'), C(2, 'hearts'), C(3, 'hearts'), C(4, 'hearts')],
        [C(14, 'hearts'), C(2, 'spades'), C(3, 'spades'), C(4, 'spades')],
      ],
    });
    const s1 = applyAction(s0, { type: 'PLAY_CARD', player: 0, card: C(7, 'diamonds') });
    // A♥ vs 7♦: cycle says ♥ beats ♦ → player 1 wins, player 0 retreats 2 from 1
    const s2 = applyAction(s1, { type: 'PLAY_CARD', player: 1, card: C(14, 'hearts') });
    assert.equal(s2.phase, 'GAME_OVER');
    assert.equal(s2.winner, 1);
  });

  test('losing with K returns to own first space (§10 Q1)', () => {
    const s0 = makeState({
      manilha: 9,
      manilhaCard: C(9, 'clubs'),
      hands: [
        [C(13, 'spades'), C(2, 'hearts'), C(3, 'hearts'), C(4, 'hearts')],
        [C(9, 'hearts'), C(2, 'spades'), C(3, 'spades'), C(4, 'spades')],
      ],
    });
    const s1 = applyAction(s0, { type: 'PLAY_CARD', player: 0, card: C(13, 'spades') });
    // manilha 9♥ (14) beats K (13) → player 0 returns from 4 to 0
    const s2 = applyAction(s1, { type: 'PLAY_CARD', player: 1, card: C(9, 'hearts') });
    assert.equal(s2.phase, 'WINNER_MOVE');
    assert.deepEqual(s2.positions, [0, 7]);
    assert.equal(s2.lastResolution.winner, 1);
  });

  const kPushState = (positions) =>
    makeState({
      phase: 'WINNER_MOVE',
      positions,
      lastResolution: {
        winner: 0,
        winnerMoveRange: 2,
        loserEffect: { type: 'K_PUSH', maxPush: 3 },
      },
    });

  test('K winner chooses the push and their own move (Rulebook 2.8; §10 Q13)', () => {
    const s = applyAction(kPushState([4, 7]), {
      type: 'CHOOSE_MOVE',
      player: 0,
      selfOffset: 1,
      pushAmount: 3,
    });
    assert.deepEqual(s.positions, [5, 10]);
    assert.equal(s.round, 2);
  });

  test('K push clamps at the loser\'s first space (Rulebook 2.8)', () => {
    const s = applyAction(kPushState([4, 9]), {
      type: 'CHOOSE_MOVE',
      player: 0,
      selfOffset: 0,
      pushAmount: 3,
    });
    assert.deepEqual(s.positions, [4, 11]);
    assert.equal(s.winner, null);
  });

  test('K push eliminates a loser already on their first space (§10 Q14)', () => {
    const s = applyAction(kPushState([4, 11]), {
      type: 'CHOOSE_MOVE',
      player: 0,
      selfOffset: 0,
      pushAmount: 1,
    });
    assert.equal(s.phase, 'GAME_OVER');
    assert.equal(s.winner, 0);
  });

  test('K winner may decline the push', () => {
    const s = applyAction(kPushState([4, 11]), {
      type: 'CHOOSE_MOVE',
      player: 0,
      selfOffset: 1,
      pushAmount: 0,
    });
    assert.equal(s.winner, null);
    assert.deepEqual(s.positions, [5, 11]);
  });

  test('pushAmount is required with K and rejected without it', () => {
    const withK = kPushState([4, 7]);
    assert.equal(
      isLegalAction(withK, 0, { type: 'CHOOSE_MOVE', player: 0, selfOffset: 0 }).legal,
      false,
    );
    const withoutK = makeState({
      phase: 'WINNER_MOVE',
      lastResolution: { winner: 0, winnerMoveRange: 2, loserEffect: { type: 'RETREAT', amount: 1 } },
    });
    assert.equal(
      isLegalAction(withoutK, 0, { type: 'CHOOSE_MOVE', player: 0, selfOffset: 0, pushAmount: 2 }).legal,
      false,
    );
  });
});

describe('ties (Rulebook 2.4; §10 Q4/Q9)', () => {
  const jackHands = [
    [C(11, 'hearts'), C(2, 'hearts'), C(3, 'hearts'), C(4, 'hearts')],
    [C(11, 'spades'), C(2, 'spades'), C(3, 'spades'), C(4, 'spades')],
  ];
  // Player 1 commits first so the sequence stays legal when player 0 is
  // endangered (open-play ordering, Rulebook 2.9).
  const playJacks = (s0) =>
    applyAction(applyAction(s0, { type: 'PLAY_CARD', player: 1, card: C(11, 'spades') }), {
      type: 'PLAY_CARD',
      player: 0,
      card: C(11, 'hearts'),
    });

  test('both retreat 1 and the next round starts — no winner move', () => {
    const s = playJacks(makeState({ hands: jackHands }));
    assert.equal(s.lastResolution.winner, 'tie');
    assert.deepEqual(s.positions, [3, 8]);
    assert.equal(s.round, 2);
    assert.equal(s.phase, 'SWAP_WINDOW');
    assert.equal(s.hands[0].length, 4);
  });

  test('tying on your danger space loses the game (§10 Q4)', () => {
    const s = playJacks(makeState({ hands: jackHands, positions: [0, 7] }));
    assert.equal(s.phase, 'GAME_OVER');
    assert.equal(s.winner, 1);
  });

  test('both on danger spaces → draw (§10 Q9)', () => {
    const s = playJacks(makeState({ hands: jackHands, positions: [0, 11] }));
    assert.equal(s.phase, 'GAME_OVER');
    assert.equal(s.winner, 'draw');
  });
});

describe('danger-zone open play (Rulebook 2.9; §10 Q8)', () => {
  test('the endangered player must wait for the opponent\'s open card', () => {
    const s0 = makeState({ positions: [0, 7] });
    const p0Play = { type: 'PLAY_CARD', player: 0, card: C(2, 'hearts') };
    assert.equal(isLegalAction(s0, 0, p0Play).legal, false);
    assert.throws(() => applyAction(s0, p0Play), /Illegal action/);

    const s1 = applyAction(s0, { type: 'PLAY_CARD', player: 1, card: C(3, 'hearts') });
    assert.equal(isLegalAction(s1, 0, p0Play).legal, true);
  });

  test('both endangered → normal simultaneous play (Rulebook 2.9)', () => {
    const s0 = makeState({ positions: [0, 11] });
    assert.equal(
      isLegalAction(s0, 0, { type: 'PLAY_CARD', player: 0, card: C(2, 'hearts') }).legal,
      true,
    );
  });
});

describe('illegal actions and immutability', () => {
  test('phase gating and basic rejections', () => {
    const pick = makeState();
    assert.equal(isLegalAction(pick, 0, { type: 'SKIP_SWAP', player: 0 }).legal, false);
    assert.equal(isLegalAction(pick, 0, { type: 'CHOOSE_MOVE', player: 0, selfOffset: 1 }).legal, false);
    assert.equal(
      isLegalAction(pick, 0, { type: 'PLAY_CARD', player: 0, card: C(13, 'hearts') }).legal,
      false, // that card is in the OPPONENT's hand
    );
    assert.equal(isLegalAction(pick, 0, { type: 'PLAY_CARD', player: 1, card: C(3, 'hearts') }).legal, false);
    assert.equal(isLegalAction(pick, 0, { type: 'DANCE', player: 0 }).legal, false);

    const committed = applyAction(pick, { type: 'PLAY_CARD', player: 0, card: C(2, 'hearts') });
    assert.equal(
      isLegalAction(committed, 0, { type: 'PLAY_CARD', player: 0, card: C(5, 'spades') }).legal,
      false,
    );
  });

  test('nothing is legal after GAME_OVER', () => {
    const over = makeState({ phase: 'GAME_OVER', winner: 0 });
    assert.equal(isLegalAction(over, 1, { type: 'PLAY_CARD', player: 1, card: C(3, 'hearts') }).legal, false);
  });

  test('applyAction never mutates the input state', () => {
    const s0 = makeState();
    const snapshot = JSON.stringify(s0);
    applyAction(s0, { type: 'PLAY_CARD', player: 0, card: C(9, 'diamonds') });
    assert.equal(JSON.stringify(s0), snapshot);
  });
});
