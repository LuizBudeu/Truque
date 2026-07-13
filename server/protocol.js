/**
 * Message schemas between client and server (PLANNING.md §3.7). Shared
 * vocabulary for the server handlers and client net.js; wire format is plain
 * JSON, one message per WebSocket frame.
 *
 * Client → server:
 *   { type: 'CREATE_ROOM' }
 *   { type: 'JOIN_ROOM', roomCode, playerToken? }  // playerToken rejoins a seat
 *   { type: 'ACTION', action }                     // validated via shared/validation.js
 *   { type: 'RESYNC' }                             // full view after reconnect
 *
 * Server → client:
 *   { type: 'ROOM_CREATED', roomCode, playerToken, playerIndex }
 *   { type: 'ROOM_JOINED', roomCode, playerToken, playerIndex }
 *   { type: 'ROOM_STATE', players, status }        // players: [{connected}, ...]
 *   { type: 'VIEW', view }                         // PlayerView after every accepted action
 *   { type: 'REJECTED', reason }
 *   { type: 'OPPONENT_STATUS', connected }
 *
 * Pure module (no Node APIs) so the client can import the vocabulary too.
 */

export const CLIENT_MESSAGES = ['CREATE_ROOM', 'JOIN_ROOM', 'ACTION', 'RESYNC'];

export const SERVER_MESSAGES = [
  'ROOM_CREATED',
  'ROOM_JOINED',
  'ROOM_STATE',
  'VIEW',
  'REJECTED',
  'OPPONENT_STATUS',
];

/** Anything bigger than this is not a legitimate game message. */
export const MAX_MESSAGE_BYTES = 4096;

/**
 * Parse and shape-check one raw client frame. Game-rule legality is NOT
 * checked here — that is shared/validation.js against the room state; this
 * only guarantees the message is well-formed JSON of a known type.
 *
 * @param {string|Buffer} raw
 * @returns {{ok: true, msg: Object} | {ok: false, error: string}}
 */
export function parseClientMessage(raw) {
  if (raw.length > MAX_MESSAGE_BYTES) return invalid('message too large');
  let msg;
  try {
    msg = JSON.parse(raw.toString());
  } catch {
    return invalid('not valid JSON');
  }
  if (msg === null || typeof msg !== 'object' || Array.isArray(msg)) {
    return invalid('message must be an object');
  }
  if (!CLIENT_MESSAGES.includes(msg.type)) return invalid(`unknown message type ${msg.type}`);

  if (msg.type === 'JOIN_ROOM') {
    if (typeof msg.roomCode !== 'string') return invalid('roomCode must be a string');
    if (msg.playerToken !== undefined && typeof msg.playerToken !== 'string') {
      return invalid('playerToken must be a string');
    }
  }
  if (msg.type === 'ACTION' && (msg.action === null || typeof msg.action !== 'object')) {
    return invalid('action must be an object');
  }
  return { ok: true, msg };
}

const invalid = (error) => ({ ok: false, error });
