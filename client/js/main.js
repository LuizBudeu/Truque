/**
 * Client bootstrap and hotseat flow control (Phase 2).
 *
 * The only module that touches the DOM: it renders the model to #app via
 * innerHTML and delegates clicks through data-action attributes. Seat and
 * curtain management live here: whenever the seat that must act changes, a
 * full-screen curtain asks for the device to be passed before revealing the
 * next player's hand. Phase 3 swaps store dispatches for net.js messages;
 * hotseat stays behind a flag as a debugging tool.
 */

import { newGame, dispatch, getState, subscribe, nextSeat, buildModel } from './store.js';
import { renderApp } from './render.js';

const app = document.querySelector('#app');

const ui = {
  screen: 'menu',
  curtain: false,
  selected: [], // hand indexes
  offset: null, // winner-move choice
  push: 0, // K push choice
  graveyardOpen: false,
};
let seat = null; // seat currently trusted with hidden info
let pendingSeat = null; // seat waiting behind the curtain

subscribe(onStateChange);
app.addEventListener('click', onClick);
rerender();

function onStateChange(state) {
  ui.selected = [];
  ui.offset = null;
  ui.push = 0;
  const next = nextSeat(state);
  if (next !== null && next !== seat) {
    pendingSeat = next;
    ui.curtain = true;
  }
  rerender();
}

function onClick(event) {
  const el = event.target.closest('[data-action]');
  if (!el || el.disabled) return;
  const { action, index, value } = el.dataset;
  const state = getState();

  switch (action) {
    case 'new-game':
    case 'rematch':
      startGame();
      break;
    case 'menu':
      ui.screen = 'menu';
      rerender();
      break;
    case 'continue':
      seat = pendingSeat;
      pendingSeat = null;
      ui.curtain = false;
      rerender();
      break;
    case 'select-card':
      toggleCard(Number(index), state.phase);
      break;
    case 'swap-selected':
      act({ type: 'SWAP_CARDS', player: seat, cards: ui.selected.map((i) => state.hands[seat][i]) });
      break;
    case 'skip-swap':
      act({ type: 'SKIP_SWAP', player: seat });
      break;
    case 'play-card':
      act({ type: 'PLAY_CARD', player: seat, card: state.hands[seat][ui.selected[0]] });
      break;
    case 'select-offset':
      ui.offset = Number(value);
      rerender();
      break;
    case 'select-push':
      ui.push = Number(value);
      rerender(); // offset legality is re-derived against the new push
      break;
    case 'confirm-move': {
      const move = { type: 'CHOOSE_MOVE', player: seat, selfOffset: ui.offset };
      if (state.lastResolution.loserEffect.type === 'K_PUSH') move.pushAmount = ui.push;
      act(move);
      break;
    }
    case 'open-graveyard':
      ui.graveyardOpen = true;
      rerender();
      break;
    case 'close-graveyard':
      ui.graveyardOpen = false;
      rerender();
      break;
  }
}

function act(action) {
  try {
    dispatch(action);
  } catch (error) {
    // The UI only offers legal actions; reaching this is a bug worth surfacing.
    console.error(error);
  }
}

function toggleCard(index, phase) {
  if (phase === 'PICK_CARDS') {
    ui.selected = ui.selected[0] === index ? [] : [index];
  } else if (phase === 'SWAP_WINDOW') {
    ui.selected = ui.selected.includes(index)
      ? ui.selected.filter((i) => i !== index)
      : [...ui.selected, index];
  }
  rerender();
}

function startGame() {
  ui.screen = 'game';
  ui.curtain = false;
  ui.graveyardOpen = false;
  seat = null;
  pendingSeat = null;
  newGame(Date.now() >>> 0); // seeded RNG lives in /shared; the seed itself may be wall-clock
}

function rerender() {
  const state = getState();
  if (ui.screen === 'menu' || !state) {
    app.innerHTML = renderApp({ screen: 'menu' });
    return;
  }
  const displaySeat = ui.curtain ? pendingSeat : (seat ?? 0);
  app.innerHTML = renderApp(buildModel(state, displaySeat, ui));
}
