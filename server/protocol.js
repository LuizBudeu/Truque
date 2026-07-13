/**
 * Message schemas between client and server (PLANNING.md §3.7). Shared
 * vocabulary for server handlers and client net.js; wire format is plain JSON.
 *
 * Client → server:
 *   { type: 'CREATE_ROOM' }
 *   { type: 'JOIN_ROOM', roomCode }
 *   { type: 'ACTION', action }   // validated via shared/validation.js
 *   { type: 'RESYNC' }           // full view after reconnect
 *
 * Server → client:
 *   { type: 'ROOM_CREATED', roomCode, playerToken }
 *   { type: 'ROOM_STATE', players, status }
 *   { type: 'VIEW', view }       // PlayerView after every accepted action
 *   { type: 'REJECTED', reason }
 *   { type: 'OPPONENT_STATUS', connected }
 */

export const CLIENT_MESSAGES = ['CREATE_ROOM', 'JOIN_ROOM', 'ACTION', 'RESYNC'];

export const SERVER_MESSAGES = [
  'ROOM_CREATED',
  'ROOM_STATE',
  'VIEW',
  'REJECTED',
  'OPPONENT_STATUS',
];
