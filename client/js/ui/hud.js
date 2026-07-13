/** Top bar: round, phase, seat badge, counts, graveyard access, concede. */

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
 */
export function hudHTML(view, { concede = false, concedeArmed = false } = {}) {
  const concedeControls = !concede
    ? ''
    : concedeArmed
      ? `<span class="concede-confirm">Concede the game?
           <button type="button" class="danger" data-action="confirm-concede">Yes, concede</button>
           <button type="button" data-action="cancel-concede">Keep playing</button>
         </span>`
      : '<button type="button" class="danger" data-action="concede">Concede</button>';
  return `
    <header class="hud">
      <div class="hud-left">
        <strong>Truqué</strong>
        <span>Round ${view.round}</span>
        <span>${PHASE_LABELS[view.phase]}</span>
        <span class="seat-badge seat-${view.playerIndex}">You are Player ${view.playerIndex + 1}</span>
      </div>
      <div class="hud-right">
        <span>Deck ${view.playDeckCount}</span>
        <span>Opponent hand ${view.opponentHandCount}</span>
        <span>Swaps left — P1: ${view.swapsRemaining[0]} · P2: ${view.swapsRemaining[1]}</span>
        <button type="button" data-action="open-graveyard">Graveyard (${view.graveyard.length})</button>
        ${concedeControls}
      </div>
    </header>`;
}
