/** Top bar: brand, round, phase, seat badge, concede. Deck/graveyard counts
 *  live on the table piles (Figure 2), not up here. */

const PHASE_LABELS = {
  SWAP_WINDOW: 'Swap window',
  PICK_CARDS: 'Pick cards',
  WINNER_MOVE: 'Winner moves',
  GAME_OVER: 'Game over',
};

/**
 * @param {import('../../../shared/views.js').PlayerView} view
 * @param {Object} [options]
 * @param {boolean} [options.concede] - show the concede control (game running)
 * @param {boolean} [options.concedeArmed] - first click happened; ask to confirm
 * @param {boolean} [options.fantasy] - fantasy suit glyphs are active
 */
export function hudHTML(view, { concede = false, concedeArmed = false, fantasy = false } = {}) {
  const concedeControls = !concede
    ? ''
    : concedeArmed
      ? `<span class="concede-confirm">Concede the game?
           <button type="button" class="danger" data-action="confirm-concede">Yes, concede</button>
           <button type="button" data-action="cancel-concede">Keep playing</button>
         </span>`
      : '<button type="button" class="danger subtle" data-action="concede">Concede</button>';
  return `
    <header class="hud">
      <div class="hud-left">
        <span class="brand">Truqué</span>
        <span class="hud-stat">Round ${view.round}</span>
        <span class="hud-phase">${PHASE_LABELS[view.phase]}</span>
      </div>
      <div class="hud-right">
        <span class="seat-badge seat-${view.playerIndex}">You are Player ${view.playerIndex + 1}</span>
        <button type="button" class="subtle" data-action="toggle-suits"
                title="Switch between classic suits and fantasy weapons">
          ${fantasy ? '♠ Classic suits' : '🗡 Fantasy suits'}
        </button>
        ${concedeControls}
      </div>
    </header>`;
}
