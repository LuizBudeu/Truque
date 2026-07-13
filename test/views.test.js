// Hidden-information tests: views built for every phase of real games must
// never contain the opponent's hidden cards, deck contents/order, or the RNG
// cursor — with the danger-zone early-reveal exception behaving exactly as
// specified (PLANNING.md §3.4).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { getPlayerView } from '../shared/views.js';
import { applyAction } from '../shared/reducer.js';
import { DANGER_SPACES } from '../shared/rules.js';
import { C, makeState, autoPlay } from './helpers.js';

/** The exact serialization of a card in a view (insertion order is rank, suit). */
const cardToken = (c) => `{"rank":${c.rank},"suit":"${c.suit}"}`;

const FORBIDDEN_KEYS = ['hands', 'playDeck', 'manilhaDeck', 'pendingPicks', 'rngState'];

describe('basic filtering', () => {
  test('own hand is full cards; opponent and decks are counts only', () => {
    const s = makeState();
    const view = getPlayerView(s, 0);
    assert.deepEqual(view.hand, s.hands[0]);
    assert.equal(view.opponentHandCount, 4);
    assert.equal(view.playDeckCount, s.playDeck.length);
    assert.equal(view.manilhaDeckCount, 13);
    for (const key of FORBIDDEN_KEYS) assert.equal(key in view, false, `leaked key ${key}`);
  });

  test('graveyard, manilha, positions, and swaps are public', () => {
    const s = makeState({ graveyard: [C(8, 'hearts')], manilha: 8, manilhaCard: C(8, 'clubs') });
    for (const p of [0, 1]) {
      const view = getPlayerView(s, p);
      assert.deepEqual(view.graveyard, [C(8, 'hearts')]);
      assert.equal(view.manilha, 8);
      assert.deepEqual(view.positions, [4, 7]);
      assert.deepEqual(view.swapsRemaining, [4, 4]);
    }
  });

  test('views are copies — mutating a view never touches the state', () => {
    const s = makeState();
    const view = getPlayerView(s, 0);
    view.hand[0].rank = 99;
    view.positions[0] = 99;
    assert.equal(s.hands[0][0].rank, 2);
    assert.equal(s.positions[0], 4);
  });
});

describe('committed picks', () => {
  test('opponent sees the commitment, never the card', () => {
    const s = applyAction(makeState(), { type: 'PLAY_CARD', player: 1, card: C(7, 'spades') });
    const view0 = getPlayerView(s, 0);
    assert.equal(view0.opponentCommitted, true);
    assert.equal(view0.openCard, null); // nobody endangered → stays secret
    assert.equal(JSON.stringify(view0).includes(cardToken(C(7, 'spades'))), false);

    const view1 = getPlayerView(s, 1);
    assert.equal(view1.selfCommitted, true);
    assert.deepEqual(view1.selfPick, C(7, 'spades'));
  });
});

describe('danger-zone early reveal (Rulebook 2.9; §10 Q8)', () => {
  test('the endangered player sees the opponent\'s open card', () => {
    const s0 = makeState({ positions: [0, 7] });
    const s1 = applyAction(s0, { type: 'PLAY_CARD', player: 1, card: C(7, 'spades') });
    assert.deepEqual(getPlayerView(s1, 0).openCard, C(7, 'spades'));
    assert.equal(getPlayerView(s1, 1).openCard, null);
  });

  test('both endangered → normal play, no early reveal', () => {
    const s0 = makeState({ positions: [0, 11] });
    const s1 = applyAction(s0, { type: 'PLAY_CARD', player: 0, card: C(2, 'hearts') });
    const view1 = getPlayerView(s1, 1);
    assert.equal(view1.openCard, null);
    assert.equal(JSON.stringify(view1).includes(cardToken(C(2, 'hearts'))), false);
  });
});

describe('leak sweep over full games', () => {
  test('no hidden card, deck content, or RNG cursor ever reaches a view', () => {
    for (const seed of [11, 22, 33]) {
      const { state } = autoPlay(seed, {
        onStep: (s) => {
          const endangered = [0, 1].map((p) => s.positions[p] === DANGER_SPACES[p]);
          const openPlay = s.phase === 'PICK_CARDS' && endangered[0] !== endangered[1];
          const openPlayer = endangered[0] ? 1 : 0;

          for (const p of [0, 1]) {
            const view = getPlayerView(s, p);
            for (const key of FORBIDDEN_KEYS) {
              assert.equal(key in view, false, `leaked key ${key} (seed ${seed})`);
            }
            const json = JSON.stringify(view);
            const opponent = 1 - p;
            for (const card of s.hands[opponent]) {
              assert.equal(
                json.includes(cardToken(card)),
                false,
                `opponent hand card ${cardToken(card)} leaked to player ${p} (seed ${seed}, phase ${s.phase})`,
              );
            }
            const opponentPick = s.pendingPicks[opponent];
            const allowedReveal = openPlay && opponent === openPlayer;
            if (opponentPick && !allowedReveal) {
              assert.equal(
                json.includes(cardToken(opponentPick)),
                false,
                `secret pick leaked to player ${p} (seed ${seed})`,
              );
            }
          }
        },
      });
      assert.notEqual(state.winner, null, `game ${seed} should finish`);
    }
  });
});
