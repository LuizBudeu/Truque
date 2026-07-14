# Truqué

Two-player online card game on a linear 12-space board: both players secretly pick a card each round, cards are revealed simultaneously, and the winner pushes the loser toward their board edge.

**`docs/PLANNING.md` is the source of truth** for architecture, conventions, implementation phases, and rule interpretations (§10 is the canonical decision log for rulebook ambiguities). Read it before making structural decisions. Original rules (Portuguese): `docs/truque_documentacao.pdf`.

## Commands

- `npm test` — run all tests (Node's built-in `node:test`; needs `npm install` for `ws` since the server tests run the real WebSocket server)
- `node --test test/rules.test.js` — run a single test file
- `npm start` — the real game server on :8080 (`PORT=` to override): static client + `ws` WebSocket on the same port; required for online play
- `npm run dev` — dependency-free static server on :8080, enough for hotseat-only work (no WebSocket)
- Hotseat mode is a debugging tool behind a URL flag: open `/client/?hotseat`

## Architecture in one paragraph

The whole game is a pure rules engine in `/shared`: immutable state + `applyAction(state, action)` reducer over an explicit phase machine (`ROUND_START → SWAP_WINDOW → DRAW_MANILHA → PICK_CARDS → REVEAL → RESOLVE → WINNER_MOVE → DRAW_CARDS → …`). The same module runs on the authoritative Node/`ws` server and on the vanilla-JS client. Clients never receive full state — only per-player views from `shared/views.js` (`getPlayerView`), because secret picks are the heart of the game. Data flows one way: action → reducer → state → view → render. Animations (`client/js/animate.js`) only diff previous/next views; they never touch game state.

## Hard rules

- `/shared` is dependency-free and side-effect-free: no DOM, no Node APIs, no `Math.random()` — RNG is seeded and injected (`mulberry32`).
- Never mutate state; reducers return new objects via plain spreads (no immutability library).
- No code path may serialize a player's hidden cards to the other client. `test/views.test.js` exists to enforce this — extend it when touching views or the protocol.
- Every rule in `shared/rules.js` cites the rulebook section in a comment (e.g. `// Rulebook 2.6, Table 1`).
- All identifiers, comments, commits, and docs in English. One kept domain term: `manilha` (per-round trump value).
- ES modules everywhere (`"type": "module"`). Prefer small pure functions with JSDoc; classes only where identity/lifecycle genuinely helps (e.g. server `Room`).
- No new dependencies without discussion (expected total: `ws`, maybe GSAP much later).

## Domain vocabulary

- `Card` = `{ rank: 2..14, suit }` with 11=J, 12=Q, 13=K, 14=A; combat values are computed by the engine, never stored on cards.
- Play deck = 39 cards (♥♦♠, 13 ranks 2–A per suit, §10 Q10); manilha deck = 13 ♣ cards (face card or A drawn → round has no manilha).
- Distance = number of spaces between the two pawns; drives ♠ (stronger close) / ♦ (stronger far) modifiers; ♥ ignores modifiers.
- Danger zone = a player's first space; triggers the open-play rule (opponent commits **and reveals** first).
- Graveyard = public discard pile; reshuffled into the play deck when it runs out.

## Phase status

Track progress in `docs/PLANNING.md` §9. Each phase must be verifiably done before the next starts. Phases 0–6 are complete. Rules engine fully implemented and tested; hotseat UI plays complete games in one tab; online play works — rooms with 4-letter join codes, authoritative `ws` server, per-player views, and refresh/drop rejoin via `playerToken` in `sessionStorage`. Phase 5 (polish) added WebAudio-synthesized sound effects (`client/js/sound.js`, a browser-only leaf module like `net.js`; cues fire from the animation plan in `main.js`, HUD mute toggle persisted in `localStorage`), an online rematch (both seats vote via `REQUEST_REMATCH`/`REMATCH_STATE`; `Room.requestRematch` replays with a fresh seed), a copy-room-link lobby button with one-click `?room=CODE` join, a round-history log (a public `history` array on the state → view → `client/js/ui/log.js`), and a mobile responsive pass (600px breakpoints; the board shrinks to fit a phone and scrolls inside itself below ~340px).

**Art direction (Phase 6) — "illuminated manuscript on oak".** The reference is the static mock `docs/truque-design-mock.html`. Two materials only: dark oak (the table) and vellum (the sheets you play on, `.vellum` — a torn deckle edge from the SVG filter in `index.html`, never `border-radius`). Six inks, defined once at the top of `base.css`. The game screen is a manuscript spread: a vellum **field sheet** (opponent's head · piles + manilha · towers-and-hexes board · modifier medallions · the prompt) beside a true **margin** column of marginalia on the bare oak (last duel, round log in roman numerals, suit cycle), with your own hand on its own sheet below. Conventions worth keeping:

- The **manicule** (☞) marks the one live decision, in the prompt, and appears nowhere else — don't sprinkle it on headings.
- The **manilha is a wax seal**, not a card (`ui/manilha.js`): it leaves a ruling, not a card in play. Grey and void when a face card or Ace is drawn (Rulebook 2.7). It still keeps card.js's flip machinery so `main.js` can animate the reveal by adding `.animate` to `.manilha-slot`.
- **Gold leaf marks power, and only in your hand**: a hand card whose rank is the round's manilha wears a gold star (`.card-spark`, the `spark` option on `cardHTML`; `hand.js` owns the "does this card rule the round" decision, the card builder just draws it). Silent when there is no manilha. The star shape lives once as `--spark-star` in `base.css` — it is also the fantasy ♥ (magic) glyph and, hand-copied, the tab icon `client/favicon.svg`.
- Board shapes are **clip-paths drawn twice** (an ink-coloured element with an inset `::before` on top), because clip-path can't carry a stroke and the heavy outline is what makes it read as a woodcut print rather than a gradient.
- Suit marks stay an empty `.suit-glyph[data-suit]` element whose mark comes from CSS: classic letters `♠♦♥♣`, and `.theme-fantasy` on the screen root swaps in the rulebook's weapon classes as inked `mask-image` shapes that take `currentColor` (not emoji — they must sit on vellum as ink). Renderers stay theme-agnostic; the preference persists in `localStorage`.
- Type is Grenze Gotisch (display) + EB Garamond (text) from Google Fonts, with a serif fallback stack so an offline load degrades instead of breaking.

Notes:

- `state.phase` only takes the resting values `SWAP_WINDOW | PICK_CARDS | WINNER_MOVE | GAME_OVER` — the other conceptual phases from §3.2 resolve atomically inside reducer transitions.
- `client/js/render.js` and everything in `client/js/ui/` are pure model → HTML-string functions with zero DOM access, so the whole UI is testable in Node (`test/ui.test.js` renders every state of full games in both modes). Keep it that way: `client/js/main.js` is the only module that may touch `document`/`sessionStorage`/`localStorage` (innerHTML + `data-action` click delegation; `localStorage` holds the fantasy-suit preference), `client/js/net.js` is a dumb reconnecting WebSocket pipe, and `client/js/store.js` owns model derivation (`buildViewModel` works from a PlayerView alone — move legality only needs public fields).
- The server never serializes full state: every outgoing game message goes through `Room.sendTo`/`getPlayerView`. `test/server.test.js` plays a full game over real WebSockets against a locally mirrored reducer and asserts every frame leaks nothing — extend it when touching the protocol.
- Animations: `client/js/animate.js` is a pure, DOM-free plan builder — `buildAnimationPlan(prevView, nextView)` → ordered steps (`reveal`, `pawn-slide`, `manilha-flip`), tested in `test/animate.test.js`. `main.js` executes plans AFTER rendering the final HTML (adds an `.animate` class whose CSS delays choreograph the sequence; pawn slides are FLIP transforms), so animations are pure decoration and a click mid-animation always hits real UI. Two render lanes in `main.js`: `rerender()` for instant UI-only changes, `transition()` for view changes — queued and pumped serially so message bursts can't cut an animation short.
