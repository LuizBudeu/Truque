/**
 * Suit-cycle reference (Rulebook 2.5): ♥ beats ♦ beats ♠ beats ♥. Always on
 * screen so players never have to remember the tiebreak order. Rendered as
 * the rulebook's triangle: one suit per corner, a clockwise arrow in the
 * middle, "beats" flowing top → bottom-right → bottom-left → top.
 */

import { suitGlyphHTML } from "./card.js";

export function suitCycleHTML(t) {
    // Inline SVG under the corner glyphs: one gold arc per edge, drawn clockwise
    // ♥→♦, ♦→♠, ♠→♥. Coordinates match the 140×118 .cycle-triangle box (corner
    // glyph centers ≈ top 70,16 · right 116,88 · left 28,88).
    const arrows = `
        <svg class="cycle-arrows" viewBox="0 0 140 120" aria-hidden="true">
          <defs>
            <marker id="cycle-arrowhead" viewBox="0 0 8 8" refX="6" refY="4"
                    markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0.5 L7,4 L0,7.5 Z" fill="currentColor"></path>
            </marker>
          </defs>
          <path d="M83 26a44 44 0 0 1 22 44" marker-end="url(#cycle-arrowhead)"></path>
          <path d="M96 92a44 44 0 0 1-52 0" marker-end="url(#cycle-arrowhead)"></path>
          <path d="M35 70a44 44 0 0 1 22-44" marker-end="url(#cycle-arrowhead)"></path>
        </svg>`;
    return `
    <div class="cycle-panel">
      <h3>${t("cycle.title")}</h3>
      <div class="cycle-triangle">
        ${arrows}
        <span class="cycle-corner corner-top suit-hearts">${suitGlyphHTML("hearts")}</span>
        <span class="cycle-corner corner-right suit-diamonds">${suitGlyphHTML("diamonds")}</span>
        <span class="cycle-corner corner-left suit-spades">${suitGlyphHTML("spades")}</span>
      </div>
      <p class="cycle-note">${t("cycle.note")}</p>
    </div>`;
}
