/**
 * The floating "Rules" help button and its modal. The button is fixed to the
 * bottom-right of every non-curtain screen so a new player can consult the
 * rules at any moment (opening it pauses nothing — the reducer is untouched).
 *
 * The rules copy is fully translated: it comes from the structured
 * `rules.sections` entry in i18n.js, so this renderer never holds prose.
 */

/** Fixed bottom-right button that opens the rules modal. */
export function helpFabHTML(t) {
  return `
    <button type="button" class="help-fab" data-action="open-rules"
            aria-label="${t('help.title')}" title="${t('help.title')}">
      <span class="help-fab-mark">?</span>
      <span class="help-fab-text">${t('help.button')}</span>
    </button>`;
}

/** The rules modal, built from the active language's structured sections. */
export function rulesModalHTML(t, ruleset = 'legacy') {
  // V2 keeps the Legacy rulebook and prepends the two variant rules, flagged so a
  // reader sees exactly what differs (the base Magic / board sections still apply
  // except where these override them).
  const base = t('rules.sections');
  const sectionList = ruleset === 'v2' ? [...t('rules.v2Sections'), ...base] : base;
  const sections = sectionList
    .map(
      (s) => `
      <section class="rules-section${s.variant ? ' variant' : ''}">
        <h3>${s.h}</h3>
        ${s.p.map((para) => `<p>${para}</p>`).join('')}
      </section>`,
    )
    .join('');
  // data-action="noop" keeps clicks inside the panel from hitting the backdrop.
  return `
    <div class="modal-backdrop" data-action="close-rules">
      <div class="modal rules-modal vellum" data-action="noop">
        <h2>${t('help.title')}</h2>
        <div class="rules-body">${sections}</div>
        <button type="button" class="primary" data-action="close-rules">${t('common.close')}</button>
      </div>
    </div>`;
}
