import _ from "lodash";

import COUNTER_TO_ITEM from "./data/counter-to-item.json";
import DEFAULT_ITEMS from "./data/default-items.json";
import UUID_TO_ITEM from "./data/uuid-to-item.json";
import MMEvaluator from "./logic/evaluator";

// The REQ_CASUAL fixpoint evaluator (see mm-logic-format). Implements the shared
// engine's { updateItems, isLocationAvailable } contract over the casual graph.
export const evaluator = MMEvaluator;

/**
 * Converts UUID-based item lists and counters into a logic-compatible items object.
 * @param {object} items_list - Map of element IDs to item UUIDs.
 * @param {object} counters - Map of counter names to their values.
 * @param {Array} unchanged_starting_inventory - Starting inventory UUIDs.
 * @returns {object} Parsed items keyed by logic item name.
 */
export function parseItems(items_list, counters, unchanged_starting_inventory) {
  const items = _.cloneDeep(DEFAULT_ITEMS);

  _.forEach(_.union(_.values(items_list), unchanged_starting_inventory), uuid => {
    const mapping = UUID_TO_ITEM[uuid];
    if (!mapping) {
      console.warn(`Did not set unknown item: ${uuid}`);
      return;
    }
    const value = mapping.value ?? 1;
    // A single element can grant several logic ids (e.g. one Bottle toggle maps
    // to all six bottle container ids).
    const itemIds = mapping.items ?? [mapping.item];
    for (const itemId of itemIds) {
      items[itemId] = Math.max(items[itemId] || 0, value);
    }
  });

  _.forEach(counters, (value, counter) => {
    const itemName = COUNTER_TO_ITEM[counter];
    if (itemName) {
      items[itemName] = value;
    } else {
      console.warn(`Did not set unknown counter with value ${value}: ${counter}`);
    }
  });

  return items;
}

/**
 * Derives the starting inventory as tracked-element UUIDs to pre-own. The casual
 * starting set is seeded directly inside the evaluator (untracked ids with no
 * element), so nothing is pre-owned here yet; the extra-starting-items string
 * will pre-toggle tracked starting items in a later phase.
 * @returns {Array<string>} Starting inventory item UUIDs.
 */
export function deriveStartingInventory() {
  return [];
}

/**
 * Resolves settings for the tracker. The casual graph is bundled statically, so
 * no backend or fetch is needed; settings-string resolution arrives with check
 * tracking.
 * @returns {Promise<object>} The resolved settings.
 */
export async function initializeLogic() {
  return {};
}

/** @returns {Set<string>} Regions to exclude from reachability (none in MM). */
export function getSkipRegions() {
  return new Set();
}

/** @returns {boolean} Whether a label selection should revalidate locations (never in MM). */
export function shouldRevalidateOnLabel() {
  return false;
}

/** @returns {Array<string>} Selected dungeon names (none in MM). */
export function getSelectedDungeons() {
  return [];
}

/** @returns {object} Game-specific settings to persist (none in MM Phase A). */
export function serializeSettings() {
  return {};
}

/** Restores game-specific settings from a session snapshot (no-op in MM Phase A). */
export function restoreSettings() {}

/**
 * @param {object} locations - The locations map to rebuild.
 * @returns {object} The locations map unchanged (MM has no MQ regions).
 */
export function rebuildRestoredRegions(locations) {
  return locations;
}

export const extraActions = {};
