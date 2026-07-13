/**
 * Room lifecycle (Phase 3): create room with short join code, join, and
 * rejoin by player token after refresh/disconnect.
 *
 * Planned shape: a `Room` class (one of the few justified classes — identity
 * + lifecycle) holding the authoritative GameState, the two player slots
 * (token, socket, connected flag), and the per-room action queue that
 * serializes simultaneous picks (PLANNING.md §8).
 */

export {};
