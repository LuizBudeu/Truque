/**
 * The battlefield: two castle towers flanking 12 hexagonal spaces (Figure 2
 * of the rulebook), banner pawns, danger-zone alerts, and the always-visible
 * distance/modifier bar so players can read the current ♠/♦ buffs at a glance.
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
      ${buffBarHTML(view.positions, t)}
    </div>`;
}

/** Rulebook 2.6, Table 1 — live readout of the distance modifiers. */
function buffBarHTML(positions, t) {
  const d = distanceBetween(positions);
  const chip = (suit, label) => {
    const mod = distanceModifier(suit, d);
    const tone = mod > 0 ? 'buffed' : mod < 0 ? 'nerfed' : 'neutral';
    return `<span class="buff-chip suit-${suit} ${tone}">${suitGlyphHTML(suit)} ${label} <b>${signed(mod)}</b></span>`;
  };
  return `
    <div class="buff-bar">
      <span class="buff-chip distance">${t('buff.distance')} <b>${d}</b></span>
      ${chip('spades', t('buff.sword'))}
      ${chip('diamonds', t('buff.bow'))}
      ${chip('hearts', t('buff.magic'))}
    </div>`;
}
