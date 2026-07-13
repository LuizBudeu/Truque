/**
 * Suit-cycle reference (Rulebook 2.5): ♥ beats ♦ beats ♠ beats ♥. Always on
 * screen so players never have to remember the tiebreak order. Rendered as
 * the rulebook's triangle: one suit per corner, a clockwise arrow in the
 * middle, "beats" flowing top → bottom-right → bottom-left → top.
 */

import { suitGlyphHTML } from './card.js';

export function suitCycleHTML(t) {
  // Inline SVG under the corner glyphs: one curved "beats" arrow per edge,
  // clockwise ♥→♦, ♦→♠, ♠→♥. Coordinates match the 110×92 .cycle-triangle box
  // (corner glyph centers ≈ top 55,12 · right 91,80 · left 19,80).
  const arrows = `
        <svg class="cycle-arrows" viewBox="0 0 110 92" aria-hidden="true">
          <defs>
            <marker id="cycle-arrowhead" viewBox="0 0 8 8" refX="6" refY="4"
                    markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0.5 L7,4 L0,7.5 Z" fill="currentColor"></path>
            </marker>
          </defs>
          <path d="M69,22 Q92,38 91,62" marker-end="url(#cycle-arrowhead)"></path>
          <path d="M76,88 Q55,97 34,88" marker-end="url(#cycle-arrowhead)"></path>
          <path d="M19,62 Q18,38 41,22" marker-end="url(#cycle-arrowhead)"></path>
        </svg>`;
  return `
    <div class="cycle-panel">
      <h3>${t('cycle.title')}</h3>
      <div class="cycle-triangle">
        ${arrows}
        <span class="cycle-corner corner-top suit-hearts">${suitGlyphHTML('hearts')}</span>
        <span class="cycle-corner corner-right suit-diamonds">${suitGlyphHTML('diamonds')}</span>
        <span class="cycle-corner corner-left suit-spades">${suitGlyphHTML('spades')}</span>
      </div>
      <p class="cycle-note">${t('cycle.note')}</p>
    </div>`;
}
