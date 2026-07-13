/** Manilha panel: the drawn ♣ card and what it means this round. */

import { cardHTML, rankLabel } from './card.js';

export function manilhaHTML(view) {
  let body;
  if (!view.manilhaCard) {
    body = '<div class="manilha-note">Revealed after the swap window</div>';
  } else if (view.manilha === null) {
    // Rulebook 2.7: face cards and A cannot be manilha.
    body = `${cardHTML(view.manilhaCard)}<div class="manilha-note">Face card — no manilha this round</div>`;
  } else {
    body = `${cardHTML(view.manilhaCard)}<div class="manilha-note">Every ${rankLabel(view.manilha)} is worth 14</div>`;
  }
  return `<div class="manilha-panel"><h3>Manilha</h3>${body}</div>`;
}
