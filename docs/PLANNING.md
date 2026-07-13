# Truqué — Digital Version: Project Planning

A two-player online card game, originally designed as a physical game for a game design course. This document is the source of truth for architecture, conventions, and implementation phases. It is meant to be read by developers and by Claude Code sessions working on the project.

Rules reference: `docs/truque_documentacao.pdf` (original rules, in Portuguese). Section 10 of this document lists rule ambiguities that must be resolved before implementing the rules engine.

---

## 1. Product summary

Truqué is a turn-based duel played on a linear board of 12 spaces (6 per side). Each round, both players secretly pick a card from their hand; cards are revealed simultaneously and compared. The winner pushes the loser along the board. A player loses when pushed off their end of the board.

Key mechanics that shape the technical design:

- **Simultaneous secret choices** — hidden information is central. The opponent's hand must never reach the other client.
- **Discrete events, no real-time simulation** — everything happens in steps (reveal manilha, pick, reveal, resolve, move, draw, swap window). There is no per-frame game logic.
- **Distance-based modifiers** — ♠ gets stronger at close range, ♦ at long range, ♥ ignores modifiers. Distance is derived from pawn positions.
- **Special cards (A, K, Q, J)** — modify win conditions and movement effects.
- **Manilha** — a per-round trump value drawn from a separate ♣ deck.

Target experience: playable in the browser via a shareable room link, with polished but restrained animations (card flips, pawn slides, manilha reveal).

## 2. Tech stack

| Layer        | Choice                                                                                                | Rationale                                                                              |
| ------------ | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Client       | Vanilla JS (ES modules), HTML, CSS                                                                    | Card UIs are UI work; DOM + CSS transitions are the right tool. No framework overhead. |
| Animations   | CSS transitions/keyframes first; GSAP only if chained sequences demand it                             | "Nice but not excessive."                                                              |
| Server       | Node.js + `ws` (WebSocket)                                                                            | Thin authoritative server; turn-based traffic is tiny.                                 |
| Shared rules | Pure JS module used by both client and server                                                         | Single source of truth for game logic.                                                 |
| Tests        | Node's built-in `node:test` runner                                                                    | Zero dependencies; the rules engine is pure functions, ideal for unit tests.           |
| Build        | None for `/shared` and `/server`; client served as plain ES modules (optionally Vite later if needed) | Keep the toolchain minimal.                                                            |

Language: **all code, comments, commit messages, and identifiers in English**, as in a real-world project. Portuguese game terms that have no clean translation are kept as domain vocabulary: `manilha` (round trump). Everything else is translated: `dangerZone` (casa de perigo), `graveyard` (cemitério), `swap` (troca), `suit cycle` (ordem cíclica de naipes).

## 3. Architecture

### 3.1 Core principle: pure rules engine (state + reducer)

The entire game is modeled as immutable state transformed by pure functions:

```js
const nextState = applyAction(state, action);
// action example: { type: 'PLAY_CARD', player: 0, card: { rank: 7, suit: 'spades' } }
```

Why this fits Truqué:

1. **Testable without a UI** — every rule (buff tables, special cards, tie-breaking) is a unit test on plain data.
2. **Serializable** — state and actions travel over WebSocket as JSON with no translation layer.
3. **Isomorphic** — the same `/shared` module runs on the server (authoritative validation) and on the client (rendering, optimistic checks, legal-move hints).

Explicitly **not** an ECS. The game has 2 pawns, ~40 cards, and no per-frame systems; an ECS would add indirection with no payoff. Clean and direct means: plain data, pure functions, one explicit state machine.

### 3.2 Round state machine

The round flow is an explicit finite state machine. Phase names mirror the rulebook so the code reads like the documentation:

```
ROUND_START ─► SWAP_WINDOW ─► DRAW_MANILHA ─► PICK_CARDS ─► REVEAL
                                                                │
        ┌───────────────────────────────────────────────────────┘
        ▼
     RESOLVE ─► WINNER_MOVE ─► DRAW_CARDS ─► (check GAME_OVER) ─► ROUND_START
```

Notes:

- `SWAP_WINDOW`: per the rules, swaps happen "while the next manilha is not yet revealed", so it precedes `DRAW_MANILHA` (§10, Q6).
- `PICK_CARDS` handles the **danger zone open-play rule**: if exactly one player is on their danger space, the opponent must commit and reveal first, turning the pick sequential for that round.
- `WINNER_MOVE` is a separate phase because the winner makes a choice (advance/retreat 0–2, or up to 5 with Q, or push placement with K).
- `GAME_OVER` triggers when a pawn is pushed beyond the danger space.

### 3.3 State shape (draft)

```js
{
  phase: 'PICK_CARDS',
  round: 7,
  manilha: 5,                    // rank 2–10, or null (face card drawn)
  positions: [2, 8],             // board indices, player 0 and player 1
  hands: [ [Card], [Card] ],     // full info only on the server
  playDeck: [Card],
  manilhaDeck: [Card],
  graveyard: [Card],             // public, inspectable at any time
  swapsRemaining: [4, 4],
  pendingPicks: [Card|null, Card|null],
  lastResolution: { ... },       // data the client uses to animate the reveal/move
  winner: null                   // 0 | 1 | null
}
```

`Card` is `{ rank: 2..14, suit: 'hearts' | 'diamonds' | 'spades' }` with `11=J, 12=Q, 13=K, 14=A` (internal encoding; combat values are computed by the engine, not stored on the card).

### 3.4 State filtering (hidden information)

The server **never broadcasts the full state**. Each client receives a _view_ produced by `getPlayerView(state, playerIndex)`:

- Own hand: full cards.
- Opponent hand: card count only.
- Decks: counts only.
- Opponent's pending pick: `committed: true/false`, never the card — except in the danger-zone open-play case, where the rules require early reveal.
- Graveyard and manilha: public.

This is a foundation-level concern, not a patch: because secret picks are the heart of the game, no code path may serialize the opponent's hidden cards to a client. A dedicated test suite asserts that views leak nothing.

### 3.5 Directory layout

```
truque/
├── docs/
│   ├── PLANNING.md              # this document
│   └── truque_documentacao.pdf  # original rules
├── shared/
│   ├── cards.js                 # deck building, shuffling (seedable RNG)
│   ├── rules.js                 # combat resolution: modifiers, manilha, ties, specials
│   ├── reducer.js               # applyAction(state, action) + phase machine
│   ├── validation.js            # isLegalAction(state, playerIndex, action)
│   └── views.js                 # getPlayerView(state, playerIndex)
├── server/
│   ├── index.js                 # HTTP + WebSocket bootstrap, static file serving
│   ├── rooms.js                 # room lifecycle: create, join by code, rejoin
│   └── protocol.js              # message schemas client <-> server
├── client/
│   ├── index.html
│   ├── css/
│   │   ├── base.css
│   │   ├── board.css
│   │   └── cards.css
│   └── js/
│       ├── main.js              # bootstrapping, screen routing (menu / room / game)
│       ├── net.js               # WebSocket wrapper: connect, send, reconnect
│       ├── store.js             # holds current view + previous view
│       ├── render.js            # render(view): rebuilds UI from state
│       ├── animate.js           # diffs prev/next view -> animation sequences
│       └── ui/                  # hand, board, graveyard modal, manilha, HUD
└── test/
    ├── rules.test.js
    ├── reducer.test.js
    ├── views.test.js            # hidden-information leak tests
    └── scenarios.test.js        # full scripted games
```

### 3.6 Client rendering model

Declarative and simple: `render(view)` rebuilds the visible UI from the current view. Animations are driven by **diffing** the previous view against the new one in `animate.js`:

- `positions[1]` changed from 8 to 6 → animate the pawn sliding two spaces.
- `lastResolution` present → play the reveal sequence (flip both cards, highlight winner, show modifier breakdown).
- `manilha` changed → flip the manilha card.

Sequence: receive view → run animations for the diff (async) → commit final rendered state. Keep a small queue so a fast series of server messages doesn't cut animations short.

### 3.7 Network protocol (draft)

Client → server:

```
{ type: 'CREATE_ROOM' }
{ type: 'JOIN_ROOM', roomCode }
{ type: 'ACTION', action }        // game actions, validated by /shared/validation.js
{ type: 'RESYNC' }                // request full view after reconnect
```

Server → client:

```
{ type: 'ROOM_CREATED', roomCode, playerToken }
{ type: 'ROOM_STATE', players, status }
{ type: 'VIEW', view }            // filtered state after every accepted action
{ type: 'REJECTED', reason }
{ type: 'OPPONENT_STATUS', connected }
```

Server is fully authoritative: it applies actions through the same reducer, rejects illegal ones, and pushes fresh views. `playerToken` (random, stored in `sessionStorage`) allows rejoining a room after a refresh or drop.

Deck shuffling uses a **seedable RNG** (e.g. mulberry32) — the server picks the seed. This makes bugs reproducible and scripted tests deterministic.

## 4. Implementation phases

Each phase produces something verifiable before the next begins.

### Phase 0 — Rule clarification & skeleton

- Resolve every open question in §10 with the game's designers; record answers in §10 itself.
- Repo skeleton, `package.json`, test runner wired up, empty modules with JSDoc contracts.

**Done when:** §10 has no unresolved items; `npm test` runs (even with 0 tests).

### Phase 1 — Rules engine (`/shared`) + tests

- Deck construction (36-card play deck: 2–10 + J, Q, K, A of ♥♦♠... confirm composition in §10 Q7; ♣ manilha deck).
- Combat resolution: numeric order, distance modifier table, manilha override, suit-cycle tiebreak, all four special cards and their interactions (as decided in §10).
- Reducer covering the full phase machine, including swaps, graveyard, deck reshuffle, danger zone, game over.
- Validation module (legal actions per player per phase).
- Scenario tests: full games driven by scripted action lists with fixed seeds.

**Done when:** an entire game can be played through function calls alone, and edge cases from §10 have dedicated tests.

### Phase 2 — Local hotseat (ugly but complete UI)

- Two players on one screen, "pass the device" style with a pick-confirmation curtain so picks stay secret.
- Full UI functionality with placeholder styling: hand, board, manilha, graveyard modal, swap flow, winner-move choice, danger-zone open play.
- No network code at all — the client calls the reducer directly.

**Done when:** a complete game of Truqué is playable and correct in one browser tab.

_Rationale: debugging rules and networking at the same time is miserable. Rules get fully validated here._

### Phase 3 — Networking

- Node server with rooms (create / join by short code / rejoin by token).
- Authoritative action handling through the shared reducer; per-player views via `views.js`.
- Client `net.js` replaces direct reducer calls; hotseat mode is kept behind a flag as a debugging tool.
- Reconnection: page refresh mid-game restores the session.
- Hidden-information leak tests over the real protocol.

**Done when:** two browsers on different machines can play a full game; refresh mid-game recovers.

### Phase 4 — Visual design & animation

- Real art direction: board, card faces, pawns/towers, layout per Figure 2 of the rulebook.
- Animations: simultaneous card flip on reveal, pawn slides, manilha flip, winner highlight, modifier breakdown ("7♠ +3 close-range = 10 vs ...").
- Distance/buff indicator so players always see the current ♠/♦ modifiers.
- Danger-zone tension cues (subtle — e.g. board edge glow).

**Done when:** a spectator can follow a round without reading the rules.

### Phase 5 — Polish

- Sound effects (reveal, move, win/lose).
- Quality of life: swap counter, round log, rematch button, copy-room-link.
- Responsive layout (desktop first; playable on mobile).
- Error surfaces: opponent disconnected, room full, invalid code.

**Done when:** the group would happily demo it in class.

## 5. Coding conventions

- English for all identifiers, comments, commits, and docs. Domain term kept: `manilha`.
- ES modules everywhere (`"type": "module"`).
- `/shared` is dependency-free and side-effect-free: no DOM, no Node APIs, no `Math.random()` (RNG is injected/seeded).
- State is never mutated; the reducer returns new objects. Keep it simple — plain spreads, no immutability library.
- Prefer small pure functions with JSDoc over classes. Classes only where identity + lifecycle genuinely helps (e.g. `Room` on the server).
- No dependencies without discussion. Expected total: `ws`, possibly GSAP later.
- Every rule implemented in `rules.js` cites the rulebook section in a comment (e.g. `// Rulebook 2.6, Table 1`).

## 6. Testing strategy

- **Unit** — `rules.test.js`: modifier table (all distances × suits), manilha edge cases (face card drawn → no manilha), suit cycle, each special card, special-card interactions (J+K, J+A, double J...).
- **Reducer** — phase transitions, illegal action rejection, swap limits, graveyard reshuffle, game-over detection including "pushed beyond danger space" and edge positions.
- **Views** — serialize every view in every phase and assert the opponent's hidden cards never appear (including the danger-zone early-reveal exception behaving exactly as specified).
- **Scenarios** — scripted full games with fixed seeds acting as regression tests; add one for every bug found.

## 7. Definition of "clean and direct" for this project

1. Someone who read the rulebook can find each rule in exactly one place in `rules.js`.
2. No abstraction exists to serve a hypothetical future (no ECS, no plugin system, no event bus beyond the reducer).
3. The dependency list stays countable on one hand.
4. Data flows one way: action → reducer → state → view → render.

## 8. Risks & mitigations

| Risk                                           | Mitigation                                                                                        |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Rule ambiguities discovered mid-implementation | Phase 0 sign-off; §10 is the living decision log                                                  |
| Hidden info leaking through a lazy code path   | Views built by a single function + leak test suite (Phases 1 & 3)                                 |
| Animation logic entangled with game logic      | Animations only read view diffs; they never touch state                                           |
| Scope creep on visuals                         | Phase 4 has a fixed shot list; extras go to Phase 5 backlog                                       |
| Simultaneous-pick race conditions              | Server serializes actions per room; picks are commitments, resolution only fires when both are in |

## 9. Milestone checklist

- [x] Phase 0 — rules signed off, skeleton runs
- [x] Phase 1 — full game playable via tests
- [x] Phase 2 — hotseat playable in browser
- [ ] Phase 3 — online play between two machines
- [ ] Phase 4 — visual pass complete
- [ ] Phase 5 — demo-ready

## 10. Open rule questions (decision log)

To be answered by the game designers before Phase 1. Record the answer inline and keep this section as the canonical interpretation of the rulebook.

**Q1 — Losing against A / losing with K (rulebook 2.4 & 2.8).** The sentence "A perda contra Ás (A) e Rei (K) e com o Rei (K) tem condições especiais" appears truncated. Confirm: losing against A → loser retreats 2 (per 2.8)? Losing against K → pushed up to 3 at winner's choice (per 2.8)? Losing _with_ K → return to own first space (per 2.8)? Is that the complete set?
**Answer:** Losing _with_ K → return to own first space (per 2.8)

**Q2 — J interactions.** J inverts the round result. (a) After inversion, do the "new winner's" card effects apply (e.g. opponent played Q, J-player loses inversion... who moves how)? (b) What happens when both players play J — double inversion cancels out, or tie? (c) J vs A: does A's forced suit-order comparison happen before or after inversion?
**Answer:** a) When a player plays J, the round result is inverted, so if the other player played a K, for example, at first, they would "win", but because it gets inverted, they "lose", meaning they would need to move to own first space. Losing with Q has no downsides -> normal loss. b) Tie. c) Inversion is always the last thing to happen, so A's forced suit-order comparison happens before.

**Q3 — Winner's retreat option.** "Advance or retreat 0–2 spaces" — confirmed as a strategic choice to manipulate distance buffs? Q extends the same choice to 0–5 in either direction?
**Answer:** Yes

**Q4 — Tie retreats at the board edge.** On a tie, both retreat 1. If a player is already on their danger space, does retreating end the game, or is the retreat clamped?
**Answer:** If a player is already on their danger space and they tie, they lose the game.

**Q5 — True ties.** With the ♥→♦→♠→♥ cycle, same rank + same suit is impossible in a single deck... but can modifiers create unresolvable comparisons anywhere? Confirm the tie rule in 2.4 only triggers on equal _modified values_ with the suit cycle then deciding, and a "tie" result only occurs when the cycle is somehow bypassed — or specify exactly when 'empate' happens.
**Answer:** A tie happens when the numerical value of both cards are the same (already including modified values because of space), and there's no external special rule to affect the result. _(Superseded by Q11: the suit cycle DOES break numeric ties.)_

**Q6 — Swap window timing.** Swaps happen "while the next manilha is not yet revealed". Confirm the window is between the end of movement/draw and the next manilha reveal (i.e. `SWAP_WINDOW` precedes `DRAW_MANILHA` in the round loop).
**Answer:** `SWAP_WINDOW` precedes `DRAW_MANILHA` in the round loop

**Q7 — Play deck composition.** Play deck = all ♥♦♠ cards including A/K/Q/J (36 cards total, 12 per suit)? Manilha deck = all 13 ♣ including face cards (which yield "no manilha" rounds)?
**Answer:** Yes _(the card count was a miscount — corrected by Q10: 39 cards, 13 per suit)_

**Q8 — Danger-zone open play, order of operations.** When the opponent must "play open": do they commit _and reveal_ before the endangered player picks? Can the endangered player then swap cards, or is the swap window already closed?
**Answer:** Commit and reveal.

**Q9 — Simultaneous game over.** Can any effect push both players out in the same round (e.g. tie retreats)? If so, is it a draw?
**Answer:** Yes, a draw is possible

_Questions Q10–Q14 were raised and answered during Phase 1 implementation (2026-07-13). Q10–Q13 were decided by the designers; Q14 records implementation decisions made from the rulebook's intent — flag if any is wrong._

**Q10 — Play deck recount.** Ranks 2–10 + J, Q, K, A are 13 per suit, so the "36 / 12 per suit" figure in Q7 doesn't add up. Which is it?
**Answer:** 39 cards — full ♥♦♠ suits, 13 ranks each. Manilha deck unchanged: all 13 ♣.

**Q11 — Numeric ties, final ruling (supersedes the Q5 wording).** Does the suit cycle break equal modified values, per rulebook 2.5?
**Answer:** Yes — equal modified values are broken by the suit cycle. A true tie ("empate", both retreat 1) only occurs when the cycle cannot decide: both players play J (Q2b), or an A forces suit comparison against a card of the same suit. A single J inverting a tie leaves it a tie.

**Q12 — Manilha value vs distance modifiers.** Is a manilha-rank card flat 14 or 14 + modifier?
**Answer:** Flat 14, immune to distance modifiers (rulebook 2.7 "worth 14 points"). Two manilha-rank cards are both 14 and the suit cycle decides. K's buff removal does not affect the manilha's 14 (it is not a buff).

**Q13 — Winner's move alongside specials.** When a special dictates the loser's movement (A win: retreat 2; K win: push up to 3; lost with K: return to first space), does the winner still take their normal 0–2 (0–5 with Q) move?
**Answer:** Yes, always. Order: the loser's forced movement resolves first, then the winner's own move. A K winner chooses both the push (0–3) and their own move.

**Q14 — Movement limits & effect conflicts (implementation decisions).**
- Pawns never pass or share a space: the winner's advance caps at the space adjacent to the opponent (distance 0).
- The winner's voluntary retreat caps at their own first space — no voluntary elimination.
- Forced retreats (base 1, A's 2, tie retreat) beyond a player's first space eliminate them (rulebook 2.12). K's push instead clamps at the loser's first space — except when the loser already stands there, where any push ≥ 1 eliminates them (rulebook 2.8, parenthetical).
- Conflicting loss effects: a loser who played K returns to their first space; this replaces any other retreat effect (e.g. also losing against an A).
- A's forced suit-order comparison ignores numeric values entirely, manilha included.
