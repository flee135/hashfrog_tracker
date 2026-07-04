import _ from "lodash";

import COUNTER_TO_ITEM from "./data/counter-to-item.json";
import DEFAULT_ITEMS from "./data/default-items.json";
import STARTING_ITEM_IDS from "./data/starting-item-ids.json";
import UUID_TO_ITEM from "./data/uuid-to-item.json";
import { splitChecksStrings } from "../checks-string";
import { decodeLocationString } from "./logic/checks";
import MMEvaluator from "./logic/evaluator";

// Reverse of UUID_TO_ITEM: logic item id -> tracked-element UUID. A single
// element can grant several ids (the bottle element covers all six bottle ids),
// so each id in a multi-id entry points back to that one element UUID.
const ITEM_ID_TO_UUID = {};
for (const [uuid, mapping] of Object.entries(UUID_TO_ITEM)) {
  for (const itemId of mapping.items ?? [mapping.item]) {
    ITEM_ID_TO_UUID[itemId] = uuid;
  }
}

// The REQ_CASUAL fixpoint evaluator (see mm-logic-format). Implements the shared
// engine's { updateItems, isLocationAvailable } contract over the casual graph.
export const evaluator = MMEvaluator;

// Logic ids the seed starts with, decoded from the CustomStartingItemListString.
// Unlike deriveStartingInventory (which returns only tracked-element UUIDs for
// icon marking), this holds ALL decoded ids -- including untracked ones the logic
// gates on (Ocarina, Song of Soaring, sword/quiver/wallet upgrades, stray fairies)
// -- so parseItems can seed them and the evaluator assumes the real inventory.
// Set once per page load in initializeLogic, before any parseItems runs.
let STARTING_ITEM_SEED = [];

/**
 * Decodes the CustomStartingItemListString into its full set of logic item ids.
 * @param {string} [startingItemsString] - The generator's starting-items bitfield.
 * @returns {Array<string>} Decoded logic item ids (empty when the string is blank).
 */
function decodeStartingItems(startingItemsString) {
  return startingItemsString ? [...decodeLocationString(startingItemsString, STARTING_ITEM_IDS)] : [];
}

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

  // Seed the seed's starting inventory into the logic, including items that have
  // no tracked element (so possession-gated ids like Ocarina are assumed held).
  for (const itemId of STARTING_ITEM_SEED) {
    items[itemId] = Math.max(items[itemId] || 0, 1);
  }

  return items;
}

/**
 * Derives the starting inventory as tracked-element UUIDs to pre-own, by decoding
 * the generator's CustomStartingItemListString. Only starting items with a tracked
 * element are returned (for icon marking); untracked ones -- Ocarina, maps, tingle
 * maps -- have no element, and are instead seeded into the logic by parseItems.
 * @param {object} settings - Resolved settings carrying startingItemsString.
 * @returns {Array<string>} Starting inventory element UUIDs.
 */
export function deriveStartingInventory(settings) {
  const uuids = new Set();
  for (const itemId of decodeStartingItems(settings?.startingItemsString)) {
    const uuid = ITEM_ID_TO_UUID[itemId];
    if (uuid) {
      uuids.add(uuid);
    }
  }
  return [...uuids];
}

/**
 * Resolves settings for the tracker. The casual graph is bundled statically, so
 * no backend or fetch is needed; decoding the starting-items string here fixes the
 * logic seed (STARTING_ITEM_SEED) before any parseItems runs, and passes the
 * string through for deriveStartingInventory to map to tracked elements.
 * @param {{settingsString?: string, startingItemsString?: string}} [options] - Launcher-provided strings.
 * @returns {Promise<object>} The resolved settings.
 */
export async function initializeLogic({ settingsString, startingItemsString } = {}) {
  STARTING_ITEM_SEED = decodeStartingItems(startingItemsString);
  // Restrict the evaluator's possession-gating to the seed's shuffled locations so
  // unshuffled ones (a vanilla stray fairy, seahorse) propagate transitively. This
  // is the item-list set alone -- NOT minus enforce-junk: a force-junked location
  // still holds junk rather than its vanilla item, so its item was shuffled out and
  // must be possession-gated. A blank string leaves the default (all shuffleable
  // items gated); the Checks tab is empty then anyway.
  const [itemListString] = splitChecksStrings(settingsString || "", 2);
  if (itemListString) {
    MMEvaluator.setShuffledLocations(decodeLocationString(itemListString));
  }
  return { startingItemsString };
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
