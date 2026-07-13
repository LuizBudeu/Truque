/** The linear 12-space board with pawns, danger spaces, and the distance readout. */

import { BOARD_SIZE, DANGER_SPACES, distanceBetween, distanceModifier } from '../../../shared/rules.js';

const signed = (n) => (n > 0 ? `+${n}` : `${n}`);

export function boardHTML(view) {
  const [p0, p1] = view.positions;
  const spaces = [];
  for (let i = 0; i < BOARD_SIZE; i++) {
    const classes = ['space'];
    if (i === DANGER_SPACES[0] || i === DANGER_SPACES[1]) classes.push('danger');
    const pawn =
      i === p0
        ? '<span class="pawn pawn-p0">P1</span>'
        : i === p1
          ? '<span class="pawn pawn-p1">P2</span>'
          : '';
    spaces.push(`<div class="${classes.join(' ')}">${pawn}</div>`);
  }
  const d = distanceBetween(view.positions);
  return `
    <div class="board-zone">
      <div class="board">${spaces.join('')}</div>
      <div class="distance-readout">
        Distance ${d} — modifiers: ♠ ${signed(distanceModifier('spades', d))} ·
        ♦ ${signed(distanceModifier('diamonds', d))} · ♥ 0
      </div>
    </div>`;
}
