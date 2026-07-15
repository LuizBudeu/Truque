// End-to-end protocol tests over real WebSockets: the actual server from
// server/index.js on an ephemeral port, driven by `ws` clients. Includes the
// Phase 3 requirement of hidden-information leak tests over the real
// protocol: a full game where every frame a client receives is checked
// against a locally mirrored authoritative state (same seed, same reducer).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';

import { startServer } from '../server/index.js';
import { createInitialState, applyAction } from '../shared/reducer.js';
import { mulberry32 } from '../shared/cards.js';
import { dangerSpaces } from '../shared/rules.js';
import { legalActions } from './helpers.js';

/** The exact serialization of a card in a view (insertion order is rank, suit). */
const cardToken = (c) => `{"rank":${c.rank},"suit":"${c.suit}"}`;

/** State keys that must never appear in anything sent to a client. */
const FORBIDDEN_KEYS = ['"hands"', '"playDeck"', '"manilhaDeck"', '"pendingPicks"', '"rngState"'];

/** Minimal test client: buffers parsed messages and every raw frame. */
class TestClient {
  constructor(port) {
    this.ws = new WebSocket(`ws://127.0.0.1:${port}`);
    this.queue = [];
    this.waiters = [];
    this.frames = []; // every raw frame ever received, for blanket leak sweeps
    this.ws.on('message', (raw) => {
      const text = raw.toString();
      this.frames.push(text);
      const msg = JSON.parse(text);
      const waiter = this.waiters.shift();
      if (waiter) waiter(msg);
      else this.queue.push(msg);
    });
  }

  static async connect(port) {
    const client = new TestClient(port);
    await new Promise((res, rej) => client.ws.once('open', res).once('error', rej));
    return client;
  }

  send(msg) {
    this.ws.send(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }

  next(timeoutMs = 3000) {
    if (this.queue.length > 0) return Promise.resolve(this.queue.shift());
    return new Promise((res, rej) => {
      const timer = setTimeout(
        () => rej(new Error('timed out waiting for a server message')),
        timeoutMs,
      );
      this.waiters.push((msg) => {
        clearTimeout(timer);
        res(msg);
      });
    });
  }

  /** Next message of `type`, discarding others (order per socket is guaranteed). */
  async nextOfType(type) {
    for (;;) {
      const msg = await this.next();
      if (msg.type === type) return msg;
    }
  }

  close() {
    this.ws.close();
  }
}

/** Boot a server (fixed seed), create a room with client A, join with client B. */
async function startGame(t, seed = 4242, ruleset) {
  const server = await startServer({ port: 0, createSeed: () => seed });
  t.after(() => server.close());

  const a = await TestClient.connect(server.port);
  a.send({ type: 'CREATE_ROOM', ruleset });
  const created = await a.nextOfType('ROOM_CREATED');

  const b = await TestClient.connect(server.port);
  b.send({ type: 'JOIN_ROOM', roomCode: created.roomCode });
  const joined = await b.nextOfType('ROOM_JOINED');

  return { server, a, b, created, joined, roomCode: created.roomCode };
}

describe('room lifecycle', () => {
  test('create + join hands out seats and starts the game', async (t) => {
    const { a, b, created, joined } = await startGame(t);

    assert.equal(created.playerIndex, 0);
    assert.match(created.roomCode, /^[A-Z2-9]{4}$/);
    assert.ok(created.playerToken.length > 10);
    assert.equal(joined.playerIndex, 1);
    assert.equal(joined.roomCode, created.roomCode);

    const viewA = (await a.nextOfType('VIEW')).view;
    const viewB = (await b.nextOfType('VIEW')).view;
    assert.equal(viewA.playerIndex, 0);
    assert.equal(viewB.playerIndex, 1);
    assert.equal(viewA.phase, 'SWAP_WINDOW');
    assert.equal(viewA.hand.length, 4);
    assert.equal(viewB.opponentHandCount, 4);
  });

  test('join rejections: unknown code, full room, malformed frames', async (t) => {
    const { server, roomCode } = await startGame(t);

    const c = await TestClient.connect(server.port);
    c.send({ type: 'JOIN_ROOM', roomCode: 'ZZZZ' });
    assert.equal((await c.nextOfType('REJECTED')).reason, 'room not found');

    c.send({ type: 'JOIN_ROOM', roomCode });
    assert.equal((await c.nextOfType('REJECTED')).reason, 'room is full');

    // A bogus token does not steal a seat in a full room either.
    c.send({ type: 'JOIN_ROOM', roomCode, playerToken: 'not-a-real-token' });
    assert.equal((await c.nextOfType('REJECTED')).reason, 'room is full');

    c.send('this is not json');
    assert.equal((await c.nextOfType('REJECTED')).reason, 'not valid JSON');

    c.send({ type: 'HACK_THE_GIBSON' });
    assert.match((await c.nextOfType('REJECTED')).reason, /unknown message type/);
    c.close();
  });
});

describe('authoritative action handling', () => {
  test('legal actions broadcast fresh views; illegal ones are rejected', async (t) => {
    const { a, b } = await startGame(t);
    await a.nextOfType('VIEW');
    await b.nextOfType('VIEW');

    // Wrong phase: picking a card during the swap window.
    a.send({ type: 'ACTION', action: { type: 'PLAY_CARD', player: 0, card: { rank: 2, suit: 'hearts' } } });
    assert.match((await a.nextOfType('REJECTED')).reason, /not in the pick phase/);

    // Seat spoofing: client B acting as player 0.
    b.send({ type: 'ACTION', action: { type: 'SKIP_SWAP', player: 0 } });
    assert.match((await b.nextOfType('REJECTED')).reason, /does not match acting player/);

    // Legal action: both clients receive the updated view.
    a.send({ type: 'ACTION', action: { type: 'SKIP_SWAP', player: 0 } });
    const viewA = (await a.nextOfType('VIEW')).view;
    const viewB = (await b.nextOfType('VIEW')).view;
    assert.deepEqual(viewA.swapDone, [true, false]);
    assert.deepEqual(viewB.swapDone, [true, false]);
  });

  test('conceding ends the game for both clients', async (t) => {
    const { a, b } = await startGame(t);
    await a.nextOfType('VIEW');
    await b.nextOfType('VIEW');

    b.send({ type: 'ACTION', action: { type: 'CONCEDE', player: 1 } });
    for (const [client, seat] of [[a, 0], [b, 1]]) {
      const view = (await client.nextOfType('VIEW')).view;
      assert.equal(view.phase, 'GAME_OVER', `seat ${seat}`);
      assert.equal(view.winner, 0);
      assert.equal(view.concededBy, 1);
    }

    // The finished room rejects further play.
    a.send({ type: 'ACTION', action: { type: 'SKIP_SWAP', player: 0 } });
    assert.match((await a.nextOfType('REJECTED')).reason, /game is over/);
  });
});

describe('ruleset selection', () => {
  test('the creator picks the ruleset; it reaches the view and the lobby', async (t) => {
    const { a } = await startGame(t, 4242, 'v2');
    const view = (await a.nextOfType('VIEW')).view;
    assert.equal(view.ruleset, 'v2');
    assert.deepEqual(view.bounds, { min: 0, max: 11 });

    // The lobby ROOM_STATE advertises the ruleset so a joiner sees what they enter.
    const roomState = a.frames.map((f) => JSON.parse(f)).find((m) => m.type === 'ROOM_STATE');
    assert.equal(roomState.ruleset, 'v2');
  });

  test('an unknown ruleset falls back to Legacy', async (t) => {
    const { a } = await startGame(t, 4242, 'nonsense');
    assert.equal((await a.nextOfType('VIEW')).view.ruleset, 'legacy');
  });

  test('an absent ruleset defaults to Legacy', async (t) => {
    const { a } = await startGame(t, 4242);
    assert.equal((await a.nextOfType('VIEW')).view.ruleset, 'legacy');
  });
});

describe('full game over the wire (hidden-information sweep)', () => {
  // Run the whole sweep under each ruleset: V2 exercises the shrinking board and
  // the dynamic-magic modifier over the real protocol, and must leak nothing either.
  for (const ruleset of ['legacy', 'v2']) {
    test(`every ${ruleset} frame matches the mirrored state and leaks nothing hidden`, async (t) => {
      const seed = 4242;
      const { a, b } = await startGame(t, seed, ruleset);
      const clients = [a, b];

      // Mirror the authoritative state locally: same seed, same ruleset, same reducer.
      let shadow = createInitialState(seed, { ruleset });
      await a.nextOfType('VIEW');
      await b.nextOfType('VIEW');

      const rng = mulberry32(seed ^ 0x9e3779b9);
      let steps = 0;
      while (shadow.winner === null && steps < 5000) {
        const actions = legalActions(shadow);
        const action = actions[Math.floor(rng() * actions.length)];
        clients[action.player].send({ type: 'ACTION', action });
        shadow = applyAction(shadow, action);

        const danger = dangerSpaces(shadow.bounds);
        const endangered = [0, 1].map((p) => shadow.positions[p] === danger[p]);
        const openPlay = shadow.phase === 'PICK_CARDS' && endangered[0] !== endangered[1];
        const openPlayer = endangered[0] ? 1 : 0;

        for (const p of [0, 1]) {
          const view = (await clients[p].nextOfType('VIEW')).view;
          // No drift: the wire view mirrors the local reducer's public state.
          assert.equal(view.playerIndex, p);
          assert.equal(view.phase, shadow.phase, `phase drift at step ${steps}`);
          assert.equal(view.ruleset, ruleset, `ruleset drift at step ${steps}`);
          assert.deepEqual(view.positions, shadow.positions, `position drift at step ${steps}`);
          assert.deepEqual(view.bounds, shadow.bounds, `bounds drift at step ${steps}`);

          // No leaks: opponent hidden cards never serialize to this client.
          const json = JSON.stringify(view);
          const opponent = 1 - p;
          for (const card of shadow.hands[opponent]) {
            assert.ok(
              !json.includes(cardToken(card)),
              `opponent hand card leaked to player ${p} at step ${steps} (phase ${shadow.phase})`,
            );
          }
          const opponentPick = shadow.pendingPicks[opponent];
          if (opponentPick && !(openPlay && opponent === openPlayer)) {
            assert.ok(
              !json.includes(cardToken(opponentPick)),
              `secret pick leaked to player ${p} at step ${steps}`,
            );
          }
        }
        steps++;
      }

      assert.notEqual(shadow.winner, null, 'game should finish');
      const finalA = a.frames.at(-1);
      assert.ok(finalA.includes('"GAME_OVER"'));

      // Blanket sweep: no frame of the entire session ever carried a raw state key.
      for (const client of clients) {
        for (const frame of client.frames) {
          for (const key of FORBIDDEN_KEYS) {
            assert.ok(!frame.includes(key), `frame leaked state key ${key}: ${frame.slice(0, 120)}`);
          }
        }
      }
    });
  }
});

describe('reconnection', () => {
  test('a dropped player rejoins by token and gets a fresh view', async (t) => {
    const { server, a, b, joined, roomCode } = await startGame(t);
    await a.nextOfType('VIEW');
    await b.nextOfType('VIEW');

    // Advance to PICK_CARDS so the restored view is mid-round.
    a.send({ type: 'ACTION', action: { type: 'SKIP_SWAP', player: 0 } });
    b.send({ type: 'ACTION', action: { type: 'SKIP_SWAP', player: 1 } });
    await a.nextOfType('VIEW');
    let viewB = (await b.nextOfType('VIEW')).view;
    viewB = (await b.nextOfType('VIEW')).view;
    assert.equal(viewB.phase, 'PICK_CARDS');
    const handBefore = viewB.hand;

    b.close();
    const status = await a.nextOfType('OPPONENT_STATUS');
    assert.equal(status.connected, false);

    // Refresh: a brand-new socket reclaims seat 1 with the stored token.
    const b2 = await TestClient.connect(server.port);
    b2.send({ type: 'JOIN_ROOM', roomCode, playerToken: joined.playerToken });
    const rejoined = await b2.nextOfType('ROOM_JOINED');
    assert.equal(rejoined.playerIndex, 1);
    assert.equal(rejoined.playerToken, joined.playerToken);

    const restored = (await b2.nextOfType('VIEW')).view;
    assert.equal(restored.phase, 'PICK_CARDS');
    assert.deepEqual(restored.hand, handBefore);

    const back = await a.nextOfType('OPPONENT_STATUS');
    assert.equal(back.connected, true);

    // RESYNC returns the same view on demand.
    b2.send({ type: 'RESYNC' });
    const resynced = (await b2.nextOfType('VIEW')).view;
    assert.deepEqual(resynced, restored);

    // ...and the rejoined seat can still act.
    b2.send({ type: 'ACTION', action: { type: 'PLAY_CARD', player: 1, card: restored.hand[0] } });
    const after = (await b2.nextOfType('VIEW')).view;
    assert.equal(after.selfCommitted, true);
  });
});

describe('rematch', () => {
  test('both votes replay the game with the same seats', async (t) => {
    const { a, b } = await startGame(t);
    await a.nextOfType('VIEW');
    await b.nextOfType('VIEW');

    // End the game so a rematch becomes legal.
    b.send({ type: 'ACTION', action: { type: 'CONCEDE', player: 1 } });
    assert.equal((await a.nextOfType('VIEW')).view.phase, 'GAME_OVER');
    assert.equal((await b.nextOfType('VIEW')).view.phase, 'GAME_OVER');

    // One vote just broadcasts the pending state; no new game yet.
    a.send({ type: 'REQUEST_REMATCH' });
    assert.deepEqual((await a.nextOfType('REMATCH_STATE')).requested, [true, false]);
    assert.deepEqual((await b.nextOfType('REMATCH_STATE')).requested, [true, false]);

    // The second vote starts a fresh game for both seats.
    b.send({ type: 'REQUEST_REMATCH' });
    assert.deepEqual((await b.nextOfType('REMATCH_STATE')).requested, [false, false]);
    const replayA = (await a.nextOfType('VIEW')).view;
    const replayB = (await b.nextOfType('VIEW')).view;
    assert.equal(replayA.phase, 'SWAP_WINDOW');
    assert.equal(replayA.round, 1);
    assert.equal(replayA.playerIndex, 0);
    assert.equal(replayB.playerIndex, 1);
    assert.equal(replayA.winner, null);
  });

  test('a rematch keeps the room ruleset', async (t) => {
    const { a, b } = await startGame(t, 4242, 'v2');
    assert.equal((await a.nextOfType('VIEW')).view.ruleset, 'v2');
    await b.nextOfType('VIEW');

    b.send({ type: 'ACTION', action: { type: 'CONCEDE', player: 1 } });
    await a.nextOfType('VIEW');
    await b.nextOfType('VIEW');
    a.send({ type: 'REQUEST_REMATCH' });
    await a.nextOfType('REMATCH_STATE');
    await b.nextOfType('REMATCH_STATE');
    b.send({ type: 'REQUEST_REMATCH' });
    await b.nextOfType('REMATCH_STATE');

    const replay = (await a.nextOfType('VIEW')).view;
    assert.equal(replay.round, 1);
    assert.equal(replay.ruleset, 'v2', 'the replayed game must keep V2');
    assert.deepEqual(replay.bounds, { min: 0, max: 11 });
  });

  test('a rematch before the game is over is rejected', async (t) => {
    const { a, b } = await startGame(t);
    await a.nextOfType('VIEW');
    await b.nextOfType('VIEW');

    a.send({ type: 'REQUEST_REMATCH' });
    assert.equal((await a.nextOfType('REJECTED')).reason, 'game is not over');
  });
});

describe('static file serving', () => {
  test('serves the client over the same port as the WebSocket', async (t) => {
    const server = await startServer({ port: 0 });
    t.after(() => server.close());
    const base = `http://127.0.0.1:${server.port}`;

    const root = await fetch(`${base}/`, { redirect: 'manual' });
    assert.equal(root.status, 302);
    assert.equal(root.headers.get('location'), '/client/');

    const page = await fetch(`${base}/client/`);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /Truqué/);

    const escape = await fetch(`${base}/../etc/passwd`);
    assert.equal(escape.status, 404);
  });
});
