import mmAdapter from "./mm";
import ootAdapter from "./oot";

// Registry of available game adapters, keyed by id.
const GAMES = { oot: ootAdapter, mm: mmAdapter };

let activeGameId = "oot";

const PUBLIC_URL = process.env.PUBLIC_URL || "";

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
 * All registered game adapters.
 * @returns {Array<object>} The registered adapters.
 */
export function listGames() {
  return Object.values(GAMES);
}

/**
 * Resolves which game a pathname belongs to via its route prefix (basePath).
 * Longest matching prefix wins; falls back to "oot" (root).
 * @param {string} pathname - A URL pathname (e.g. window.location.pathname).
 * @returns {string} The resolved game id.
 */
export function resolveActiveGameFromPath(pathname) {
  let path = pathname || "/";
  if (PUBLIC_URL && path.startsWith(PUBLIC_URL)) {
    path = path.slice(PUBLIC_URL.length);
  }
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }

  const match = Object.values(GAMES)
    .filter(game => game.basePath)
    .sort((a, b) => b.basePath.length - a.basePath.length)
    .find(game => path === game.basePath || path.startsWith(`${game.basePath}/`));

  return match ? match.id : "oot";
}

/**
 * Router basename for the active game (PUBLIC_URL + the game's route prefix).
 * @returns {string} The basename to pass to BrowserRouter.
 */
export function gameBasename() {
  return `${PUBLIC_URL}${getActiveGame().basePath}`;
}

/**
 * Builds an absolute app URL under the active game's route prefix.
 * @param {string} path - An app-relative path (e.g. "/tracker").
 * @returns {string} The prefixed URL.
 */
export function gameUrl(path) {
  return `${PUBLIC_URL}${getActiveGame().basePath}${path}`;
}

/**
 * Namespaces a localStorage key by the active game so games don't collide.
 * @param {string} key - The base storage key.
 * @returns {string} The namespaced key (e.g. "oot:layout").
 */
export function gameKey(key) {
  return `${getActiveGame().id}:${key}`;
}

/**
 * Base URL for the active game's icons in the public folder.
 * @returns {string} The icon base URL (no trailing slash).
 */
export function iconBaseUrl() {
  const game = getActiveGame();
  return `${PUBLIC_URL}/icons/${game.iconGameId || game.id}`;
}
