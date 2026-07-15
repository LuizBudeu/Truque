/**
 * renderApp(model) — pure model → HTML string.
 *
 * Declarative full rebuild per PLANNING.md §3.6: no DOM access here, so the
 * whole UI is testable in Node (test/ui.test.js). main.js injects the string
 * and delegates clicks via data-action attributes; animations are decoration
 * that main.js layers on afterwards from animate.js plans — this module only
 * describes the FINAL state of the current model.
 *
 * The game screen is a manuscript spread. A vellum FIELD SHEET carries the
 * public record in Figure 2's order — opponent's face-down hand at the head,
 * then piles · manilha seal, the towers-and-hexes board, the modifier
 * medallions — and closes with the prompt, the single live decision. The
 * MARGIN column beside it holds reference only (last duel, round log, suit
 * cycle), and your own hand sits on its own sheet below.
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

import { dangerSpaces } from "../../shared/rules.js";
import { createTranslator, DEFAULT_LANG, languageMeta } from "./i18n.js";
import { boardHTML } from "./ui/board.js";
import { handHTML } from "./ui/hand.js";
import { hudHTML } from "./ui/hud.js";
import { manilhaHTML } from "./ui/manilha.js";
import { opponentHTML } from "./ui/opponent.js";
import { pilesHTML } from "./ui/piles.js";
import { revealHTML } from "./ui/reveal.js";
import { suitCycleHTML } from "./ui/cycle.js";
import { roundLogHTML } from "./ui/log.js";
import { graveyardHTML } from "./ui/graveyard.js";
import { maniculeHTML } from "./ui/manicule.js";
import { cardHTML } from "./ui/card.js";
import { helpFabHTML, rulesModalHTML } from "./ui/rules.js";
import { aboutFabHTML, aboutModalHTML } from "./ui/about.js";

export function renderApp(model) {
    const t = createTranslator(model.lang ?? model.ui?.lang ?? DEFAULT_LANG);
    const lang = model.lang ?? model.ui?.lang ?? DEFAULT_LANG;
    const chrome = chromeHTML(model, t, lang);
    if (model.screen === "menu") return menuHTML(model, t, lang) + chrome;
    if (model.screen === "lobby") return lobbyHTML(model, t) + chrome;
    if (model.ui?.curtain) return curtainHTML(model, t); // full-screen handoff, no chrome
    return gameHTML(model, t) + chrome;
}

/**
 * The two always-available marks and their modals: the help FAB bottom-right,
 * the colophon FAB bottom-left. Present on every screen but the curtain.
 * The menu/lobby models carry the open flags flat; the game model nests them
 * under `ui` — accept either.
 */
function chromeHTML(model, t, lang) {
    const rulesOpen = model.ui?.rulesOpen ?? model.rulesOpen;
    const aboutOpen = model.ui?.aboutOpen ?? model.aboutOpen;
    // In a match the rulebook follows the room's ruleset (view.ruleset); on the
    // menu/lobby it follows the current selection (model.ruleset, Phase 5).
    const ruleset = model.view?.ruleset ?? model.ruleset ?? "legacy";
    return `${helpFabHTML(t)}${aboutFabHTML(t)}${rulesOpen ? rulesModalHTML(t, ruleset) : ""}${aboutOpen ? aboutModalHTML(t) : ""}`;
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

/**
 * Where the manicule points — the game's single attention pointer.
 *
 * A scribe drew a pointing hand in the margin to say "here: THIS is the thing".
 * So it marks whatever the game is waiting on, and it is the only such mark on
 * the screen: the opponent's head while it is on them, your hand while you must
 * choose a card, the prompt while there is a button to press. Nothing else in
 * the UI competes to say "your turn".
 *
 * Pure derivation from the view — no new state, and the same rule in hotseat
 * (where the rendered seat is always the one to act) and online.
 *
 * @returns {'opponent'|'hand'|'prompt'}
 */
export function maniculeFocus(model) {
    const { view, seat } = model;
    switch (view.phase) {
        case "SWAP_WINDOW":
            // Rulebook 2.10: once your window is closed, it is on them.
            return view.swapDone[seat] ? "opponent" : "prompt";
        case "PICK_CARDS": {
            if (view.selfCommitted) return "opponent";
            // Rulebook 2.9: in the danger zone you wait for their open card first.
            const danger = dangerSpaces(view.bounds);
            const selfEndangered = view.positions[seat] === danger[seat];
            const opponentEndangered = view.positions[1 - seat] === danger[1 - seat];
            const openPlay = selfEndangered !== opponentEndangered;
            if (openPlay && selfEndangered && !view.openCard) return "opponent";
            return "hand"; // the choice is a card, so point at the cards
        }
        case "WINNER_MOVE":
            return model.move ? "prompt" : "opponent";
        default:
            return "prompt"; // GAME_OVER: the rematch/leave buttons
    }
}

/** "You" online (the other seat is elsewhere); "Player N" in hotseat/labels. */
function playerName(t, index, youIndex, online) {
    if (index === youIndex) return t("player.you");
    if (online) return t("player.opponent");
    return t("player.n", { n: index + 1 });
}

/** The crossed-swords crest at the head of the proclamation (defs in index.html). */
const crestHTML = () => `<svg class="menu-crest" aria-hidden="true"><use href="#swords"/></svg>`;

/** The entry screen: a proclamation nailed to the door. */
/**
 * The stylized Legacy/V2 selector on the menu — a two-state inked segmented
 * control. Only the creator picks; joiners inherit the room's ruleset. The choice
 * also drives the rules FAB's preview (chromeHTML reads model.ruleset).
 */
function rulesetToggleHTML(ruleset, t) {
    const opt = (id, name) =>
        `<button type="button" class="ruleset-opt${ruleset === id ? " active" : ""}"
             data-action="select-ruleset" data-ruleset="${id}"
             aria-pressed="${ruleset === id}">${name}</button>`;
    return `
      <div class="menu-section ruleset-choice">
        <span class="ruleset-label">${t("menu.rulesetLabel")}</span>
        <div class="ruleset-toggle" role="group" aria-label="${t("menu.rulesetLabel")}">
          ${opt("legacy", t("ruleset.legacyName"))}
          ${opt("v2", t("ruleset.v2Name"))}
        </div>
        <p class="hint">${t(ruleset === "v2" ? "menu.v2Hint" : "menu.legacyHint")}</p>
      </div>`;
}

function menuHTML(model, t, lang) {
    const hotseat = model.hotseatEnabled
        ? `
        <div class="menu-divider">${t("menu.or")}</div>
        <div class="menu-section">
          <button type="button" data-action="new-game">${t("menu.newHotseat")}</button>
          <p class="hint">${t("menu.hotseatHint")}</p>
        </div>`
        : "";
    return `
    <div class="screen menu">
      <div class="top-controls">${langToggleHTML(t, lang)}</div>
      <div class="menu-panel vellum">
        ${crestHTML()}
        <h1>Truqué</h1>
        <p class="tagline">${t("menu.tagline")}</p>
        ${model.error ? `<p class="error">${model.error}</p>` : ""}
        ${rulesetToggleHTML(model.ruleset ?? "legacy", t)}
        <div class="menu-section">
          <button type="button" class="primary" data-action="create-room">${t("menu.createRoom")}</button>
          <p class="hint">${t("menu.createHint")}</p>
        </div>
        <div class="menu-divider">${t("menu.or")}</div>
        <div class="menu-section">
          <div class="join-row">
            <input id="join-code" type="text" maxlength="6" placeholder="${t("menu.roomCodePlaceholder")}"
                   autocomplete="off" autocapitalize="characters" spellcheck="false" />
            <button type="button" data-action="join-room">${t("menu.joinRoom")}</button>
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
      <div class="menu-panel vellum">
        ${crestHTML()}
        <h1>Truqué</h1>
        <p class="tagline">${t("lobby.roomCode")}</p>
        <p class="room-code">${model.roomCode ?? "····"}</p>
        ${model.ruleset ? `<p class="lobby-ruleset">${t("lobby.rulesetLabel")}: <b>${t(model.ruleset === "v2" ? "ruleset.v2Name" : "ruleset.legacyName")}</b></p>` : ""}
        <p class="hint">${t("lobby.shareHint")}</p>
        <div class="menu-section">
          <button type="button" class="primary" data-action="copy-link"${model.roomCode ? "" : " disabled"}>
            ${model.copied ? t("lobby.linkCopied") : t("lobby.copyLink")}
          </button>
        </div>
        <p class="instructions">${status}</p>
        <div class="menu-section">
          <button type="button" data-action="leave-room">${t("common.cancel")}</button>
        </div>
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
      <div class="curtain-panel vellum">
        ${result}
        <h2>${t("curtain.pass", { n: seat + 1 })}</h2>
        <button type="button" class="primary" data-action="continue">${t("curtain.continue", { n: seat + 1 })}</button>
      </div>
    </div>`;
}

/**
 * The spread: a field sheet on the left, a true margin column on the right,
 * and, below it in the same column, your own hand on its own sheet. The field
 * sheet carries the whole public record of the game (opponent, piles, manilha
 * seal, board, modifiers) and ends with the prompt — the one live decision,
 * marked with a manicule. The margin holds reference material only: the last
 * duel, the round log, and the suit cycle. Nothing there is ever clicked to
 * play — which is why it lives in a column that cannot move the play column.
 */
function gameHTML(model, t) {
    const { view, ui } = model;
    const over = view.phase === "GAME_OVER";
    const youIndex = model.online ? view.playerIndex : null;
    const labels = [0, 1].map((i) => playerName(t, i, youIndex, model.online));
    const lang = ui.lang ?? DEFAULT_LANG;
    const focus = maniculeFocus(model);
    // The inner wrapper is load-bearing, not decoration: on the desktop spread
    // it is taken out of flow so the margin contributes NO height to the grid
    // row. Reference material must never be able to push the play column — and
    // with it, your hand — down the page as the round log grows. See base.css.
    const margin = `
      <aside class="game-side">
        <div class="margin-inner">
          ${view.lastResolution ? `<section class="panel reveal-panel"><h3 class="side-title">${t("side.lastRound")}</h3>${revealHTML(view.lastResolution, { t, labels, youIndex, small: true })}</section>` : ""}
          ${roundLogHTML(view, { t, labels, youIndex })}
          ${suitCycleHTML(t)}
        </div>
      </aside>`;
    return `
    <div class="screen game${ui.fantasySuits ? " theme-fantasy" : ""}">
      ${hudHTML(view, { t, lang, concede: !over, concedeArmed: ui.concedeArmed, fantasy: !!ui.fantasySuits, muted: !!ui.muted })}
      ${connectionBannerHTML(model, t)}
      <div class="game-body">
        <div class="game-main">
          <section class="field-sheet vellum">
            ${opponentHTML(view, { t, online: model.online, manicule: focus === "opponent" })}
            <div class="field-top">
              ${pilesHTML(view, t)}
              ${manilhaHTML(view, t)}
              <div></div>
            </div>
            ${boardHTML(view, t)}
            <div class="prompt">
              <span class="manicule-slot">${focus === "prompt" ? maniculeHTML() : ""}</span>
              <div class="prompt-body">${actionZoneHTML(model, t)}</div>
            </div>
          </section>
          ${over ? "" : handHTML(view, ui, { t, online: model.online, manicule: focus === "hand" })}
        </div>
        ${margin}
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
    const danger = dangerSpaces(view.bounds);
    const selfEndangered = view.positions[seat] === danger[seat];
    const opponentEndangered = view.positions[opponent] === danger[opponent];
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
    const buttons = model.online
        ? onlineRematchHTML(model, t)
        : `<button type="button" class="primary" data-action="rematch">${t("over.rematch")}</button>
        <button type="button" data-action="menu">${t("common.backToMenu")}</button>`;
    return `
    <div class="game-over">
      <h2>${message}</h2>
      ${model.online ? rematchNoticeHTML(model, t) : ""}
      <div class="buttons">
        ${buttons}
      </div>
    </div>`;
}

/** Online: a rematch button (or "waiting" once you've voted) plus leave. */
function onlineRematchHTML(model, t) {
    const rematch = model.rematch ?? { you: false, opponent: false };
    const rematchButton = rematch.you
        ? `<button type="button" class="primary" disabled>${t("over.rematchWaiting")}</button>`
        : `<button type="button" class="primary" data-action="request-rematch">${t("over.rematch")}</button>`;
    return `${rematchButton}
        <button type="button" data-action="leave-room">${t("common.backToMenu")}</button>`;
}

/** Online: surface the opponent's pending rematch vote. */
function rematchNoticeHTML(model, t) {
    const rematch = model.rematch ?? { you: false, opponent: false };
    if (rematch.opponent && !rematch.you) {
        return `<p class="rematch-notice">${t("over.opponentWantsRematch")}</p>`;
    }
    if (rematch.you && !rematch.opponent) {
        return `<p class="instructions">${t("over.rematchAsked")}</p>`;
    }
    return "";
}
