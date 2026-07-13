/**
 * renderApp(model) — pure model → HTML string.
 *
 * Declarative full rebuild per PLANNING.md §3.6: no DOM access here, so the
 * whole UI is testable in Node (test/ui.test.js). main.js injects the string
 * and delegates clicks via data-action attributes; animations are decoration
 * that main.js layers on afterwards from animate.js plans — this module only
 * describes the FINAL state of the current model.
 *
 * The game screen mirrors Figure 2 of the rulebook: opponent's face-down
 * hand on top, then the table (draw/graveyard piles · towers + hex board ·
 * manilha cluster), the round-result panel, the action zone, own hand below.
 *
 * The same screen serves hotseat and online: `model.online` switches player
 * labels ("You" vs "Player N"), enables the waiting states for the
 * simultaneous phases (online both seats render at once; hotseat only ever
 * renders the seat that must act), and shows connection banners.
 */

import { DANGER_SPACES } from "../../shared/rules.js";
import { boardHTML } from "./ui/board.js";
import { handHTML } from "./ui/hand.js";
import { hudHTML } from "./ui/hud.js";
import { manilhaHTML } from "./ui/manilha.js";
import { opponentHTML } from "./ui/opponent.js";
import { pilesHTML } from "./ui/piles.js";
import { revealHTML } from "./ui/reveal.js";
import { suitCycleHTML } from "./ui/cycle.js";
import { graveyardHTML } from "./ui/graveyard.js";
import { cardHTML } from "./ui/card.js";

export function renderApp(model) {
    if (model.screen === "menu") return menuHTML(model);
    if (model.screen === "lobby") return lobbyHTML(model);
    if (model.ui.curtain) return curtainHTML(model);
    return gameHTML(model);
}

function menuHTML(model) {
    const hotseat = model.hotseatEnabled
        ? `
      <div class="menu-section">
        <button type="button" data-action="new-game">New hotseat game</button>
        <p class="hint">Two players, one device — debugging mode.</p>
      </div>`
        : "";
    return `
    <div class="screen menu">
      <div class="menu-crest">⚔</div>
      <h1>Truqué</h1>
      <p class="tagline">Push your opponent off the board.</p>
      ${model.error ? `<p class="error">${model.error}</p>` : ""}
      <div class="menu-panel">
        <div class="menu-section">
          <button type="button" class="primary" data-action="create-room">Create room</button>
          <p class="hint">You'll get a short code to share with your opponent.</p>
        </div>
        <div class="menu-divider">or</div>
        <div class="menu-section">
          <div class="join-row">
            <input id="join-code" type="text" maxlength="6" placeholder="Room code"
                   autocomplete="off" autocapitalize="characters" spellcheck="false" />
            <button type="button" class="primary" data-action="join-room">Join room</button>
          </div>
        </div>
        ${hotseat}
      </div>
    </div>`;
}

/** Online waiting room: show the join code until the second player arrives. */
function lobbyHTML(model) {
    const status = model.connection === "open" ? "Waiting for your opponent to join…" : "Connecting to the server…";
    return `
    <div class="screen menu lobby">
      <div class="menu-crest">⚔</div>
      <h1>Truqué</h1>
      <p class="tagline">Room code</p>
      <p class="room-code">${model.roomCode ?? "····"}</p>
      <p class="hint">Share this code — the game starts when your opponent joins.</p>
      <p class="instructions">${status}</p>
      <div class="buttons">
        <button type="button" data-action="leave-room">Cancel</button>
      </div>
    </div>`;
}

/**
 * Full-screen "pass the device" curtain (hotseat only). Shows only PUBLIC
 * information (the last round's result) so the previous player can hand the
 * device over without leaking the next player's hand.
 */
function curtainHTML(model) {
    const { view, seat } = model;
    const result = view.lastResolution ? `<h3>Last round</h3>${revealHTML(view.lastResolution)}` : "";
    return `
    <div class="screen curtain${model.ui.fantasySuits ? " theme-fantasy" : ""}">
      <div class="curtain-panel">
        ${result}
        <h2>Pass the device to Player ${seat + 1}</h2>
        <button type="button" class="primary" data-action="continue">I'm Player ${seat + 1} — continue</button>
      </div>
    </div>`;
}

function gameHTML(model) {
    const { view, ui } = model;
    const over = view.phase === "GAME_OVER";
    const revealLabels = model.online ? (view.playerIndex === 0 ? ["You", "Opponent"] : ["Opponent", "You"]) : ["Player 1", "Player 2"];
    // The last round lives in the sidebar (with the suit-cycle reference), not
    // center stage: the board and the action zone are what the player scans.
    const sidebar = `
      <aside class="game-side">
        ${view.lastResolution ? `<section class="panel reveal-panel"><h3 class="side-title">Last round</h3>${revealHTML(view.lastResolution, revealLabels, { small: true })}</section>` : ""}
        ${suitCycleHTML()}
      </aside>`;
    return `
    <div class="screen game${ui.fantasySuits ? " theme-fantasy" : ""}">
      ${hudHTML(view, { concede: !over, concedeArmed: ui.concedeArmed, fantasy: !!ui.fantasySuits })}
      ${connectionBannerHTML(model)}
      <div class="game-body">
        <div class="game-main">
          <section class="table">
            ${opponentHTML(view, { online: model.online })}
            <div class="table-center">
              ${pilesHTML(view)}
              ${boardHTML(view)}
              ${manilhaHTML(view)}
            </div>
          </section>
          <section class="panel action-zone">${actionZoneHTML(model)}</section>
          ${over ? "" : handHTML(view, ui, { online: model.online })}
        </div>
        ${sidebar}
      </div>
      ${ui.graveyardOpen ? graveyardHTML(view) : ""}
    </div>`;
}

/** Online-only: surface a lost server connection or an absent opponent. */
function connectionBannerHTML(model) {
    if (!model.online) return "";
    if (model.connection !== "open") {
        return '<div class="banner warning">Connection lost — reconnecting…</div>';
    }
    if (!model.opponentConnected) {
        return '<div class="banner warning">Your opponent disconnected — waiting for them to return…</div>';
    }
    return "";
}

function actionZoneHTML(model) {
    switch (model.view.phase) {
        case "SWAP_WINDOW":
            return swapZoneHTML(model);
        case "PICK_CARDS":
            return pickZoneHTML(model);
        case "WINNER_MOVE":
            return moveZoneHTML(model);
        case "GAME_OVER":
            return gameOverHTML(model);
        default:
            return "";
    }
}

/** "You" online (the other seat is elsewhere); "Player N" in hotseat. */
const seatLabel = (model) => (model.online ? "You" : `Player ${model.seat + 1}`);

/** Rulebook 2.10: swap any number of cards within the per-game budget, or pass. */
function swapZoneHTML(model) {
    const { view, seat, ui } = model;
    if (view.swapDone[seat]) {
        return '<p class="instructions">Swap window closed — waiting for your opponent…</p>';
    }
    const remaining = view.swapsRemaining[seat];
    const count = ui.selected.length;
    const canSwap = count >= 1 && count <= remaining;
    return `
    <p class="instructions">
      ${seatLabel(model)}: select cards to swap (${remaining} left this game) or keep your hand.
      Swapped cards are revealed to the graveyard.
    </p>
    <div class="buttons">
      <button type="button" data-action="swap-selected"${canSwap ? "" : " disabled"}>Swap selected (${count})</button>
      <button type="button" class="primary" data-action="skip-swap">Done — keep hand</button>
    </div>`;
}

/** Rulebook 2.4/2.9: secret pick, with the danger-zone open-play messaging. */
function pickZoneHTML(model) {
    const { view, seat } = model;
    const opponent = 1 - seat;
    const selfEndangered = view.positions[seat] === DANGER_SPACES[seat];
    const opponentEndangered = view.positions[opponent] === DANGER_SPACES[opponent];
    const openPlay = selfEndangered !== opponentEndangered;

    if (view.selfCommitted) {
        return `
      <p class="instructions">Card committed — waiting for your opponent…</p>`;
    }
    // Rulebook 2.9: the endangered player picks only after seeing the open card.
    if (openPlay && selfEndangered && !view.openCard) {
        return `
      <div class="open-play">
        <strong>Danger zone!</strong> Your opponent must play openly first — waiting for their card…
      </div>`;
    }

    let notice = "";
    if (view.openCard) {
        notice = `
      <div class="open-play">
        <strong>Danger zone!</strong> Your opponent had to play openly:
        ${cardHTML(view.openCard, { small: true })}
      </div>`;
    } else if (openPlay && opponentEndangered) {
        notice = `
      <div class="open-play">
        <strong>Your opponent is in danger.</strong> You must play openly — they
        will see your card before picking theirs.
      </div>`;
    }

    const canPlay = model.ui.selected.length === 1;
    return `
    ${notice}
    <p class="instructions">${seatLabel(model)}: choose a card to play. It stays secret until both are committed.</p>
    <div class="buttons">
      <button type="button" class="primary" data-action="play-card"${canPlay ? "" : " disabled"}>Play selected card</button>
    </div>`;
}

/** Winner's move: optional K push amount plus the advance/retreat choice. */
function moveZoneHTML(model) {
    const { seat, ui, move } = model;
    if (!move) return '<p class="instructions">Waiting for the round winner…</p>';

    const pushRow = move.pushes
        ? `
      <div class="option-row">
        <span class="option-label">Push opponent (K):</span>
        ${move.pushes.map((v) => `<button type="button" data-action="select-push" data-value="${v}" class="${ui.push === v ? "selected" : ""}">${v}</button>`).join("")}
      </div>`
        : "";

    const offsetRow = move.offsets
        .map((o) => {
            const label = o.value > 0 ? `Advance ${o.value}` : o.value < 0 ? `Retreat ${-o.value}` : "Stay";
            const selected = ui.offset === o.value ? " selected" : "";
            return `<button type="button" data-action="select-offset" data-value="${o.value}" class="option${selected}"${o.legal ? "" : " disabled"}>${label}</button>`;
        })
        .join("");

    const chosen = move.offsets.find((o) => o.value === ui.offset);
    const canConfirm = chosen !== undefined && chosen.legal;
    const intro = model.online
        ? `You won the round — choose your move (up to ${move.range} either way).`
        : `Player ${seat + 1}, you won the round — choose your move (up to ${move.range} either way).`;
    return `
    <p class="instructions">${intro}</p>
    ${pushRow}
    <div class="option-row">${offsetRow}</div>
    <div class="buttons">
      <button type="button" class="primary" data-action="confirm-move"${canConfirm ? "" : " disabled"}>Confirm move</button>
    </div>`;
}

function gameOverHTML(model) {
    const { view, seat } = model;
    const conceded = view.concededBy !== null && view.concededBy !== undefined;
    let message;
    if (view.winner === "draw") {
        message = "Both players were pushed out — the game is a draw!";
    } else if (model.online) {
        if (conceded) {
            message = view.winner === seat ? "Your opponent conceded — you win the game!" : "You conceded — your opponent wins the game.";
        } else {
            message = view.winner === seat ? "You win the game!" : "You lose — your opponent wins the game.";
        }
    } else {
        message = conceded ? `Player ${view.concededBy + 1} conceded — Player ${view.winner + 1} wins the game!` : `Player ${view.winner + 1} wins the game!`;
    }
    // Rematch is hotseat-only for now (online rematch is Phase 5 polish).
    const buttons = model.online
        ? '<button type="button" class="primary" data-action="leave-room">Back to menu</button>'
        : `<button type="button" class="primary" data-action="rematch">Rematch</button>
        <button type="button" data-action="menu">Back to menu</button>`;
    return `
    <div class="game-over">
      <h2>${message}</h2>
      <div class="buttons">
        ${buttons}
      </div>
    </div>`;
}
