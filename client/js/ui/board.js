/**
 * The battlefield: two castle towers flanking 12 hexagonal spaces (Figure 2
 * of the rulebook), heraldic pennants for pawns, danger-zone alerts, and the
 * always-visible modifier medallions so players can read the current ♠/♦ buffs
 * at a glance.
 */

import { dangerSpaces, distanceBetween, distanceModifier } from '../../../shared/rules.js';
import { suitGlyphHTML } from './card.js';

const signed = (n) => (n > 0 ? `+${n}` : `${n}`);

const pawnHTML = (player) =>
  `<span class="pawn pawn-p${player}"><span class="pawn-flag">P${player + 1}</span></span>`;

export function boardHTML(view, t) {
  const [p0, p1] = view.positions;
  const [dangerL, dangerR] = dangerSpaces(view.bounds);
  const spaces = [];
  // Under a shrinking ruleset (V2) the board only spans its current bounds.
  for (let i = view.bounds.min; i <= view.bounds.max; i++) {
    const pawn = i === p0 ? pawnHTML(0) : i === p1 ? pawnHTML(1) : '';
    const classes = ['space'];
    if (i === dangerL || i === dangerR) classes.push('danger');
    if (pawn) classes.push('has-pawn');
    spaces.push(`<div class="${classes.join(' ')}"><span class="space-hex"></span>${pawn}</div>`);
  }

  // Danger-zone tension cue: the threatened side's tower lights up.
  const towerL = `<div class="tower tower-left${p0 === dangerL ? ' alert' : ''}"></div>`;
  const towerR = `<div class="tower tower-right${p1 === dangerR ? ' alert' : ''}"></div>`;

  return `
    <div class="board-zone">
      <div class="battlefield">
        ${towerL}
        <div class="board">${spaces.join('')}</div>
        ${towerR}
      </div>
      ${modsHTML(view, t)}
    </div>`;
}

/**
 * Rulebook 2.6, Table 1 — live readout of the distance modifiers, struck as
 * medallions: the distance is the cause (set apart by a rule), the three suit
 * marks are its effects.
 */
function modsHTML(view, t) {
  const d = distanceBetween(view.positions);
  const medallion = (suit, label) => {
    const mod = distanceModifier(suit, d);
    const tone = mod > 0 ? 'buffed' : mod < 0 ? 'nerfed' : 'neutral';
    // Kept on one line: the class and its value must stay adjacent for the
    // markup assertions in test/ui.test.js.
    return `<div class="mod suit-${suit} ${tone}"><span class="ico">${suitGlyphHTML(suit)}</span><span class="val">${signed(mod)}</span><span class="lbl">${label}</span></div>`;
  };
  // V2 magic is opponent-dependent, so its medallion shows both directions at
  // once (its value against a bow and against a sword); Legacy magic is a flat 0.
  const magic =
    view.ruleset === 'v2' ? magicMedallion(d, t) : medallion('hearts', t('buff.magic'));
  return `
    <div class="mods">
      <div class="mod distance"><span class="val">${d}</span><span class="lbl">${t('buff.distance')}</span></div>
      ${medallion('spades', t('buff.sword'))}
      ${medallion('diamonds', t('buff.bow'))}
      ${magic}
    </div>`;
}

/**
 * V2 magic medallion: the ♥ modifier tracks the opponent's suit through the
 * cycle (beats ♦ → +, loses to ♠ → −), scaled by the distance magnitude — the
 * same numbers the ♦/♠ medallions carry. Shown as a pair so the swing is legible
 * before the reveal. Rulebook V2 (shared/rulesets/v2.js).
 */
function magicMedallion(d, t) {
  const vsBow = Math.abs(distanceModifier('diamonds', d));
  const vsSword = -Math.abs(distanceModifier('spades', d));
  // Colour each number by its own sign (blue +, red −); the suit glyph stays ink.
  const vs = (suit, v) => {
    const tone = v > 0 ? 'buffed' : v < 0 ? 'nerfed' : 'neutral';
    return `<span class="vs">${suitGlyphHTML(suit)}<span class="n ${tone}">${signed(v)}</span></span>`;
  };
  return `<div class="mod suit-hearts dynamic"><span class="ico">${suitGlyphHTML('hearts')}</span><span class="val vs-pair">${vs('diamonds', vsBow)}${vs('spades', vsSword)}</span><span class="lbl">${t('buff.magic')}</span></div>`;
}
