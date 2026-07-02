import ootAdapter from "./oot";

// Registry of available game adapters, keyed by id.
const GAMES = { oot: ootAdapter };

let activeGameId = "oot";

/**
 * Returns the currently active game adapter.
 * @returns {object} The active game adapter.
 */
export function getActiveGame() {
  return GAMES[activeGameId];
}

/**
 * Sets the active game by id (no-op for unknown ids).
 * @param {string} id - The game id to activate.
 */
export function setActiveGame(id) {
  if (GAMES[id]) {
    activeGameId = id;
  }
}

/**
 * Base URL for the active game's icons in the public folder.
 * @returns {string} The icon base URL (no trailing slash).
 */
export function iconBaseUrl() {
  return `${process.env.PUBLIC_URL}/icons/${getActiveGame().id}`;
}
