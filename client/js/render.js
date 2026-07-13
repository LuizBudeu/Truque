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
 *
 * All copy comes from i18n.js: renderApp resolves the active language into a
 * bound `t(key, params)` and threads it into every sub-renderer, so no literal
 * UI string lives in this module.
 */

import { DANGER_SPACES } from "../../shared/rules.js";
import { createTranslator, DEFAULT_LANG, languageMeta } from "./i18n.js";
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
import { helpFabHTML, rulesModalHTML } from "./ui/rules.js";

export function renderApp(model) {
    const t = createTranslator(model.lang ?? model.ui?.lang ?? DEFAULT_LANG);
    const lang = model.lang ?? model.ui?.lang ?? DEFAULT_LANG;
    const chrome = chromeHTML(model, t, lang);
    if (model.screen === "menu") return menuHTML(model, t, lang) + chrome;
    if (model.screen === "lobby") return lobbyHTML(model, t) + chrome;
    if (model.ui?.curtain) return curtainHTML(model, t); // full-screen handoff, no chrome
    return gameHTML(model, t) + chrome;
}

/** The always-available help FAB (+ its modal when open). Not on the curtain. */
function chromeHTML(model, t, lang) {
    const rulesOpen = model.ui?.rulesOpen ?? model.rulesOpen;
    return `${helpFabHTML(t)}${rulesOpen ? rulesModalHTML(t) : ""}`;
}

/**
 * A language chip that cycles through LANGUAGES on click (so a third language
 * needs no code change). Shows the CURRENT language's short label.
 */
function langToggleHTML(t, lang) {
    const meta = languageMeta(lang);
    return `<button type="button" class="subtle lang-toggle" data-action="cycle-lang"
              title="${t("lang.title", { name: meta.name })}">🌐 ${meta.label}</button>`;
}

/** "You" online (the other seat is elsewhere); "Player N" in hotseat/labels. */
function playerName(t, index, youIndex, online) {
    if (index === youIndex) return t("player.you");
    if (online) return t("player.opponent");
    return t("player.n", { n: index + 1 });
}

function menuHTML(model, t, lang) {
    const hotseat = model.hotseatEnabled
        ? `
      <div class="menu-section">
        <button type="button" data-action="new-game">${t("menu.newHotseat")}</button>
        <p class="hint">${t("menu.hotseatHint")}</p>
      </div>`
        : "";
    return `
    <div class="screen menu">
      <div class="top-controls">${langToggleHTML(t, lang)}</div>
      <div class="menu-crest">⚔</div>
      <h1>Truqué</h1>
      <p class="tagline">${t("menu.tagline")}</p>
      ${model.error ? `<p class="error">${model.error}</p>` : ""}
      <div class="menu-panel">
        <div class="menu-section">
          <button type="button" class="primary" data-action="create-room">${t("menu.createRoom")}</button>
          <p class="hint">${t("menu.createHint")}</p>
        </div>
        <div class="menu-divider">${t("menu.or")}</div>
        <div class="menu-section">
          <div class="join-row">
            <input id="join-code" type="text" maxlength="6" placeholder="${t("menu.roomCodePlaceholder")}"
                   autocomplete="off" autocapitalize="characters" spellcheck="false" />
            <button type="button" class="primary" data-action="join-room">${t("menu.joinRoom")}</button>
          </div>
        </div>
        ${hotseat}
      </div>
    </div>`;
}

/** Online waiting room: show the join code until the second player arrives. */
function lobbyHTML(model, t) {
    const status = model.connection === "open" ? t("lobby.waiting") : t("lobby.connecting");
    return `
    <div class="screen menu lobby">
      <div class="menu-crest">⚔</div>
      <h1>Truqué</h1>
      <p class="tagline">${t("lobby.roomCode")}</p>
      <p class="room-code">${model.roomCode ?? "····"}</p>
      <p class="hint">${t("lobby.shareHint")}</p>
      <p class="instructions">${status}</p>
      <div class="buttons">
        <button type="button" data-action="leave-room">${t("common.cancel")}</button>
      </div>
    </div>`;
}

/**
 * Full-screen "pass the device" curtain (hotseat only). Shows only PUBLIC
 * information (the last round's result) so the previous player can hand the
 * device over without leaking the next player's hand.
 */
function curtainHTML(model, t) {
    const { view, seat } = model;
    const labels = [0, 1].map((i) => playerName(t, i, null, false));
    const result = view.lastResolution
        ? `<h3>${t("curtain.lastRound")}</h3>${revealHTML(view.lastResolution, { t, labels })}`
        : "";
    return `
    <div class="screen curtain${model.ui.fantasySuits ? " theme-fantasy" : ""}">
      <div class="curtain-panel">
        ${result}
        <h2>${t("curtain.pass", { n: seat + 1 })}</h2>
        <button type="button" class="primary" data-action="continue">${t("curtain.continue", { n: seat + 1 })}</button>
      </div>
    </div>`;
}

function gameHTML(model, t) {
    const { view, ui } = model;
    const over = view.phase === "GAME_OVER";
    const youIndex = model.online ? view.playerIndex : null;
    const labels = [0, 1].map((i) => playerName(t, i, youIndex, model.online));
    const lang = ui.lang ?? DEFAULT_LANG;
    // The last round lives in the sidebar (with the suit-cycle reference), not
    // center stage: the board and the action zone are what the player scans.
    const sidebar = `
      <aside class="game-side">
        ${view.lastResolution ? `<section class="panel reveal-panel"><h3 class="side-title">${t("side.lastRound")}</h3>${revealHTML(view.lastResolution, { t, labels, youIndex, small: true })}</section>` : ""}
        ${suitCycleHTML(t)}
      </aside>`;
    return `
    <div class="screen game${ui.fantasySuits ? " theme-fantasy" : ""}">
      ${hudHTML(view, { t, lang, concede: !over, concedeArmed: ui.concedeArmed, fantasy: !!ui.fantasySuits })}
      ${connectionBannerHTML(model, t)}
      <div class="game-body">
        <div class="game-main">
          <section class="table">
            ${opponentHTML(view, { t, online: model.online })}
            <div class="table-center">
              ${pilesHTML(view, t)}
              ${boardHTML(view, t)}
              ${manilhaHTML(view, t)}
            </div>
          </section>
          <section class="panel action-zone">${actionZoneHTML(model, t)}</section>
          ${over ? "" : handHTML(view, ui, { t, online: model.online })}
        </div>
        ${sidebar}
      </div>
      ${ui.graveyardOpen ? graveyardHTML(view, t) : ""}
    </div>`;
}

/** Online-only: surface a lost server connection or an absent opponent. */
function connectionBannerHTML(model, t) {
    if (!model.online) return "";
    if (model.connection !== "open") {
        return `<div class="banner warning">${t("banner.connectionLost")}</div>`;
    }
    if (!model.opponentConnected) {
        return `<div class="banner warning">${t("banner.opponentDisconnected")}</div>`;
    }
    return "";
}

function actionZoneHTML(model, t) {
    switch (model.view.phase) {
        case "SWAP_WINDOW":
            return swapZoneHTML(model, t);
        case "PICK_CARDS":
            return pickZoneHTML(model, t);
        case "WINNER_MOVE":
            return moveZoneHTML(model, t);
        case "GAME_OVER":
            return gameOverHTML(model, t);
        default:
            return "";
    }
}

/** "You" online (the other seat is elsewhere); "Player N" in hotseat. */
const seatLabel = (model, t) => (model.online ? t("player.you") : t("player.n", { n: model.seat + 1 }));

/** Rulebook 2.10: swap any number of cards within the per-game budget, or pass. */
function swapZoneHTML(model, t) {
    const { view, seat, ui } = model;
    if (view.swapDone[seat]) {
        return `<p class="instructions">${t("swap.closed")}</p>`;
    }
    const remaining = view.swapsRemaining[seat];
    const count = ui.selected.length;
    const canSwap = count >= 1 && count <= remaining;
    return `
    <p class="instructions">
      ${t("swap.instructions", { seat: seatLabel(model, t), remaining })}
    </p>
    <div class="buttons">
      <button type="button" data-action="swap-selected"${canSwap ? "" : " disabled"}>${t("swap.selected", { n: count })}</button>
      <button type="button" class="primary" data-action="skip-swap">${t("swap.done")}</button>
    </div>`;
}

/** Rulebook 2.4/2.9: secret pick, with the danger-zone open-play messaging. */
function pickZoneHTML(model, t) {
    const { view, seat } = model;
    const opponent = 1 - seat;
    const selfEndangered = view.positions[seat] === DANGER_SPACES[seat];
    const opponentEndangered = view.positions[opponent] === DANGER_SPACES[opponent];
    const openPlay = selfEndangered !== opponentEndangered;

    if (view.selfCommitted) {
        return `
      <p class="instructions">${t("pick.committed")}</p>`;
    }
    // Rulebook 2.9: the endangered player picks only after seeing the open card.
    if (openPlay && selfEndangered && !view.openCard) {
        return `
      <div class="open-play">
        <strong>${t("pick.dangerTitle")}</strong> ${t("pick.openWaiting")}
      </div>`;
    }

    let notice = "";
    if (view.openCard) {
        notice = `
      <div class="open-play">
        <strong>${t("pick.dangerTitle")}</strong> ${t("pick.openRevealed")}
        ${cardHTML(view.openCard, { small: true })}
      </div>`;
    } else if (openPlay && opponentEndangered) {
        notice = `
      <div class="open-play">
        <strong>${t("pick.opponentInDangerTitle")}</strong> ${t("pick.opponentInDangerBody")}
      </div>`;
    }

    const canPlay = model.ui.selected.length === 1;
    return `
    ${notice}
    <p class="instructions">${t("pick.instructions", { seat: seatLabel(model, t) })}</p>
    <div class="buttons">
      <button type="button" class="primary" data-action="play-card"${canPlay ? "" : " disabled"}>${t("pick.play")}</button>
    </div>`;
}

/** Winner's move: optional K push amount plus the advance/retreat choice. */
function moveZoneHTML(model, t) {
    const { seat, ui, move } = model;
    if (!move) return `<p class="instructions">${t("move.waiting")}</p>`;

    const pushRow = move.pushes
        ? `
      <div class="option-row">
        <span class="option-label">${t("move.push")}</span>
        ${move.pushes.map((v) => `<button type="button" data-action="select-push" data-value="${v}" class="${ui.push === v ? "selected" : ""}">${v}</button>`).join("")}
      </div>`
        : "";

    const offsetRow = move.offsets
        .map((o) => {
            const label = o.value > 0 ? t("move.advance", { n: o.value }) : o.value < 0 ? t("move.retreat", { n: -o.value }) : t("move.stay");
            const selected = ui.offset === o.value ? " selected" : "";
            return `<button type="button" data-action="select-offset" data-value="${o.value}" class="option${selected}"${o.legal ? "" : " disabled"}>${label}</button>`;
        })
        .join("");

    const chosen = move.offsets.find((o) => o.value === ui.offset);
    const canConfirm = chosen !== undefined && chosen.legal;
    const intro = model.online
        ? t("move.introYou", { range: move.range })
        : t("move.introSeat", { n: seat + 1, range: move.range });
    return `
    <p class="instructions">${intro}</p>
    ${pushRow}
    <div class="option-row">${offsetRow}</div>
    <div class="buttons">
      <button type="button" class="primary" data-action="confirm-move"${canConfirm ? "" : " disabled"}>${t("move.confirm")}</button>
    </div>`;
}

function gameOverHTML(model, t) {
    const { view, seat } = model;
    const conceded = view.concededBy !== null && view.concededBy !== undefined;
    let message;
    if (view.winner === "draw") {
        message = t("over.draw");
    } else if (model.online) {
        if (conceded) {
            message = view.winner === seat ? t("over.onlineConcededWin") : t("over.onlineConcededLose");
        } else {
            message = view.winner === seat ? t("over.onlineWin") : t("over.onlineLose");
        }
    } else {
        message = conceded
            ? t("over.hotseatConceded", { conceder: view.concededBy + 1, winner: view.winner + 1 })
            : t("over.hotseatWin", { winner: view.winner + 1 });
    }
    // Rematch is hotseat-only for now (online rematch is Phase 5 polish).
    const buttons = model.online
        ? `<button type="button" class="primary" data-action="leave-room">${t("common.backToMenu")}</button>`
        : `<button type="button" class="primary" data-action="rematch">${t("over.rematch")}</button>
        <button type="button" data-action="menu">${t("common.backToMenu")}</button>`;
    return `
    <div class="game-over">
      <h2>${message}</h2>
      <div class="buttons">
        ${buttons}
      </div>
    </div>`;
}
