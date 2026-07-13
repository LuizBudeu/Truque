/**
 * WebSocket wrapper: connect, send, auto-reconnect with backoff. Speaks the
 * JSON message schemas in server/protocol.js. Reconnect only re-opens the
 * socket — re-claiming the seat (JOIN_ROOM with the stored playerToken) is
 * main.js's job via the onOpen callback, so this module stays a dumb pipe.
 */

const BASE_RETRY_MS = 500;
const MAX_RETRY_MS = 8000;

/**
 * Open a managed connection.
 *
 * @param {Object} options
 * @param {string} options.url - ws:// or wss:// endpoint
 * @param {(msg: Object) => void} options.onMessage - each parsed server message
 * @param {() => void} options.onOpen - fires on every (re)connect
 * @param {(status: 'connecting'|'open'|'closed') => void} options.onStatus
 * @returns {{send: (msg: Object) => boolean, close: () => void}}
 */
export function createConnection({ url, onMessage, onOpen, onStatus }) {
  let socket = null;
  let attempts = 0;
  let closed = false; // intentional close — stop reconnecting
  let retryTimer = null;

  function connect() {
    onStatus('connecting');
    socket = new WebSocket(url);
    socket.addEventListener('open', () => {
      attempts = 0;
      onStatus('open');
      onOpen();
    });
    socket.addEventListener('message', (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return; // not ours; ignore
      }
      onMessage(msg);
    });
    socket.addEventListener('close', () => {
      if (closed) return;
      onStatus('closed');
      const delay = Math.min(BASE_RETRY_MS * 2 ** attempts, MAX_RETRY_MS);
      attempts += 1;
      retryTimer = setTimeout(connect, delay);
    });
  }

  connect();

  return {
    /** Send one message; false when the socket is not open (caller may ignore — a reconnect resyncs). */
    send(msg) {
      if (socket?.readyState !== WebSocket.OPEN) return false;
      socket.send(JSON.stringify(msg));
      return true;
    },
    close() {
      closed = true;
      clearTimeout(retryTimer);
      socket?.close();
    },
  };
}
