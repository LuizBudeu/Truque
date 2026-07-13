/**
 * renderApp(model) — pure model → HTML string (Phase 2).
 *
 * Declarative full rebuild per PLANNING.md §3.6: no DOM access here, so the
 * whole UI is testable in Node (test/ui.test.js). main.js injects the string
 * and delegates clicks via data-action attributes. Animation is animate.js's
 * job (Phase 4); this module only describes the current model.
 */

import { DANGER_SPACES } from '../../shared/rules.js';
import { boardHTML } from './ui/board.js';
import { handHTML } from './ui/hand.js';
import { hudHTML } from './ui/hud.js';
import { manilhaHTML } from './ui/manilha.js';
import { revealHTML } from './ui/reveal.js';
import { graveyardHTML } from './ui/graveyard.js';
import { cardHTML } from './ui/card.js';

export function renderApp(model) {
  if (model.screen === 'menu') return menuHTML();
  if (model.ui.curtain) return curtainHTML(model);
  return gameHTML(model);
}

function menuHTML() {
  return `
    <div class="screen menu">
      <h1>Truqué</h1>
      <p class="tagline">Push your opponent off the board.</p>
      <button type="button" class="primary" data-action="new-game">New hotseat game</button>
      <p class="hint">Two players, one device — the game tells you when to pass it.</p>
    </div>`;
}

/**
 * Full-screen "pass the device" curtain. Shows only PUBLIC information (the
 * last round's result) so the previous player can hand the device over
 * without leaking the next player's hand.
 */
function curtainHTML(model) {
  const { view, seat } = model;
  const result = view.lastResolution
    ? `<h3>Last round</h3>${revealHTML(view.lastResolution)}`
    : '';
  return `
    <div class="screen curtain">
      <div class="curtain-panel">
        ${result}
        <h2>Pass the device to Player ${seat + 1}</h2>
        <button type="button" class="primary" data-action="continue">I'm Player ${seat + 1} — continue</button>
      </div>
    </div>`;
}

function gameHTML(model) {
  const { view, ui } = model;
  const over = view.phase === 'GAME_OVER';
  return `
    <div class="screen game">
      ${hudHTML(view)}
      <section class="table">
        ${manilhaHTML(view)}
        ${boardHTML(view)}
      </section>
      ${view.lastResolution ? `<section class="panel reveal-panel">${revealHTML(view.lastResolution)}</section>` : ''}
      <section class="panel action-zone">${actionZoneHTML(model)}</section>
      ${over ? '' : handHTML(view, ui)}
      ${ui.graveyardOpen ? graveyardHTML(view) : ''}
    </div>`;
}

function actionZoneHTML(model) {
  const { view, seat, ui } = model;
  switch (view.phase) {
    case 'SWAP_WINDOW':
      return swapZoneHTML(view, seat, ui);
    case 'PICK_CARDS':
      return pickZoneHTML(view, seat, ui);
    case 'WINNER_MOVE':
      return moveZoneHTML(model);
    case 'GAME_OVER':
      return gameOverHTML(view);
    default:
      return '';
  }
}

/** Rulebook 2.10: swap any number of cards within the per-game budget, or pass. */
function swapZoneHTML(view, seat, ui) {
  const remaining = view.swapsRemaining[seat];
  const count = ui.selected.length;
  const canSwap = count >= 1 && count <= remaining;
  return `
    <p class="instructions">
      Player ${seat + 1}: select cards to swap (${remaining} left this game) or keep your hand.
      Swapped cards are revealed to the graveyard.
    </p>
    <div class="buttons">
      <button type="button" data-action="swap-selected"${canSwap ? '' : ' disabled'}>Swap selected (${count})</button>
      <button type="button" class="primary" data-action="skip-swap">Done — keep hand</button>
    </div>`;
}

/** Rulebook 2.4/2.9: secret pick, with the danger-zone open-play messaging. */
function pickZoneHTML(view, seat, ui) {
  const opponent = 1 - seat;
  const selfEndangered = view.positions[seat] === DANGER_SPACES[seat];
  const opponentEndangered = view.positions[opponent] === DANGER_SPACES[opponent];

  let notice = '';
  if (view.openCard) {
    notice = `
      <div class="open-play">
        <strong>Danger zone!</strong> Your opponent had to play openly:
        ${cardHTML(view.openCard)}
      </div>`;
  } else if (opponentEndangered && !selfEndangered) {
    notice = `
      <div class="open-play">
        <strong>Your opponent is in danger.</strong> You must play openly — they
        will see your card before picking theirs (Rulebook 2.9).
      </div>`;
  }

  const canPlay = ui.selected.length === 1;
  return `
    ${notice}
    <p class="instructions">Player ${seat + 1}: choose a card to play. It stays secret until both are committed.</p>
    <div class="buttons">
      <button type="button" class="primary" data-action="play-card"${canPlay ? '' : ' disabled'}>Play selected card</button>
    </div>`;
}

/** Winner's move: optional K push amount plus the advance/retreat choice. */
function moveZoneHTML(model) {
  const { view, seat, ui, move } = model;
  if (!move) return '<p class="instructions">Waiting for the round winner…</p>';

  const pushRow = move.pushes
    ? `
      <div class="option-row">
        <span class="option-label">Push opponent (K):</span>
        ${move.pushes
          .map(
            (v) =>
              `<button type="button" data-action="select-push" data-value="${v}" class="${ui.push === v ? 'selected' : ''}">${v}</button>`,
          )
          .join('')}
      </div>`
    : '';

  const offsetRow = move.offsets
    .map((o) => {
      const label = o.value > 0 ? `Advance ${o.value}` : o.value < 0 ? `Retreat ${-o.value}` : 'Stay';
      const selected = ui.offset === o.value ? ' selected' : '';
      return `<button type="button" data-action="select-offset" data-value="${o.value}" class="option${selected}"${o.legal ? '' : ' disabled'}>${label}</button>`;
    })
    .join('');

  const chosen = move.offsets.find((o) => o.value === ui.offset);
  const canConfirm = chosen !== undefined && chosen.legal;
  return `
    <p class="instructions">
      Player ${seat + 1}, you won the round — choose your move (up to ${move.range} either way).
    </p>
    ${pushRow}
    <div class="option-row">${offsetRow}</div>
    <div class="buttons">
      <button type="button" class="primary" data-action="confirm-move"${canConfirm ? '' : ' disabled'}>Confirm move</button>
    </div>`;
}

function gameOverHTML(view) {
  const message =
    view.winner === 'draw'
      ? 'Both players were pushed out — the game is a draw!'
      : `Player ${view.winner + 1} wins the game!`;
  return `
    <div class="game-over">
      <h2>${message}</h2>
      <div class="buttons">
        <button type="button" class="primary" data-action="rematch">Rematch</button>
        <button type="button" data-action="menu">Back to menu</button>
      </div>
    </div>`;
}
