/** Top bar: round, phase, seat badge, counts, graveyard access. */

const PHASE_LABELS = {
  SWAP_WINDOW: 'Swap window',
  PICK_CARDS: 'Pick cards',
  WINNER_MOVE: 'Winner moves',
  GAME_OVER: 'Game over',
};

export function hudHTML(view) {
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
      </div>
    </header>`;
}
