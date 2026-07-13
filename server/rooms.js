/**
 * Room lifecycle: create with a short join code, join, rejoin by player
 * token after a refresh or drop (PLANNING.md §3.7).
 *
 * `Room` is one of the few justified classes (identity + lifecycle): it holds
 * the authoritative GameState, the two player slots, and pushes filtered
 * views to the sockets. All game legality goes through shared/validation.js
 * and the shared reducer — the room never implements rules. Sockets only need
 * a `send(string)` method, so tests can drive rooms with fakes or real `ws`.
 */

import { randomUUID, randomInt } from 'node:crypto';
import { createInitialState, applyAction } from '../shared/reducer.js';
import { isLegalAction } from '../shared/validation.js';
import { getPlayerView } from '../shared/views.js';

/** Unambiguous alphabet for join codes (no 0/O, 1/I/L). */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 4;

/**
 * Generate a join code not already in use.
 *
 * @param {(code: string) => boolean} isTaken
 */
export function generateRoomCode(isTaken) {
  for (;;) {
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
      code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
    }
    if (!isTaken(code)) return code;
  }
}

export class Room {
  /**
   * @param {string} code - join code
   * @param {number} seed - RNG seed for this room's game (server-chosen)
   */
  constructor(code, seed) {
    this.code = code;
    this.seed = seed;
    /** @type {{token: string, socket: ?{send: Function}, connected: boolean}[]} */
    this.players = [];
    /** @type {?import('../shared/reducer.js').GameState} */
    this.state = null;
    /** Wall-clock ms since everyone disconnected, for garbage collection. */
    this.emptySince = null;
    /** Rematch votes by seat; both true replays the game (Phase 5). */
    this.rematchVotes = [false, false];
  }

  get status() {
    return this.state ? 'PLAYING' : 'WAITING';
  }

  /**
   * Seat a new player. The game starts (state is created) when the second
   * seat fills. Returns null when the room is full.
   *
   * @returns {?{playerIndex: 0|1, playerToken: string}}
   */
  join(socket) {
    if (this.players.length >= 2) return null;
    const playerToken = randomUUID();
    this.players.push({ token: playerToken, socket, connected: true });
    this.emptySince = null;
    if (this.players.length === 2) this.state = createInitialState(this.seed);
    return { playerIndex: this.players.length - 1, playerToken };
  }

  /**
   * Re-bind a returning player's seat to a fresh socket.
   *
   * @returns {0|1|-1} the seat, or -1 when the token matches nobody
   */
  rejoin(playerToken, socket) {
    const playerIndex = this.players.findIndex((p) => p.token === playerToken);
    if (playerIndex === -1) return -1;
    const previous = this.players[playerIndex].socket;
    if (previous && previous !== socket) previous.close?.(); // stale tab
    this.players[playerIndex] = { ...this.players[playerIndex], socket, connected: true };
    this.emptySince = null;
    return playerIndex;
  }

  /**
   * Mark the seat bound to `socket` as disconnected (the seat and token are
   * kept so the player can rejoin). Returns the seat, or null when the socket
   * holds no current seat (e.g. it was already replaced by a rejoin).
   *
   * @returns {0|1|null}
   */
  handleDisconnect(socket) {
    const playerIndex = this.players.findIndex((p) => p.socket === socket);
    if (playerIndex === -1) return null;
    this.players[playerIndex] = { ...this.players[playerIndex], socket: null, connected: false };
    if (this.players.every((p) => !p.connected)) this.emptySince = Date.now();
    return playerIndex;
  }

  /**
   * Validate and apply one game action for a seated player. Illegal actions
   * never reach the reducer; the caller turns the reason into a REJECTED
   * message (PLANNING.md §3.7).
   *
   * @returns {{ok: true} | {ok: false, reason: string}}
   */
  applyPlayerAction(playerIndex, action) {
    if (!this.state) return { ok: false, reason: 'game has not started' };
    const { legal, reason } = isLegalAction(this.state, playerIndex, action);
    if (!legal) return { ok: false, reason };
    this.state = applyAction(this.state, action);
    return { ok: true };
  }

  /**
   * Record a seat's vote to replay. When both seats have voted, start a fresh
   * game (same seats and tokens, new seed) and clear the votes. Only valid once
   * the current game is over.
   *
   * @param {0|1} playerIndex
   * @param {number} seed - RNG seed for the replayed game (server-chosen)
   * @returns {{ok: false, reason: string} | {ok: true, started: boolean}}
   *   `started` is true when this vote completed the rematch (new game began).
   */
  requestRematch(playerIndex, seed) {
    if (!this.state || this.state.phase !== 'GAME_OVER') {
      return { ok: false, reason: 'game is not over' };
    }
    this.rematchVotes = this.rematchVotes.map((v, i) => (i === playerIndex ? true : v));
    if (this.rematchVotes[0] && this.rematchVotes[1]) {
      this.state = createInitialState(seed);
      this.rematchVotes = [false, false];
      return { ok: true, started: true };
    }
    return { ok: true, started: false };
  }

  viewFor(playerIndex) {
    return getPlayerView(this.state, playerIndex);
  }

  /** Send one message to one seat, if that seat is currently connected. */
  sendTo(playerIndex, message) {
    const player = this.players[playerIndex];
    if (player?.connected) player.socket.send(JSON.stringify(message));
  }

  /** Fresh filtered view to every connected seat — after every accepted action. */
  broadcastViews() {
    for (let p = 0; p < this.players.length; p++) {
      this.sendTo(p, { type: 'VIEW', view: this.viewFor(p) });
    }
  }

  broadcastRoomState() {
    const message = {
      type: 'ROOM_STATE',
      players: this.players.map((p) => ({ connected: p.connected })),
      status: this.status,
    };
    for (let p = 0; p < this.players.length; p++) this.sendTo(p, message);
  }

  /** Tell both seats who has voted for a rematch (drives the game-over UI). */
  broadcastRematchState() {
    const message = { type: 'REMATCH_STATE', requested: [...this.rematchVotes] };
    for (let p = 0; p < this.players.length; p++) this.sendTo(p, message);
  }
}
