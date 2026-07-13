/**
 * Client bootstrap and flow control — the only module that touches the DOM:
 * it renders the model to #app via innerHTML and delegates clicks through
 * data-action attributes.
 *
 * Two modes share the same render pipeline (action → … → view → render):
 * - Online (Phase 3): net.js talks to the authoritative server; the last
 *   received view is all the client holds. {roomCode, playerToken} live in
 *   sessionStorage so a refresh rejoins the same seat.
 * - Hotseat (Phase 2, kept behind ?hotseat as a debugging tool): the store
 *   runs the reducer locally, with the pass-the-device curtain.
 */

import { newGame, dispatch, getState, subscribe, nextSeat, buildModel, buildViewModel } from './store.js';
import { renderApp } from './render.js';
import { createConnection } from './net.js';

const app = document.querySelector('#app');
const SESSION_KEY = 'truque-session';
const HOTSEAT_ENABLED = new URLSearchParams(location.search).has('hotseat');

const ui = {
  curtain: false,
  selected: [], // hand indexes
  offset: null, // winner-move choice
  push: 0, // K push choice
  graveyardOpen: false,
  concedeArmed: false, // first concede click; the HUD asks for confirmation
};

let mode = 'menu'; // 'menu' | 'hotseat' | 'online'
let menuError = null;
let lastModel = null; // model of the last render; handlers read cards from its view

// Hotseat: seat currently trusted with hidden info / seat behind the curtain.
let seat = null;
let pendingSeat = null;

// Online connection state.
let net = null;
const online = {
  connection: 'closed', // net.js status
  roomCode: null,
  playerToken: null,
  playerIndex: null,
  view: null, // last VIEW from the server; null while in the lobby
  opponentConnected: false,
  intent: null, // what to send when the socket (re)opens
};

subscribe(onHotseatStateChange);
app.addEventListener('click', onClick);
app.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && event.target.id === 'join-code') joinFromInput();
});

// A refresh mid-game rejoins the saved seat automatically.
const savedSession = readSession();
if (savedSession) {
  goOnline({ roomCode: savedSession.roomCode, playerToken: savedSession.playerToken });
} else {
  rerender();
}

// ---------------------------------------------------------------------------
// Input handling
// ---------------------------------------------------------------------------

function onClick(event) {
  const el = event.target.closest('[data-action]');
  if (!el || el.disabled) return;
  const { action, index, value } = el.dataset;
  const view = lastModel?.view;

  switch (action) {
    case 'new-game':
    case 'rematch':
      startHotseat();
      break;
    case 'menu':
      mode = 'menu';
      rerender();
      break;
    case 'create-room':
      goOnline({ create: true });
      break;
    case 'join-room':
      joinFromInput();
      break;
    case 'leave-room':
      leaveOnline();
      break;
    case 'continue': // hotseat curtain
      seat = pendingSeat;
      pendingSeat = null;
      ui.curtain = false;
      rerender();
      break;
    case 'select-card':
      toggleCard(Number(index), view.phase);
      break;
    case 'swap-selected':
      act({ type: 'SWAP_CARDS', player: mySeat(), cards: ui.selected.map((i) => view.hand[i]) });
      break;
    case 'skip-swap':
      act({ type: 'SKIP_SWAP', player: mySeat() });
      break;
    case 'play-card':
      act({ type: 'PLAY_CARD', player: mySeat(), card: view.hand[ui.selected[0]] });
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
      const move = { type: 'CHOOSE_MOVE', player: mySeat(), selfOffset: ui.offset };
      if (view.lastResolution.loserEffect.type === 'K_PUSH') move.pushAmount = ui.push;
      act(move);
      break;
    }
    case 'concede':
      ui.concedeArmed = true;
      rerender();
      break;
    case 'cancel-concede':
      ui.concedeArmed = false;
      rerender();
      break;
    case 'confirm-concede':
      ui.concedeArmed = false;
      act({ type: 'CONCEDE', player: mySeat() });
      break;
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

function mySeat() {
  return mode === 'online' ? online.playerIndex : seat;
}

/** Route a game action: to the server online, through the local reducer in hotseat. */
function act(action) {
  if (mode === 'online') {
    net.send({ type: 'ACTION', action });
    return;
  }
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

function resetSelections() {
  ui.selected = [];
  ui.offset = null;
  ui.push = 0;
  ui.concedeArmed = false;
}

// ---------------------------------------------------------------------------
// Online mode
// ---------------------------------------------------------------------------

function joinFromInput() {
  const code = document.querySelector('#join-code')?.value.trim().toUpperCase();
  if (!code) {
    menuError = 'Enter a room code.';
    rerender();
    return;
  }
  goOnline({ roomCode: code });
}

/**
 * Connect and claim a seat. `intent` is {create: true} for a new room or
 * {roomCode, playerToken?} to join/rejoin; it is replayed on every reconnect
 * (with the token learned meanwhile, so a drop mid-game reclaims the seat).
 */
function goOnline(intent) {
  mode = 'online';
  menuError = null;
  online.intent = intent;
  online.roomCode = intent.roomCode ?? null;
  online.playerToken = intent.playerToken ?? null;
  online.view = null;
  online.opponentConnected = false;

  const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`;
  net = createConnection({
    url,
    onOpen: () => {
      if (online.roomCode && online.playerToken) {
        net.send({ type: 'JOIN_ROOM', roomCode: online.roomCode, playerToken: online.playerToken });
      } else if (online.intent.create) {
        net.send({ type: 'CREATE_ROOM' });
      } else {
        net.send({ type: 'JOIN_ROOM', roomCode: online.intent.roomCode });
      }
    },
    onMessage: onServerMessage,
    onStatus: (status) => {
      online.connection = status;
      if (mode === 'online') rerender();
    },
  });
  rerender();
}

function onServerMessage(msg) {
  switch (msg.type) {
    case 'ROOM_CREATED':
    case 'ROOM_JOINED':
      online.roomCode = msg.roomCode;
      online.playerToken = msg.playerToken;
      online.playerIndex = msg.playerIndex;
      writeSession({ roomCode: msg.roomCode, playerToken: msg.playerToken });
      rerender();
      break;
    case 'ROOM_STATE':
      online.opponentConnected = msg.players.some(
        (p, i) => i !== online.playerIndex && p.connected,
      );
      rerender();
      break;
    case 'VIEW':
      online.view = msg.view;
      resetSelections();
      rerender();
      break;
    case 'OPPONENT_STATUS':
      online.opponentConnected = msg.connected;
      rerender();
      break;
    case 'REJECTED':
      onRejected(msg.reason);
      break;
  }
}

function onRejected(reason) {
  if (!online.view) {
    // Could not (re)claim a seat — back to the menu with the reason.
    leaveOnline();
    menuError = reason;
    rerender();
    return;
  }
  // In-game rejection should be impossible (the UI legality-gates every
  // action); log it and resync so the client can't drift from the server.
  console.error(`Server rejected action: ${reason}`);
  net.send({ type: 'RESYNC' });
}

function leaveOnline() {
  net?.close();
  net = null;
  clearSession();
  online.view = null;
  online.roomCode = null;
  online.playerToken = null;
  online.playerIndex = null;
  mode = 'menu';
  menuError = null;
  rerender();
}

function readSession() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY));
  } catch {
    return null;
  }
}

function writeSession(session) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

// ---------------------------------------------------------------------------
// Hotseat mode
// ---------------------------------------------------------------------------

function startHotseat() {
  mode = 'hotseat';
  ui.curtain = false;
  ui.graveyardOpen = false;
  seat = null;
  pendingSeat = null;
  newGame(Date.now() >>> 0); // seeded RNG lives in /shared; the seed itself may be wall-clock
}

function onHotseatStateChange(state) {
  resetSelections();
  const next = nextSeat(state);
  if (next !== null && next !== seat) {
    pendingSeat = next;
    ui.curtain = true;
  }
  rerender();
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function currentModel() {
  if (mode === 'online') {
    if (!online.view) {
      return { screen: 'lobby', roomCode: online.roomCode, connection: online.connection };
    }
    return buildViewModel(online.view, ui, {
      online: true,
      connection: online.connection,
      opponentConnected: online.opponentConnected,
    });
  }
  if (mode === 'hotseat' && getState()) {
    const displaySeat = ui.curtain ? pendingSeat : (seat ?? 0);
    return buildModel(getState(), displaySeat, ui);
  }
  return { screen: 'menu', hotseatEnabled: HOTSEAT_ENABLED, error: menuError };
}

function rerender() {
  lastModel = currentModel();
  app.innerHTML = renderApp(lastModel);
}
