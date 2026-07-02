import { resolveActiveGameFromPath, setActiveGame } from "./games";

// Keys that were stored un-namespaced before multi-game support. Migrated once
// into the "oot:" namespace so existing users keep their layout/session.
const LEGACY_KEYS = ["layout", "settings_string", "generator_version", "tracker_session"];

/**
 * One-time migration of pre-multi-game localStorage keys into the "oot:" namespace.
 */
function migrateLegacyStorage() {
  LEGACY_KEYS.forEach(key => {
    const legacyValue = localStorage.getItem(key);
    if (legacyValue === null) { return; }

    const namespacedKey = `oot:${key}`;
    if (localStorage.getItem(namespacedKey) === null) {
      localStorage.setItem(namespacedKey, legacyValue);
    }
    localStorage.removeItem(key);
  });
}

// Resolve the active game from the URL and migrate legacy storage BEFORE the
// rest of the app's module graph loads, since providers and some view modules
// read the active game / localStorage at import time.
setActiveGame(resolveActiveGameFromPath(window.location.pathname));
migrateLegacyStorage();
