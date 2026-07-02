import _ from "lodash";

import { validateLocations } from "../../utils/validate-locations";
import COMBO_ITEMS from "./data/combo-items.json";
import COUNTER_TO_ITEM from "./data/counter-to-item.json";
import DEFAULT_ITEMS from "./data/default-items.json";
import DUNGEONS from "./data/dungeons.json";
import ITEMS_JSON from "./data/items.json";
import UUID_TO_ITEM from "./data/uuid-to-item.json";
import { getEFKSkipRegions, getSelectedEFKDungeons, isEFK, isEFKLabel } from "./logic/efk";
import Locations from "./logic/locations";
import LogicHelper from "./logic/logic-helper";
import LogicLoader from "./logic/logic-loader";
import SettingsHelper from "./logic/settings-helper";

// Logic evaluator the shared reducer feeds items into and queries reachability from.
export const evaluator = {
  updateItems: (items, skipRegions) => LogicHelper.updateItems(items, skipRegions),
  isLocationAvailable: locationName => LogicHelper.isLocationAvailable(locationName),
};

/**
 * Converts UUID-based item lists and counters into a logic-compatible items object.
 * @param {object} items_list - Map of element IDs to item UUIDs.
 * @param {object} counters - Map of counter names to their values.
 * @param {Array} unchanged_starting_inventory - Starting inventory UUIDs.
 * @returns {object} Parsed items keyed by logic item name.
 */
export function parseItems(items_list, counters, unchanged_starting_inventory) {
  const items = _.cloneDeep(DEFAULT_ITEMS);
  const tradeRevert = !SettingsHelper.getSetting("adult_trade_shuffle") && !SettingsHelper.getRenamedAttribute("disable_trade_revert");

  _.forEach(_.union(_.values(items_list), unchanged_starting_inventory), uuid => {
    const mapping = UUID_TO_ITEM[uuid];

    if (!mapping) {
      console.warn(`Did not set unknown item: ${uuid}`);
      return;
    }

    // Skip ignored items
    if (mapping.ignore) {
      return;
    }

    // Handle multi-items (combo items like tunics_both, boots_both)
    if (mapping.items) {
      mapping.items.forEach(itemConfig => {
        items[itemConfig.item] = itemConfig.value ?? 1;
      });
      return;
    }

    // Handle single item
    const value = mapping.value ?? 1;
    items[mapping.item] = Math.max(items[mapping.item] || 0, value);

    // Handle trade revert special cases
    if (tradeRevert && mapping.tradeRevert) {
      items[mapping.tradeRevert] = 1;
    }
  });

  // Parse counters using mapping
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
 * Derives the starting inventory (as item UUIDs) from resolved settings.
 * @param {object} settings - The resolved generator settings.
 * @returns {Array<string>} Starting inventory item UUIDs.
 */
export function deriveStartingInventory(settings) {
  const items = [...settings.starting_equipment, ...settings.starting_inventory, ...settings.starting_songs];

  const starting_inventory = items.map(item => ITEMS_JSON[item]);

  if (settings.start_with_consumables) {
    starting_inventory.push("34b2ad3657e94b75b281cec30e617f37");
    starting_inventory.push("73a0f3f5688745a8bb4a0973d9858960");
  }
  if (settings.open_door_of_time && settings.open_forest !== "closed") {
    starting_inventory.push("c50e8543ab0c4bdaa8a23e6a80ae6d1c");
  }
  if (!settings.shuffle_individual_ocarina_notes) {
    starting_inventory.push("6466793887f9475685558adbae2a4b3e");
    starting_inventory.push("5598cc877c91426ab4ec083fccb7c22b");
    starting_inventory.push("506b5e53591b430cbf45855088bfae1b");
    starting_inventory.push("9ffc29578f514202a80fa5278a3bd281");
    starting_inventory.push("2d85db579f3c4be49bf48d4853d112e7");
  }

  // Derive combo UUIDs when all component items are present so combo elements
  // can display the combined state.
  COMBO_ITEMS.forEach(({ components, combo }) => {
    const hasAllComponents = components.every(uuid => starting_inventory.includes(uuid));
    if (hasAllComponents && !starting_inventory.includes(combo)) {
      starting_inventory.push(combo);
    }
  });

  return starting_inventory;
}

/**
 * Loads logic files, initializes the logic singletons, resolves settings.
 * @param {{version: string, settingsString: string}} options - Generator version and settings string.
 * @returns {Promise<object>} The resolved settings.
 */
export async function initializeLogic({ version, settingsString }) {
  const bundle = await LogicLoader.loadLogicFiles(version, settingsString);
  const { logicHelpersFile, dungeonFiles, dungeonMQFiles, bossesFile, overworldFile } = bundle;

  SettingsHelper.initialize(bundle);
  Locations.initialize(dungeonFiles, dungeonMQFiles, bossesFile, overworldFile);

  let settings;
  if (!settingsString) {
    settings = bundle.settingsDefaults;
  } else {
    const response = await fetch(
      `${process.env.REACT_APP_API_URL}/settings/string?` +
      new URLSearchParams({ version, settingsString }),
    ).then(res => res.json());
    settings = response.settings;
  }

  SettingsHelper.setSettings(settings);
  LogicHelper.initialize(logicHelpersFile, settings);

  return settings;
}

/**
 * Region names to exclude from reachability (Escape from Kakariko lobby regions).
 * @param {string} settingsString - The active settings string.
 * @param {object} labelSelections - Current label selections.
 * @returns {Set<string>} Regions to skip.
 */
export function getSkipRegions(settingsString, labelSelections) {
  return getEFKSkipRegions(settingsString, labelSelections);
}

/**
 * Whether selecting a label should trigger location revalidation (EfK dungeon selection).
 * @param {string} name - The label name.
 * @param {string} settingsString - The active settings string.
 * @returns {boolean} True if locations should be revalidated.
 */
export function shouldRevalidateOnLabel(name, settingsString) {
  return isEFKLabel(name) && isEFK(settingsString);
}

/**
 * Resolves the currently selected EfK dungeon names from label selections.
 * @param {object} labelSelections - Current label selections.
 * @returns {Array<string>} Selected dungeon names.
 */
export function getSelectedDungeons(labelSelections) {
  return getSelectedEFKDungeons(labelSelections);
}

/**
 * Game-specific settings to persist in a session snapshot.
 * @returns {object} Serializable settings fragment.
 */
export function serializeSettings() {
  return {
    mq_dungeons_specific: SettingsHelper.settings?.mq_dungeons_specific || [],
    dungeon_shortcuts: SettingsHelper.settings?.dungeon_shortcuts || [],
  };
}

/**
 * Restores game-specific settings singletons from a session snapshot.
 * @param {object} snapshot - The session snapshot.
 */
export function restoreSettings(snapshot) {
  if (snapshot.mq_dungeons_specific) {
    _.set(LogicHelper.settings, "mq_dungeons_specific", snapshot.mq_dungeons_specific);
    SettingsHelper.settings["mq_dungeons_specific"] = snapshot.mq_dungeons_specific;
  }
  if (snapshot.dungeon_shortcuts) {
    _.set(LogicHelper.settings, "dungeon_shortcuts", snapshot.dungeon_shortcuts);
    SettingsHelper.settings["dungeon_shortcuts"] = snapshot.dungeon_shortcuts;
  }
  SettingsHelper.invalidateCachedSets();
}

/**
 * Rebuilds each dungeon region's location list to match the restored MQ setting.
 * @param {object} locations - The locations map to mutate.
 * @returns {object} The same locations map, with dungeon regions rebuilt.
 */
export function rebuildRestoredRegions(locations) {
  _.forEach(_.keys(locations), regionName => {
    if (!_.includes(DUNGEONS, regionName)) { return; }
    const locationKey = SettingsHelper.isMQDungeon(regionName) ? "dungeon_mq" : "dungeon";
    _.set(locations, regionName, {});
    _.forEach(Locations.locations[locationKey][regionName], (locationData, locationName) => {
      if (Locations.isProgressLocation(locationData)) {
        _.set(locations, [regionName, locationName], { isAvailable: false, isChecked: false });
      }
    });
  });
  return locations;
}

// Game-specific reducer actions. Each returns a partial state the shared reducer
// merges and persists.
export const extraActions = {
  MQ_TOGGLE: (state, payload) => {
    // payload = regionName
    const dungeonsMQ = LogicHelper.settings["mq_dungeons_specific"];
    let newDungeonsMQ;
    if (!_.includes(dungeonsMQ, payload)) {
      newDungeonsMQ = _.union(dungeonsMQ, [payload]);
    } else {
      newDungeonsMQ = _.filter(dungeonsMQ, dungeon => dungeon !== payload);
    }
    _.set(LogicHelper.settings, "mq_dungeons_specific", newDungeonsMQ);
    SettingsHelper.settings["mq_dungeons_specific"] = newDungeonsMQ;
    SettingsHelper.invalidateCachedSets();

    // Modify toggled dungeon to use MQ/non-MQ locations
    const locations = _.cloneDeep(state.locations);
    const locationKey = _.includes(LogicHelper.settings.mq_dungeons_specific, payload) ? "dungeon_mq" : "dungeon";
    _.set(locations, payload, {});
    _.forEach(Locations.locations[locationKey][payload], (locationData, locationName) => {
      if (Locations.isProgressLocation(locationData)) {
        _.set(locations, [payload, locationName], {
          isAvailable: LogicHelper.isLocationAvailable(locationName),
          isChecked: false,
        });
      }
    });

    const validatedLocations = validateLocations(
      locations,
      parseItems(state.items_list, state.counters, state.unchanged_starting_inventory),
      evaluator,
    );

    return { locations: validatedLocations };
  },
  SHORTCUT_TOGGLE: (state, payload) => {
    // payload = regionName
    const shortcuts = LogicHelper.settings.dungeon_shortcuts;
    let newShortcuts;
    if (!_.includes(shortcuts, payload)) {
      newShortcuts = _.union(shortcuts, [payload]);
    } else {
      newShortcuts = _.filter(shortcuts, dungeon => dungeon !== payload);
    }
    _.set(LogicHelper.settings, "dungeon_shortcuts", newShortcuts);
    SettingsHelper.settings["dungeon_shortcuts"] = newShortcuts;
    SettingsHelper.invalidateCachedSets();

    const validatedLocations = validateLocations(
      state.locations,
      parseItems(state.items_list, state.counters, state.unchanged_starting_inventory),
      evaluator,
    );

    return { locations: validatedLocations };
  },
};
