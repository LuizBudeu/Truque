/**
 * Server bootstrap (Phase 3): one HTTP server for the static client files
 * plus a `ws` WebSocket endpoint on the same port. Fully authoritative —
 * incoming ACTION messages are checked with shared/validation.js, applied
 * with shared/reducer.js, and each player receives only their filtered view
 * from shared/views.js (PLANNING.md §3.4, §3.7).
 *
 * `startServer()` is exported so tests can run the real server on an
 * ephemeral port; running this file directly starts it on $PORT (8080).
 */

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomInt } from 'node:crypto';
import { WebSocketServer } from 'ws';

import { parseClientMessage } from './protocol.js';
import { Room, generateRoomCode } from './rooms.js';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

/** Delete rooms this long after their last player disconnects. */
const EMPTY_ROOM_TTL_MS = 15 * 60 * 1000;
const SWEEP_INTERVAL_MS = 60 * 1000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.pdf': 'application/pdf',
  '.md': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

/**
 * Start the game server.
 *
 * @param {Object} [options]
 * @param {number} [options.port] - 0 lets the OS pick (tests)
 * @param {() => number} [options.createSeed] - room seed source; injectable so
 *   tests get deterministic games (shared RNG is seeded, PLANNING.md §3.7)
 * @returns {Promise<{port: number, rooms: Map<string, Room>, close: () => Promise<void>}>}
 */
export async function startServer({
  port = Number(process.env.PORT ?? 8080),
  createSeed = () => randomInt(2 ** 32),
} = {}) {
  /** @type {Map<string, Room>} */
  const rooms = new Map();

  const server = http.createServer((req, res) => serveStatic(req, res));
  const wss = new WebSocketServer({ server });

  wss.on('connection', (socket) => {
    /** The socket's seat, set by CREATE_ROOM / JOIN_ROOM. */
    const ctx = { room: null, playerIndex: null };
    socket.on('message', (raw) => {
      const parsed = parseClientMessage(raw);
      if (!parsed.ok) {
        socket.send(JSON.stringify({ type: 'REJECTED', reason: parsed.error }));
        return;
      }
      handleMessage(rooms, createSeed, socket, ctx, parsed.msg);
    });
    socket.on('close', () => {
      if (!ctx.room) return;
      const playerIndex = ctx.room.handleDisconnect(socket);
      if (playerIndex !== null) {
        ctx.room.sendTo(1 - playerIndex, { type: 'OPPONENT_STATUS', connected: false });
      }
    });
    socket.on('error', () => socket.terminate());
  });

  const sweeper = setInterval(() => {
    for (const [code, room] of rooms) {
      if (room.emptySince !== null && Date.now() - room.emptySince > EMPTY_ROOM_TTL_MS) {
        rooms.delete(code);
      }
    }
  }, SWEEP_INTERVAL_MS);
  sweeper.unref();

  await new Promise((res, rej) => server.listen(port).once('listening', res).once('error', rej));
  return {
    port: server.address().port,
    rooms,
    close: () =>
      new Promise((res) => {
        clearInterval(sweeper);
        for (const socket of wss.clients) socket.terminate();
        wss.close(() => server.close(res));
      }),
  };
}

/**
 * Route one well-formed client message (PLANNING.md §3.7). Every reply goes
 * through Room.sendTo / getPlayerView — full state never leaves this module.
 */
function handleMessage(rooms, createSeed, socket, ctx, msg) {
  const reject = (reason) => socket.send(JSON.stringify({ type: 'REJECTED', reason }));

  switch (msg.type) {
    case 'CREATE_ROOM': {
      if (ctx.room) return reject('already in a room');
      const code = generateRoomCode((c) => rooms.has(c));
      const room = new Room(code, createSeed());
      rooms.set(code, room);
      const { playerIndex, playerToken } = room.join(socket);
      ctx.room = room;
      ctx.playerIndex = playerIndex;
      socket.send(
        JSON.stringify({ type: 'ROOM_CREATED', roomCode: code, playerToken, playerIndex }),
      );
      room.broadcastRoomState();
      return;
    }

    case 'JOIN_ROOM': {
      if (ctx.room) return reject('already in a room');
      const room = rooms.get(msg.roomCode.trim().toUpperCase());
      if (!room) return reject('room not found');

      // A returning token re-claims its seat; otherwise take a free one.
      const rejoined = msg.playerToken ? room.rejoin(msg.playerToken, socket) : -1;
      let playerIndex;
      let playerToken;
      if (rejoined !== -1) {
        playerIndex = rejoined;
        playerToken = msg.playerToken;
      } else {
        const seat = room.join(socket);
        if (!seat) return reject('room is full');
        ({ playerIndex, playerToken } = seat);
      }
      ctx.room = room;
      ctx.playerIndex = playerIndex;

      socket.send(
        JSON.stringify({ type: 'ROOM_JOINED', roomCode: room.code, playerToken, playerIndex }),
      );
      room.broadcastRoomState();
      if (room.state) {
        if (rejoined !== -1) {
          // Refresh mid-game: restore this player's view, tell the opponent.
          room.sendTo(playerIndex, { type: 'VIEW', view: room.viewFor(playerIndex) });
          room.sendTo(1 - playerIndex, { type: 'OPPONENT_STATUS', connected: true });
        } else {
          room.broadcastViews(); // second seat filled — the game starts now
        }
      }
      return;
    }

    case 'ACTION': {
      if (!ctx.room) return reject('not in a room');
      const result = ctx.room.applyPlayerAction(ctx.playerIndex, msg.action);
      if (!result.ok) return reject(result.reason);
      ctx.room.broadcastViews();
      return;
    }

    case 'RESYNC': {
      if (!ctx.room) return reject('not in a room');
      if (!ctx.room.state) return reject('game has not started');
      ctx.room.sendTo(ctx.playerIndex, { type: 'VIEW', view: ctx.room.viewFor(ctx.playerIndex) });
      return;
    }
  }
}

/** Static files for the client, served from the repo root so /shared resolves. */
async function serveStatic(req, res) {
  try {
    let path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (path === '/') {
      // Redirect instead of rewriting so the page's relative URLs resolve
      // against /client/.
      res.writeHead(302, { location: '/client/' });
      res.end();
      return;
    }
    if (path.endsWith('/')) path += 'index.html';
    const file = resolve(join(ROOT, path));
    if (!file.startsWith(ROOT + sep)) throw new Error('outside root');
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('Not found');
  }
}

const isMain =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const { port } = await startServer();
  console.log(`Truqué server → http://localhost:${port}/`);
}
