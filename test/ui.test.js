// Rendering tests: renderApp is a pure model → HTML function, so the whole
// hotseat UI is exercised in Node — including a UI-level hidden-information
// sweep across full games (the opponent's cards must never be in the markup).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { renderApp } from '../client/js/render.js';
import { nextSeat, buildModel } from '../client/js/store.js';
import { applyAction } from '../shared/reducer.js';
import { C, makeState, autoPlay } from './helpers.js';

const ui = (overrides = {}) => ({
  curtain: false,
  selected: [],
  offset: null,
  push: 0,
  graveyardOpen: false,
  ...overrides,
});

const cardMarker = (c) => `data-card="${c.rank}-${c.suit}"`;

describe('screens', () => {
  test('menu offers a new hotseat game', () => {
    const html = renderApp({ screen: 'menu' });
    assert.ok(html.includes('data-action="new-game"'));
  });

  test('game screen shows own hand, board, and HUD — never opponent cards', () => {
    const html = renderApp(buildModel(makeState(), 0, ui()));
    assert.ok(html.includes(cardMarker(C(2, 'hearts')))); // own card
    assert.ok(!html.includes(cardMarker(C(13, 'hearts')))); // opponent's card
    assert.ok(html.includes('class="board"'));
    assert.ok(html.includes('Round 1'));
    assert.ok(html.includes('data-action="play-card"'));
    assert.ok(html.includes('data-action="open-graveyard"'));
  });

  test('curtain hides every card and asks to pass the device', () => {
    const html = renderApp(buildModel(makeState(), 1, ui({ curtain: true })));
    assert.ok(html.includes('Pass the device to Player 2'));
    assert.ok(html.includes('data-action="continue"'));
    assert.ok(!html.includes('data-card='));
  });

  test('curtain shows the public round result so both players see the reveal', () => {
    const s = makeState({
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
    });
    const html = renderApp(buildModel(s, 0, ui({ curtain: true })));
    assert.ok(html.includes('Player 1 wins the round'));
    assert.ok(html.includes(cardMarker(C(9, 'diamonds')))); // played cards are public
  });
});

describe('phase-specific affordances', () => {
  test('swap window renders swap and skip controls', () => {
    const html = renderApp(
      buildModel(makeState({ phase: 'SWAP_WINDOW', swapDone: [false, false] }), 0, ui()),
    );
    assert.ok(html.includes('data-action="swap-selected"'));
    assert.ok(html.includes('data-action="skip-swap"'));
  });

  test('open play: the endangered player sees the opponent\'s revealed card', () => {
    const s0 = makeState({ positions: [0, 7] });
    const s1 = applyAction(s0, { type: 'PLAY_CARD', player: 1, card: C(7, 'spades') });
    const endangered = renderApp(buildModel(s1, 0, ui()));
    assert.ok(endangered.includes('had to play openly'));
    assert.ok(endangered.includes(cardMarker(C(7, 'spades'))));
    // The open player got a warning before committing
    const warned = renderApp(buildModel(s0, 1, ui()));
    assert.ok(warned.includes('You must play openly'));
  });

  test('winner move renders offset buttons with legality and a push row for K', () => {
    const s = makeState({
      phase: 'WINNER_MOVE',
      positions: [4, 5],
      lastResolution: {
        winner: 0,
        cards: [C(13, 'spades'), C(9, 'hearts')],
        effectiveValues: [13, 9],
        manilha: null,
        usedSuitCycle: false,
        inverted: false,
        buffsRemoved: true,
        loserEffect: { type: 'K_PUSH', maxPush: 3 },
        winnerMoveRange: 2,
        distance: 0,
      },
    });
    const html = renderApp(buildModel(s, 0, ui({ push: 0 })));
    assert.ok(html.includes('data-action="select-push"'));
    assert.ok(html.includes('data-action="select-offset"'));
    assert.ok(html.includes('data-action="confirm-move"'));
    assert.ok(/data-value="1"[^>]*disabled/.test(html)); // advance blocked at push 0
  });

  test('game over announces the winner with rematch and menu actions', () => {
    const html = renderApp(buildModel(makeState({ phase: 'GAME_OVER', winner: 1 }), 0, ui()));
    assert.ok(html.includes('Player 2 wins the game!'));
    assert.ok(html.includes('data-action="rematch"'));
    assert.ok(html.includes('data-action="menu"'));
    assert.ok(!html.includes('data-action="select-card"')); // hands are put away
  });

  test('graveyard modal lists the public discards', () => {
    const s = makeState({ graveyard: [C(8, 'hearts'), C(3, 'spades')] });
    const html = renderApp(buildModel(s, 0, ui({ graveyardOpen: true })));
    assert.ok(html.includes('Graveyard (2)'));
    assert.ok(html.includes(cardMarker(C(8, 'hearts'))));
    assert.ok(html.includes('data-action="close-graveyard"'));
  });
});

describe('full-game render sweep', () => {
  test('every state of a full game renders cleanly and leaks nothing', () => {
    const checkHTML = (html, state, seat, label) => {
      for (const bad of ['undefined', 'NaN', '[object']) {
        assert.ok(!html.includes(bad), `${label}: rendered "${bad}"`);
      }
      for (const card of state.hands[1 - seat]) {
        assert.ok(
          !html.includes(cardMarker(card)),
          `${label}: opponent card ${card.rank}-${card.suit} in markup (phase ${state.phase})`,
        );
      }
    };
    for (const seed of [17, 51]) {
      const { state: final } = autoPlay(seed, {
        onStep: (state) => {
          const seat = nextSeat(state) ?? 0;
          checkHTML(renderApp(buildModel(state, seat, ui())), state, seat, `seed ${seed}`);
          checkHTML(
            renderApp(buildModel(state, seat, ui({ curtain: true }))),
            state,
            seat,
            `seed ${seed} (curtain)`,
          );
        },
      });
      const html = renderApp(buildModel(final, 0, ui()));
      assert.ok(html.includes('wins the game!') || html.includes('draw'));
    }
  });
});
