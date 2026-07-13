// Rendering tests: renderApp is a pure model → HTML function, so the whole
// hotseat UI is exercised in Node — including a UI-level hidden-information
// sweep across full games (the opponent's cards must never be in the markup).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { renderApp } from '../client/js/render.js';
import { nextSeat, buildModel, buildViewModel } from '../client/js/store.js';
import { applyAction } from '../shared/reducer.js';
import { getPlayerView } from '../shared/views.js';
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

/** Model as main.js builds it in online mode. */
const onlineModel = (state, seat, uiOverrides = {}, extra = {}) =>
  buildViewModel(getPlayerView(state, seat), ui(uiOverrides), {
    online: true,
    connection: 'open',
    opponentConnected: true,
    ...extra,
  });

describe('screens', () => {
  test('menu offers online play; hotseat only behind the debug flag', () => {
    const html = renderApp({ screen: 'menu' });
    assert.ok(html.includes('data-action="create-room"'));
    assert.ok(html.includes('data-action="join-room"'));
    assert.ok(html.includes('id="join-code"'));
    assert.ok(!html.includes('data-action="new-game"'));
    const debug = renderApp({ screen: 'menu', hotseatEnabled: true });
    assert.ok(debug.includes('data-action="new-game"'));
  });

  test('menu surfaces a rejection reason', () => {
    const html = renderApp({ screen: 'menu', error: 'room not found' });
    assert.ok(html.includes('room not found'));
  });

  test('lobby shows the join code, a copy-link button, and a cancel action', () => {
    const html = renderApp({ screen: 'lobby', roomCode: 'ABCD', connection: 'open' });
    assert.ok(html.includes('ABCD'));
    assert.ok(html.includes('Waiting for your opponent'));
    assert.ok(html.includes('data-action="copy-link"'));
    assert.ok(html.includes('Copy invite link'));
    assert.ok(html.includes('data-action="leave-room"'));
  });

  test('lobby copy-link button confirms once the link is copied', () => {
    const html = renderApp({ screen: 'lobby', roomCode: 'ABCD', connection: 'open', copied: true });
    assert.ok(html.includes('Link copied!'));
    assert.ok(!html.includes('Copy invite link'));
  });

  test('game screen shows own hand, board, and HUD — never opponent cards', () => {
    const html = renderApp(buildModel(makeState(), 0, ui()));
    assert.ok(html.includes(cardMarker(C(2, 'hearts')))); // own card
    assert.ok(!html.includes(cardMarker(C(13, 'hearts')))); // opponent's card
    assert.ok(html.includes('class="board"'));
    assert.ok(html.includes('Round 1'));
    assert.ok(html.includes('data-action="play-card"'));
    assert.ok(html.includes('data-action="open-graveyard"'));
    assert.ok(html.includes('data-action="toggle-mute"'));
  });

  test('the mute toggle reflects the sound preference', () => {
    const on = renderApp(buildModel(makeState(), 0, ui()));
    assert.ok(on.includes('🔊'));
    const off = renderApp(buildModel(makeState(), 0, ui({ muted: true })));
    assert.ok(off.includes('🔇'));
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

  test('the sidebar round-history log lists resolved rounds newest-first', () => {
    const entry = (round, winner) => ({
      round,
      winner,
      cards: [C(9, 'diamonds'), C(7, 'spades')],
      effectiveValues: [9, 7],
      manilha: null,
      usedSuitCycle: false,
      inverted: false,
      buffsRemoved: false,
      loserEffect: { type: 'RETREAT', amount: 1 },
      winnerMoveRange: 2,
      distance: 2,
    });
    const s = makeState({ history: [entry(1, 0), entry(2, 1)] });
    const html = renderApp(buildModel(s, 0, ui()));
    assert.ok(html.includes('Round history'));
    assert.ok(html.includes('class="round-log"'));
    // Newest round (R2) is rendered before the oldest (R1).
    assert.ok(html.indexOf('R2') < html.indexOf('R1'));
  });

  test('graveyard modal lists the public discards', () => {
    const s = makeState({ graveyard: [C(8, 'hearts'), C(3, 'spades')] });
    const html = renderApp(buildModel(s, 0, ui({ graveyardOpen: true })));
    assert.ok(html.includes('Graveyard (2)'));
    assert.ok(html.includes(cardMarker(C(8, 'hearts'))));
    assert.ok(html.includes('data-action="close-graveyard"'));
  });
});

describe('online play (Phase 3)', () => {
  test('a committed pick shows the waiting state instead of the play button', () => {
    const s = applyAction(makeState(), { type: 'PLAY_CARD', player: 0, card: C(2, 'hearts') });
    const html = renderApp(onlineModel(s, 0));
    assert.ok(html.includes('waiting for your opponent'));
    assert.ok(!html.includes('data-action="play-card"'));
    // The other seat still gets to pick.
    assert.ok(renderApp(onlineModel(s, 1)).includes('data-action="play-card"'));
  });

  test('the endangered player waits for the open card before picking', () => {
    const s = makeState({ positions: [0, 7] });
    const html = renderApp(onlineModel(s, 0));
    assert.ok(html.includes('play openly first'));
    assert.ok(!html.includes('data-action="play-card"'));
  });

  test('a closed swap window shows the waiting state', () => {
    const s = makeState({ phase: 'SWAP_WINDOW', swapDone: [true, false] });
    const html = renderApp(onlineModel(s, 0));
    assert.ok(html.includes('Swap window closed'));
    assert.ok(!html.includes('data-action="skip-swap"'));
  });

  test('connection and opponent-status banners', () => {
    const s = makeState();
    assert.ok(renderApp(onlineModel(s, 0)).includes('banner') === false);
    assert.ok(
      renderApp(onlineModel(s, 0, {}, { opponentConnected: false })).includes(
        'opponent disconnected',
      ),
    );
    assert.ok(
      renderApp(onlineModel(s, 0, {}, { connection: 'closed' })).includes('Connection lost'),
    );
  });

  test('game over speaks to the player and offers a rematch or leave', () => {
    const s = makeState({ phase: 'GAME_OVER', winner: 1 });
    const loser = renderApp(onlineModel(s, 0));
    assert.ok(loser.includes('You lose'));
    const winner = renderApp(onlineModel(s, 1));
    assert.ok(winner.includes('You win the game!'));
    assert.ok(winner.includes('data-action="request-rematch"'));
    assert.ok(winner.includes('data-action="leave-room"'));
  });

  test('rematch button flips to a waiting state once you have voted', () => {
    const s = makeState({ phase: 'GAME_OVER', winner: 1 });
    const asked = renderApp(onlineModel(s, 0, {}, { rematch: { you: true, opponent: false } }));
    assert.ok(!asked.includes('data-action="request-rematch"'));
    assert.ok(asked.includes('Waiting for opponent'));
    assert.ok(asked.includes('Rematch requested'));
  });

  test('the opponent asking for a rematch is surfaced', () => {
    const s = makeState({ phase: 'GAME_OVER', winner: 1 });
    const html = renderApp(onlineModel(s, 0, {}, { rematch: { you: false, opponent: true } }));
    assert.ok(html.includes('Your opponent wants a rematch'));
    assert.ok(html.includes('data-action="request-rematch"'));
  });
});

describe('concede', () => {
  test('HUD offers concede with a two-step confirm', () => {
    const s = makeState();
    const html = renderApp(buildModel(s, 0, ui()));
    assert.ok(html.includes('data-action="concede"'));
    assert.ok(!html.includes('data-action="confirm-concede"'));
    const armed = renderApp(buildModel(s, 0, ui({ concedeArmed: true })));
    assert.ok(armed.includes('data-action="confirm-concede"'));
    assert.ok(armed.includes('data-action="cancel-concede"'));
    assert.ok(!armed.includes('data-action="concede"')); // arm button replaced
  });

  test('no concede control once the game is over', () => {
    const html = renderApp(buildModel(makeState({ phase: 'GAME_OVER', winner: 1 }), 0, ui()));
    assert.ok(!html.includes('data-action="concede"'));
    assert.ok(!html.includes('data-action="confirm-concede"'));
  });

  test('game-over wording explains a concession in both modes', () => {
    const s = makeState({ phase: 'GAME_OVER', winner: 1, concededBy: 0 });
    assert.ok(
      renderApp(buildModel(s, 0, ui())).includes('Player 1 conceded — Player 2 wins the game!'),
    );
    assert.ok(renderApp(onlineModel(s, 0)).includes('You conceded — your opponent wins the game.'));
    assert.ok(renderApp(onlineModel(s, 1)).includes('Your opponent conceded — you win the game!'));
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
          // Online renders BOTH seats at every state (no curtain to hide behind).
          for (const p of [0, 1]) {
            checkHTML(renderApp(onlineModel(state, p)), state, p, `seed ${seed} (online seat ${p})`);
          }
        },
      });
      const html = renderApp(buildModel(final, 0, ui()));
      assert.ok(html.includes('wins the game!') || html.includes('draw'));
    }
  });
});

describe('phase 4 visuals', () => {
  test('buff bar reads the current distance modifiers (Rulebook 2.6, Table 1)', () => {
    const html = renderApp(buildModel(makeState({ positions: [4, 5] }), 0, ui()));
    assert.ok(html.includes('Distance <b>0</b>'));
    assert.ok(/suit-spades buffed[^>]*>.*\+3/.test(html)); // ♠ close-range buff
    assert.ok(/suit-diamonds nerfed[^>]*>.*-2/.test(html)); // ♦ close-range nerf
  });

  test('opponent row shows face-down cards only, plus the committed cue', () => {
    const s0 = makeState();
    const before = renderApp(onlineModel(s0, 0));
    assert.ok(!before.includes('Card committed'));
    assert.equal(before.match(/card-back/g).length >= s0.hands[1].length, true);
    const s1 = applyAction(s0, { type: 'PLAY_CARD', player: 1, card: C(3, 'hearts') });
    assert.ok(renderApp(onlineModel(s1, 0)).includes('Card committed'));
  });

  test('danger-zone cue: the threatened tower lights up', () => {
    const safe = renderApp(buildModel(makeState(), 0, ui()));
    assert.ok(!safe.includes('tower-left alert'));
    const html = renderApp(buildModel(makeState({ positions: [0, 7] }), 1, ui()));
    assert.ok(html.includes('tower-left alert'));
    assert.ok(!html.includes('tower-right alert'));
  });

  test('reveal panel breaks the values down: base, distance modifier, total', () => {
    const s = makeState({
      phase: 'WINNER_MOVE',
      positions: [4, 8],
      lastResolution: {
        winner: 0,
        cards: [C(9, 'diamonds'), C(7, 'spades')],
        effectiveValues: [10, 6],
        manilha: null,
        usedSuitCycle: false,
        inverted: false,
        buffsRemoved: false,
        loserEffect: { type: 'RETREAT', amount: 1 },
        winnerMoveRange: 2,
        distance: 3,
      },
    });
    const html = renderApp(buildModel(s, 0, ui()));
    assert.ok(html.includes('+1 dist')); // ♦ at distance 3
    assert.ok(html.includes('<b>= 10</b>'));
    assert.ok(html.includes('-1 dist')); // ♠ at distance 3
    assert.ok(html.includes('<b>= 6</b>'));
  });

  test('a played manilha shows the flat-14 breakdown', () => {
    const s = makeState({
      phase: 'WINNER_MOVE',
      lastResolution: {
        winner: 0,
        cards: [C(5, 'hearts'), C(10, 'diamonds')],
        effectiveValues: [14, 10],
        manilha: 5,
        usedSuitCycle: false,
        inverted: false,
        buffsRemoved: false,
        loserEffect: { type: 'RETREAT', amount: 1 },
        winnerMoveRange: 2,
        distance: 2,
      },
    });
    const html = renderApp(buildModel(s, 0, ui()));
    assert.ok(html.includes('Manilha <b>= 14</b>'));
  });

  test('suit-cycle reference is always on the game screen', () => {
    const html = renderApp(buildModel(makeState(), 0, ui()));
    assert.ok(html.includes('cycle-triangle'));
    for (const suit of ['hearts', 'diamonds', 'spades']) {
      assert.ok(new RegExp(`cycle-corner[^>]*suit-${suit}`).test(html), suit);
    }
  });

  test('fantasy-suit toggle: theme class on the screen root, glyphs stay in CSS', () => {
    const plain = renderApp(buildModel(makeState(), 0, ui()));
    assert.ok(!plain.includes('theme-fantasy'));
    assert.ok(plain.includes('data-action="toggle-suits"'));
    const fantasy = renderApp(buildModel(makeState(), 0, ui({ fantasySuits: true })));
    assert.ok(fantasy.includes('theme-fantasy'));
    // The markup is theme-agnostic: suit marks are empty data-suit elements,
    // so no literal glyph swap can desync the two themes.
    assert.ok(fantasy.includes('data-suit="hearts"'));
  });

  test('the last-round box sits in the sidebar, not the main column', () => {
    const s = makeState({
      phase: 'WINNER_MOVE',
      positions: [4, 8],
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
        distance: 3,
      },
    });
    const html = renderApp(buildModel(s, 0, ui()));
    const side = html.slice(html.indexOf('<aside class="game-side"'));
    assert.ok(side.includes('reveal-panel'));
    assert.ok(!html.slice(0, html.indexOf('<aside')).includes('reveal-panel'));
    // No resolution yet → sidebar still carries the suit-cycle reference.
    const fresh = renderApp(buildModel(makeState(), 0, ui()));
    assert.ok(fresh.includes('game-side'));
    assert.ok(!fresh.includes('reveal-panel'));
  });

  test('online reveal speaks to the seat: You vs Opponent', () => {
    const s = makeState({
      phase: 'WINNER_MOVE',
      positions: [4, 8],
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
        distance: 3,
      },
    });
    assert.ok(renderApp(onlineModel(s, 0)).includes('You wins the round') === false);
    assert.ok(renderApp(onlineModel(s, 0)).includes('You win the round'));
    assert.ok(renderApp(onlineModel(s, 1)).includes('Opponent wins the round'));
    assert.ok(renderApp(onlineModel(s, 1)).includes('You retreat 1'));
  });
});
