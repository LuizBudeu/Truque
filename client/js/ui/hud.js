/** Top bar: brand, round, phase, seat badge, language + suit toggles, concede.
 *  Deck/graveyard counts live on the table piles (Figure 2), not up here. */

import { languageMeta } from '../i18n.js';

/**
 * @param {import('../../../shared/views.js').PlayerView} view
 * @param {Object} [options]
 * @param {(key: string, params?: object) => any} options.t - bound translator
 * @param {string} [options.lang] - active language code (for the toggle chip)
 * @param {boolean} [options.concede] - show the concede control (game running)
 * @param {boolean} [options.concedeArmed] - first click happened; ask to confirm
 * @param {boolean} [options.fantasy] - fantasy suit glyphs are active
 */
export function hudHTML(view, { t, lang = 'en', concede = false, concedeArmed = false, fantasy = false } = {}) {
  const meta = languageMeta(lang);
  const concedeControls = !concede
    ? ''
    : concedeArmed
      ? `<span class="concede-confirm">${t('concede.confirm')}
           <button type="button" class="danger" data-action="confirm-concede">${t('concede.yes')}</button>
           <button type="button" data-action="cancel-concede">${t('concede.keepPlaying')}</button>
         </span>`
      : `<button type="button" class="danger subtle" data-action="concede">${t('concede.button')}</button>`;
  return `
    <header class="hud">
      <div class="hud-left">
        <span class="brand">Truqué</span>
        <span class="hud-stat">${t('hud.round', { n: view.round })}</span>
        <span class="hud-phase">${t('phase.' + view.phase)}</span>
      </div>
      <div class="hud-right">
        <span class="seat-badge seat-${view.playerIndex}">${t('hud.youAre', { n: view.playerIndex + 1 })}</span>
        <button type="button" class="subtle lang-toggle" data-action="cycle-lang"
                title="${t('lang.title', { name: meta.name })}">🌐 ${meta.label}</button>
        <button type="button" class="subtle" data-action="toggle-suits"
                title="${t('hud.suitsTitle')}">
          ${fantasy ? `♠ ${t('hud.classicSuits')}` : `🗡 ${t('hud.fantasySuits')}`}
        </button>
        ${concedeControls}
      </div>
    </header>`;
}
