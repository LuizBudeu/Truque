/**
 * The battlefield: two castle towers flanking 12 hexagonal spaces (Figure 2
 * of the rulebook), heraldic pennants for pawns, danger-zone alerts, and the
 * always-visible modifier medallions so players can read the current ♠/♦ buffs
 * at a glance.
 */

import { BOARD_SIZE, DANGER_SPACES, distanceBetween, distanceModifier } from '../../../shared/rules.js';
import { suitGlyphHTML } from './card.js';

const signed = (n) => (n > 0 ? `+${n}` : `${n}`);

const pawnHTML = (player) =>
  `<span class="pawn pawn-p${player}"><span class="pawn-flag">P${player + 1}</span></span>`;

export function boardHTML(view, t) {
  const [p0, p1] = view.positions;
  const spaces = [];
  for (let i = 0; i < BOARD_SIZE; i++) {
    const pawn = i === p0 ? pawnHTML(0) : i === p1 ? pawnHTML(1) : '';
    const classes = ['space'];
    if (i === DANGER_SPACES[0] || i === DANGER_SPACES[1]) classes.push('danger');
    if (pawn) classes.push('has-pawn');
    spaces.push(`<div class="${classes.join(' ')}"><span class="space-hex"></span>${pawn}</div>`);
  }

  // Danger-zone tension cue: the threatened side's tower lights up.
  const towerL = `<div class="tower tower-left${p0 === DANGER_SPACES[0] ? ' alert' : ''}"></div>`;
  const towerR = `<div class="tower tower-right${p1 === DANGER_SPACES[1] ? ' alert' : ''}"></div>`;

  return `
    <div class="board-zone">
      <div class="battlefield">
        ${towerL}
        <div class="board">${spaces.join('')}</div>
        ${towerR}
      </div>
      ${modsHTML(view.positions, t)}
    </div>`;
}

/**
 * Rulebook 2.6, Table 1 — live readout of the distance modifiers, struck as
 * medallions: the distance is the cause (set apart by a rule), the three suit
 * marks are its effects.
 */
function modsHTML(positions, t) {
  const d = distanceBetween(positions);
  const medallion = (suit, label) => {
    const mod = distanceModifier(suit, d);
    const tone = mod > 0 ? 'buffed' : mod < 0 ? 'nerfed' : 'neutral';
    // Kept on one line: the class and its value must stay adjacent for the
    // markup assertions in test/ui.test.js.
    return `<div class="mod suit-${suit} ${tone}"><span class="ico">${suitGlyphHTML(suit)}</span><span class="val">${signed(mod)}</span><span class="lbl">${label}</span></div>`;
  };
  return `
    <div class="mods">
      <div class="mod distance"><span class="val">${d}</span><span class="lbl">${t('buff.distance')}</span></div>
      ${medallion('spades', t('buff.sword'))}
      ${medallion('diamonds', t('buff.bow'))}
      ${medallion('hearts', t('buff.magic'))}
    </div>`;
}
