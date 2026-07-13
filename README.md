# Truqué

A two-player online card game on a linear 12-space board. Each round both players secretly pick a card; the cards are revealed at the same time, and the winner pushes the loser one step toward their edge of the board. Push your opponent off their end to win.

Suits change how cards fight based on the distance between the two pawns, and a per-round **manilha** (trump value) is drawn from a separate deck. The full rules and design live in [`docs/PLANNING.md`](docs/PLANNING.md).

## Requirements

- Node.js 20 or newer

## Setup

```bash
npm install
```

## Running

```bash
npm start          # full game server on http://localhost:8080
```

Then open <http://localhost:8080/client/>. One player creates a room and gets a 4-letter join code; the other enters that code to join. Refreshing or briefly dropping reconnects you to the same seat.

Set a different port with `PORT=3000 npm start`.

### Other modes

```bash
npm run dev        # static-only server (no online play) on :8080
npm test           # run the test suite
```

- **Hotseat** (both players in one tab, for local play or debugging): open <http://localhost:8080/client/?hotseat>.

## Deploying

The server is a single Node process that serves the client **and** the WebSocket on one port (it reads `PORT` from the environment), so any host that runs Node works with no code changes. A free option like [Render](https://render.com) is enough: connect this repo as a Web Service with build command `npm install` and start command `npm start`, and share the resulting URL with your friends.

Note that GitHub Pages **cannot** host this — it only serves static files and can't run the WebSocket server the game needs.

## Layout

- `shared/` — the pure, dependency-free rules engine (immutable state + reducer); runs identically on server and client.
- `server/` — authoritative Node/`ws` server and room management.
- `client/` — vanilla-JS UI (model → HTML, with a thin DOM layer in `main.js`).
- `test/` — `node:test` suites for the engine, server, UI, and animations.
