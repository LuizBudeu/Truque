# Truqué

Two-player online card game on a linear 12-space board: both players secretly pick a card each round, cards are revealed simultaneously, and the winner pushes the loser toward their board edge.

**`docs/PLANNING.md` is the source of truth** for architecture, conventions, implementation phases, and rule interpretations (§10 is the canonical decision log for rulebook ambiguities). Read it before making structural decisions. Original rules (Portuguese): `docs/truque_documentacao.pdf`.

## Commands

- `npm test` — run all tests (Node's built-in `node:test`, no dependencies)
- `node --test test/rules.test.js` — run a single test file
- `node server/index.js` — start the game server (Phase 3+)

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

Track progress in `docs/PLANNING.md` §9. Each phase must be verifiably done before the next starts. Phases 0–1 are complete (rules engine fully implemented and tested; full games play through the reducer alone). Phase 2 (hotseat UI) is next. Note: `state.phase` only takes the resting values `SWAP_WINDOW | PICK_CARDS | WINNER_MOVE | GAME_OVER` — the other conceptual phases from §3.2 resolve atomically inside reducer transitions.
