/**
 * Client bootstrap and flow control — the only module that touches the DOM:
 * it renders the model to #app via innerHTML, delegates clicks through
 * data-action attributes, and executes animation plans from animate.js
 * (class toggles + FLIP pawn slides) on top of the rendered final state.
 *
 * Two modes share the same render pipeline (action → … → view → render):
 * - Online (Phase 3): net.js talks to the authoritative server; the last
 *   received view is all the client holds. {roomCode, playerToken} live in
 *   sessionStorage so a refresh rejoins the same seat.
 * - Hotseat (Phase 2, kept behind ?hotseat as a debugging tool): the store
 *   runs the reducer locally, with the pass-the-device curtain.
 *
 * Rendering has two lanes (Phase 4):
 * - rerender(): UI-only changes (selections, modals) — instant, no animation.
 * - transition(): the game VIEW changed — queued and pumped serially so a
 *   burst of server messages can't cut an animation short (PLANNING.md §3.6).
 */

import { newGame, dispatch, getState, subscribe, nextSeat, buildModel, buildViewModel } from './store.js';
import { renderApp } from './render.js';
import { buildAnimationPlan } from './animate.js';
import { createConnection } from './net.js';
import { createSound } from './sound.js';
import { nextLanguage } from './i18n.js';
import { isRulesetId } from '../../shared/rulesets/index.js';

const app = document.querySelector('#app');
const SESSION_KEY = 'truque-session';
const SUITS_KEY = 'truque-fantasy-suits'; // localStorage: survives across games
const LANG_KEY = 'truque-lang'; // localStorage: survives across games
const MUTE_KEY = 'truque-muted'; // localStorage: sound on/off preference
const RULESET_KEY = 'truque-ruleset'; // localStorage: last ruleset chosen for a new room
const params = new URLSearchParams(location.search);
const HOTSEAT_ENABLED = params.has('hotseat');
// Hotseat may pick a ruleset via ?ruleset=v2 (a debugging convenience).
const HOTSEAT_RULESET = isRulesetId(params.get('ruleset')) ? params.get('ruleset') : 'legacy';
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)');

// First run: honor a stored choice, else guess from the browser locale.
const initialLang =
  localStorage.getItem(LANG_KEY) ?? (navigator.language?.startsWith('pt') ? 'pt' : 'en');

const ui = {
  curtain: false,
  selected: [], // hand indexes
  offset: null, // winner-move choice
  push: 0, // K push choice
  graveyardOpen: false,
  rulesOpen: false, // floating rules popup
  aboutOpen: false, // floating colophon (credits) popup
  concedeArmed: false, // first concede click; the HUD asks for confirmation
  fantasySuits: localStorage.getItem(SUITS_KEY) !== '0', // default on; ♠♦♥♣ only if explicitly turned off
  lang: initialLang, // UI language; see i18n.js
  copied: false, // transient: the invite link was just copied to the clipboard
  muted: localStorage.getItem(MUTE_KEY) === '1', // sound effects off
  // Ruleset to seed the NEXT room with (creator's choice; joiners inherit).
  ruleset: localStorage.getItem(RULESET_KEY) === 'v2' ? 'v2' : 'legacy',
};

// Procedural sound (Phase 5). Cues fire from the animation pump below.
const sound = createSound();
sound.setMuted(ui.muted);

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
  roomRuleset: null, // ruleset the room was created with (from ROOM_STATE); shown in the lobby
  view: null, // last VIEW from the server; null while in the lobby
  opponentConnected: false,
  intent: null, // what to send when the socket (re)opens
  rematch: { you: false, opponent: false }, // GAME_OVER replay votes
};

// Animation-queue state — declared before the bootstrap below, which can hit
// clearTransitions() via goOnline() on a mid-game refresh.
let animating = false;
const pendingModels = [];

subscribe(onHotseatStateChange);
app.addEventListener('click', onClick);
app.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && event.target.id === 'join-code') joinFromInput();
});

// A refresh mid-game rejoins the saved seat automatically; a shared invite
// link (?room=CODE) joins that room in one click.
const savedSession = readSession();
const invitedRoom = new URLSearchParams(location.search).get('room')?.trim().toUpperCase();
if (savedSession) {
  goOnline({ roomCode: savedSession.roomCode, playerToken: savedSession.playerToken });
} else if (invitedRoom) {
  goOnline({ roomCode: invitedRoom });
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
    case 'request-rematch':
      online.rematch = { ...online.rematch, you: true };
      net.send({ type: 'REQUEST_REMATCH' });
      rerender();
      break;
    case 'menu':
      mode = 'menu';
      clearTransitions();
      rerender();
      break;
    case 'create-room':
      goOnline({ create: true, ruleset: ui.ruleset });
      break;
    case 'select-ruleset': {
      const chosen = el.dataset.ruleset === 'v2' ? 'v2' : 'legacy';
      ui.ruleset = chosen;
      localStorage.setItem(RULESET_KEY, chosen);
      rerender();
      break;
    }
    case 'join-room':
      joinFromInput();
      break;
    case 'leave-room':
      leaveOnline();
      break;
    case 'copy-link':
      copyInviteLink();
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
    case 'toggle-suits':
      ui.fantasySuits = !ui.fantasySuits;
      localStorage.setItem(SUITS_KEY, ui.fantasySuits ? '1' : '0');
      rerender();
      break;
    case 'toggle-mute':
      ui.muted = !ui.muted;
      sound.setMuted(ui.muted);
      localStorage.setItem(MUTE_KEY, ui.muted ? '1' : '0');
      rerender();
      break;
    case 'cycle-lang':
      ui.lang = nextLanguage(ui.lang);
      localStorage.setItem(LANG_KEY, ui.lang);
      rerender();
      break;
    case 'open-rules':
      ui.rulesOpen = true;
      rerender();
      break;
    case 'close-rules':
      ui.rulesOpen = false;
      rerender();
      break;
    case 'open-about':
      ui.aboutOpen = true;
      rerender();
      break;
    case 'close-about':
      ui.aboutOpen = false;
      rerender();
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

/** The shareable one-click join URL for the current room. */
function inviteLink() {
  return `${location.origin}/client/?room=${online.roomCode}`;
}

/** Copy the invite link, flashing a "Copied!" confirmation on the button. */
function copyInviteLink() {
  if (!online.roomCode) return;
  const done = () => {
    ui.copied = true;
    rerender();
    setTimeout(() => {
      ui.copied = false;
      rerender();
    }, 1600);
  };
  // navigator.clipboard needs a secure context; fall back to a temp textarea.
  const link = inviteLink();
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(link).then(done, () => legacyCopy(link, done));
  } else {
    legacyCopy(link, done);
  }
}

function legacyCopy(text, done) {
  const area = document.createElement('textarea');
  area.value = text;
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  try {
    document.execCommand('copy');
    done();
  } finally {
    area.remove();
  }
}

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
  online.roomRuleset = null;
  online.view = null;
  online.opponentConnected = false;
  online.rematch = { you: false, opponent: false };
  clearTransitions();

  const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`;
  net = createConnection({
    url,
    onOpen: () => {
      if (online.roomCode && online.playerToken) {
        net.send({ type: 'JOIN_ROOM', roomCode: online.roomCode, playerToken: online.playerToken });
      } else if (online.intent.create) {
        net.send({ type: 'CREATE_ROOM', ruleset: online.intent.ruleset });
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
      online.roomRuleset = msg.ruleset ?? 'legacy'; // a joiner learns the room's rules here
      online.opponentConnected = msg.players.some(
        (p, i) => i !== online.playerIndex && p.connected,
      );
      rerender();
      break;
    case 'VIEW':
      // A fresh game (first deal or a completed rematch) clears the replay votes.
      if (msg.view.phase !== 'GAME_OVER') online.rematch = { you: false, opponent: false };
      online.view = msg.view;
      resetSelections();
      transition();
      break;
    case 'OPPONENT_STATUS':
      online.opponentConnected = msg.connected;
      rerender();
      break;
    case 'REMATCH_STATE':
      online.rematch = {
        you: msg.requested[online.playerIndex],
        opponent: msg.requested[1 - online.playerIndex],
      };
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
  clearTransitions();
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
  clearTransitions();
  // seeded RNG lives in /shared; the seed itself may be wall-clock. Ruleset via ?ruleset=.
  newGame(Date.now() >>> 0, HOTSEAT_RULESET);
}

function onHotseatStateChange(state) {
  resetSelections();
  const next = nextSeat(state);
  if (next !== null && next !== seat) {
    pendingSeat = next;
    ui.curtain = true;
  }
  transition();
}

// ---------------------------------------------------------------------------
// Rendering & animation
// ---------------------------------------------------------------------------

function currentModel() {
  if (mode === 'online') {
    if (!online.view) {
      return {
        screen: 'lobby',
        roomCode: online.roomCode,
        connection: online.connection,
        copied: ui.copied,
        lang: ui.lang,
        ruleset: online.roomRuleset, // shown so a joiner knows which rules they entered
        rulesOpen: ui.rulesOpen,
        aboutOpen: ui.aboutOpen,
      };
    }
    return buildViewModel(online.view, ui, {
      online: true,
      connection: online.connection,
      opponentConnected: online.opponentConnected,
      rematch: online.rematch,
    });
  }
  if (mode === 'hotseat' && getState()) {
    const displaySeat = ui.curtain ? pendingSeat : (seat ?? 0);
    return buildModel(getState(), displaySeat, ui);
  }
  return {
    screen: 'menu',
    hotseatEnabled: HOTSEAT_ENABLED,
    error: menuError,
    lang: ui.lang,
    ruleset: ui.ruleset, // drives the menu toggle and the pre-room rulebook preview
    rulesOpen: ui.rulesOpen,
    aboutOpen: ui.aboutOpen,
  };
}

/** Instant re-render for UI-only changes (selections, modals, banners). */
function rerender() {
  lastModel = currentModel();
  app.innerHTML = renderApp(lastModel);
}

/**
 * The game view changed: snapshot the model NOW (later events may replace
 * the view again) and pump the queue — each entry renders its final state,
 * then plays the animation plan for the diff before the next entry lands.
 */
function transition() {
  pendingModels.push(currentModel());
  void pumpTransitions();
}

function clearTransitions() {
  pendingModels.length = 0;
}

/** The view a model rendered on the game screen, or null (menu/lobby/curtain). */
const renderedView = (model) =>
  model && model.screen === 'game' && !model.ui?.curtain ? model.view : null;

/**
 * The win/lose cue to play when a transition first reaches GAME_OVER, or null.
 * Online: from the local seat's perspective; hotseat: a neutral flourish.
 */
function gameOverCue(prev, next) {
  const view = next?.view;
  if (!view || view.phase !== 'GAME_OVER') return null;
  if (prev?.view?.phase === 'GAME_OVER') return null; // already announced
  if (view.winner === 'draw') return 'lose';
  if (next.online) return view.winner === view.playerIndex ? 'win' : 'lose';
  return 'win';
}

async function pumpTransitions() {
  if (animating) return;
  animating = true;
  try {
    while (pendingModels.length > 0) {
      const prev = lastModel;
      lastModel = pendingModels.shift();
      app.innerHTML = renderApp(lastModel);
      const plan = buildAnimationPlan(renderedView(prev), renderedView(lastModel));
      if (plan.length > 0 && !REDUCED_MOTION.matches) await runPlan(plan);
      const cue = gameOverCue(prev, lastModel);
      if (cue) sound.play(cue);
    }
  } finally {
    animating = false;
  }
}

/**
 * Execute one plan against the current DOM. The final state is already
 * rendered — steps only decorate it (add a CSS class, FLIP a pawn), so a
 * missing element (user opened a modal mid-plan) simply skips a step.
 */
async function runPlan(plan) {
  for (const step of plan) {
    switch (step.type) {
      case 'reveal':
        app.querySelector('.reveal-panel .reveal')?.classList.add('animate');
        sound.play('reveal');
        await wait(step.duration);
        break;
      case 'manilha-flip':
        app.querySelector('.manilha-slot')?.classList.add('animate');
        sound.play('manilha');
        await wait(step.duration);
        break;
      case 'pawn-slide':
        sound.play('move');
        await slidePawns(step);
        break;
      case 'board-shrink':
        // The board already rendered at its new (narrower) extent; play a brief
        // settle on it so the change registers. Rulebook V2.
        app.querySelector('.board')?.classList.add('shrinking');
        sound.play('move');
        await wait(step.duration);
        app.querySelector('.board')?.classList.remove('shrinking');
        break;
    }
  }
}

/** FLIP: place each pawn back at its old space with a transform, reflow,
 *  then release so a CSS transition carries it to its rendered position. */
async function slidePawns(step) {
  const spaces = app.querySelectorAll('.board .space');
  // The board only renders its current extent, so a space's DOM index is the
  // absolute position minus the board's low edge (0 in Legacy; higher in V2).
  const min = renderedView(lastModel)?.bounds?.min ?? 0;
  const moved = [];
  for (const { player, from, to } of step.moves) {
    const pawn = app.querySelector(`.pawn-p${player}`);
    const [a, b] = [spaces[from - min], spaces[to - min]];
    if (!pawn || !a || !b) continue;
    const dx = a.getBoundingClientRect().left - b.getBoundingClientRect().left;
    pawn.style.transform = `translateX(${dx}px)`;
    moved.push(pawn);
  }
  if (moved.length === 0) return;
  void app.offsetWidth; // commit the start position before transitioning
  for (const pawn of moved) {
    pawn.style.transition = `transform ${step.duration - 40}ms cubic-bezier(0.3, 0.9, 0.35, 1.05)`;
    pawn.style.transform = '';
  }
  await wait(step.duration);
  for (const pawn of moved) pawn.style.transition = '';
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
