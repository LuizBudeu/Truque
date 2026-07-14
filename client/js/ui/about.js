/**
 * The floating "About" button and the colophon it opens.
 *
 * A colophon is the note a scribe left at the end of a manuscript saying who
 * made the book, for whom, and when — so it is the right shape for the credits
 * of a game that dresses itself as one. It is the mirror of the help mark:
 * fixed to the LEFT of every non-curtain screen, where the rules FAB sits right.
 *
 * The facts (who, where, when) live once in CREDITS below — they are proper
 * nouns and don't translate. The prose around them lives in i18n.js, which
 * interpolates CREDITS into a sentence per language.
 */

/**
 * Who made Truqué. The only place these names appear.
 * `rulesUrl` is served by the static server from the repo root (server/index.js).
 */
export const CREDITS = {
    authors: ["Luiz Guilherme Budeu", "Eduardo Hiroshi Ito", "Henrique D`Amaral Matheus", "Matheus Rezende", "Gabriel Cosme"],
    course: "Design e Programação de Games",
    institution: "UNIVERSIDADE DE SÃO PAULO",
    term: "2024",
    developer: "Luiz Guilherme Budeu",
    rulesUrl: "../docs/truque_documentacao.pdf",
};

/** "A, B, C and D" — the conjunction is translated, the names are not. */
function nameList(names, t) {
    if (names.length <= 1) return names.join("");
    return `${names.slice(0, -1).join(", ")} ${t("about.and")} ${names.at(-1)}`;
}

/**
 * A versal: the oversized initial that opens an illuminated paragraph. Split
 * off the first character of the sentence rather than baking the markup into
 * the dictionary, so every language gets one without thinking about it.
 */
function versal(text) {
    return `<span class="versal">${text.slice(0, 1)}</span>${text.slice(1)}`;
}

/** Fixed bottom-left button that opens the colophon. */
export function aboutFabHTML(t) {
    return `
    <button type="button" class="about-fab" data-action="open-about"
            aria-label="${t("about.title")}" title="${t("about.title")}">
      <span class="about-fab-mark" aria-hidden="true">⚜</span>
      <span class="about-fab-text">${t("about.button")}</span>
    </button>`;
}

/** The colophon modal: the scribe's closing note, centred on its own leaf. */
export function aboutModalHTML(t) {
    const devised = t("about.devised", {
        authors: nameList(CREDITS.authors, t),
        course: CREDITS.course,
        institution: CREDITS.institution,
        term: CREDITS.term,
    });
    // data-action="noop" keeps clicks inside the panel from hitting the backdrop.
    return `
    <div class="modal-backdrop" data-action="close-about">
      <div class="modal colophon vellum" data-action="noop">
        <div class="colophon-mark" aria-hidden="true">⚜</div>
        <h2>${t("about.title")}</h2>
        <div class="colophon-flourish" aria-hidden="true"></div>
        <p class="colophon-devised">${versal(devised)}</p>
        <p class="colophon-origin">${t("about.origin")}</p>
        <p>${t("about.edition", { developer: CREDITS.developer })}<br>
           ${t("about.rules", { href: CREDITS.rulesUrl })}</p>
        <button type="button" class="primary" data-action="close-about">${t("common.close")}</button>
      </div>
    </div>`;
}
