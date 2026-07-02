import _ from "lodash";
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from "react";

import { getActiveGame } from "../games";
import { validateLocations as evaluateLocations } from "../utils/validate-locations";

const GENERATOR_VERSION = process.env.REACT_APP_GENERATOR_VERSION;

const TrackerContext = createContext();

/**
 * Converts UUID-based item lists and counters into a logic-compatible items object.
 * Delegates to the active game's item parser.
 * @param {object} items_list - Map of element IDs to item UUIDs.
 * @param {object} counters - Map of counter names to their values.
 * @param {Array} unchanged_starting_inventory - Starting inventory UUIDs.
 * @returns {object} Parsed items keyed by logic item name.
 */
function parseItems(items_list, counters, unchanged_starting_inventory) {
  return getActiveGame().parseItems(items_list, counters, unchanged_starting_inventory);
}

/**
 * Revalidates location availability based on current items using the active game's evaluator.
 * @param {object} locations - Map of region names to location data.
 * @param {object} parsedItems - Parsed items from parseItems.
 * @param {Set<string>} [skipRegions] - Lobby region names to exclude from traversal.
 * @returns {object} Cloned locations with updated isAvailable flags.
 */
function validateLocations(locations, parsedItems, skipRegions = new Set()) {
  return evaluateLocations(locations, parsedItems, getActiveGame().evaluator, skipRegions);
}

/**
 * Retrieves the cached settings string from localStorage.
 * @returns {string} The cached settings string, or empty string.
 */
function getSettingsStringCache() {
  // Return empty string if no cached value
  return localStorage.getItem("settings_string") || "";
}

/**
 * Persists the settings string to localStorage.
 * @param {string} string - The settings string to cache.
 */
function setSettingsStringCache(string) {
  localStorage.setItem("settings_string", string);
}

/**
 * Retrieves the cached generator version from localStorage.
 * @returns {string} The cached version, or the default from env.
 */
function getGeneratorVersionCache() {
  let version = localStorage.getItem("generator_version");
  if (!version) {
    // Coming from .env and using it as default
    version = GENERATOR_VERSION;
  }
  return version;
}

/**
 * Persists the generator version to localStorage.
 * @param {string} version - The generator version string.
 */
function setGeneratorVersionCache(version) {
  localStorage.setItem("generator_version", version);
}

// localStorage key for a persisted tracker session (single slot).
const SESSION_KEY = "tracker_session";

/**
 * Builds a serializable snapshot of user progress from the tracker state.
 * @param {object} state - The current tracker state.
 * @returns {object} A snapshot suitable for JSON serialization.
 */
function buildSnapshot(state) {
  const checkedLocations = {};
  _.forEach(state.locations, (locations, regionName) => {
    const checkedNames = _.keys(_.pickBy(locations, location => location.isChecked));
    if (checkedNames.length) {
      checkedLocations[regionName] = checkedNames;
    }
  });

  return {
    // Whether this was a check-tracking session, so Resume opens the right route/size.
    checksEnabled: !_.isEmpty(state.locations),
    // The layout active at save time, used to detect layout changes before resuming.
    layout: localStorage.getItem("layout"),
    // Game-specific settings that live in the logic singletons, not in reducer state.
    ...getActiveGame().serializeSettings(),
    settings_string: state.settings_string,
    generator_version: state.generator_version,
    items_list: state.items_list,
    counters: state.counters,
    labelSelections: state.labelSelections,
    hintEntries: state.hintEntries,
    draggedIcons: state.draggedIcons,
    starting_item_claims: state.starting_item_claims,
    unchanged_starting_inventory: state.unchanged_starting_inventory,
    checkedLocations,
  };
}

/**
 * Persists a snapshot of the tracker state to localStorage.
 * @param {object} state - The current tracker state.
 */
function saveSession(state) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(buildSnapshot(state)));
  } catch (err) {
    console.warn("Failed to save tracker session:", err);
  }
}

/**
 * Loads the persisted session snapshot, if one exists and is parseable.
 * @returns {object|null} The snapshot, or null when absent/corrupt.
 */
function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) { return null; }
    const snapshot = JSON.parse(raw);
    if (!snapshot || typeof snapshot !== "object") { return null; }
    return snapshot;
  } catch (err) {
    console.warn("Failed to load tracker session:", err);
    return null;
  }
}

/**
 * Tracker context reducer handling all state mutations.
 * @param {object} state - The current tracker state.
 * @param {object} action - The dispatched action with type and payload.
 * @returns {object} The new tracker state.
 */
function reducer(state, action) {
  const { payload } = action;
  switch (action.type) {
    case "LOCATION_ADD": {
      const { locationName, regionName } = payload;

      // Adds location to location list
      const locations = _.cloneDeep(state.locations);

      if (_.isEmpty(locationName)) {
        _.set(locations, regionName, {});
      } else {
        _.set(locations, [regionName, locationName], {
          isAvailable: getActiveGame().evaluator.isLocationAvailable(locationName),
          isChecked: false,
        });
      }

      return {
        ...state,
        locations,
      };
    }
    case "LOCATION_MARK": {
      const { locationName, regionName } = payload;

      // Toggles location in location list
      if (!_.includes(_.keys(state.locations), regionName)) {
        console.warn(`Unable to mark location "${locationName}": "${regionName}" is not in state.locations`);
        return state;
      } else if (!_.includes(_.keys(state.locations[regionName]), locationName)) {
        console.warn(`Unable to mark location "${locationName}": location is not in state.locations["${regionName}"]`);
        return state;
      } else {
        const locations = _.cloneDeep(state.locations);
        const isChecked = locations[regionName][locationName].isChecked;
        _.set(locations, [regionName, locationName, "isChecked"], !isChecked);

        const newState = {
          ...state,
          locations,
        };
        saveSession(newState);
        return newState;
      }
    }
    case "REGION_TOGGLE": {
      // payload = regionName

      // Toggles all locations in the region
      // If at least one location is checked, then checks all locations. Otherwise, unchecks all locations.
      const locations = _.cloneDeep(state.locations);
      const setTo = _.every(_.values(locations[payload]), value => value.isChecked);
      _.forEach(_.values(locations[payload]), locationData => {
        _.set(locationData, "isChecked", !setTo);
      });

      const newState = {
        ...state,
        locations,
      };
      saveSession(newState);
      return newState;
    }
    case "ITEMS_UPDATE_FROM_LOGIC": {
      const settings = payload;

      const starting_inventory = getActiveGame().deriveStartingInventory(settings);

      // `starting_inventory` will be properly set through `useElement` hook
      const items_list = {};
      for (let i = 0; i < starting_inventory.length; i++) {
        _.set(items_list, i, starting_inventory[i]);
      }

      const parsedItems = parseItems(items_list, [], starting_inventory);

      // Validating checks based on items collected
      const locations = validateLocations(state.locations, parsedItems);

      return {
        ...state,
        locations,
        items: parsedItems,
        starting_inventory,
        unchanged_starting_inventory: _.cloneDeep(starting_inventory),
        items_list: {},
        starting_item_claims: {},
      };
    }
    case "COUNTER_MARK": {
      const { value, item } = payload;

      // Update changed counter value
      const counters = _.set(_.cloneDeep(state.counters), item, value);

      // Prepping collecting items with counters
      const parsedItems = parseItems(state.items_list, counters, state.unchanged_starting_inventory);

      // Skip expensive location validation if items didn't actually change
      const locations = _.isEqual(parsedItems, state.items)
        ? state.locations
        : validateLocations(state.locations, parsedItems, getActiveGame().getSkipRegions(state.settings_string, state.labelSelections));

      const newState = {
        ...state,
        locations,
        items: parsedItems,
        counters,
      };
      saveSession(newState);
      return newState;
    }
    case "ITEM_MARK": {
      const { item, parentID } = payload;

      // Prepping collecting items
      const items_list = _.cloneDeep(state.items_list);
      if (_.isNull(item)) {
        delete items_list[parentID];
      } else {
        _.set(items_list, parentID, item);
      }

      const parsedItems = parseItems(items_list, state.counters, state.unchanged_starting_inventory);

      // Skip expensive location validation if items didn't actually change
      const locations = _.isEqual(parsedItems, state.items)
        ? state.locations
        : validateLocations(state.locations, parsedItems, getActiveGame().getSkipRegions(state.settings_string, state.labelSelections));

      const newState = {
        ...state,
        locations,
        items: parsedItems,
        items_list,
      };
      saveSession(newState);
      return newState;
    }
    case "STRING_SET": {
      setSettingsStringCache(payload);
      return {
        ...state,
        settings_string: payload,
      };
    }
    case "VERSION_SET": {
      setGeneratorVersionCache(payload);
      return {
        ...state,
        generator_version: payload,
      };
    }
    case "LABEL_SELECT": {
      const { elementId, name, value } = payload;
      const newLabelSelections = { ...state.labelSelections, [elementId]: { name, value } };

      let newState = { ...state, labelSelections: newLabelSelections };
      if (getActiveGame().shouldRevalidateOnLabel(name, state.settings_string)) {
        // Accessible dungeons changed; revalidate locations against the updated skip regions.
        const locations = validateLocations(
          state.locations,
          state.items,
          getActiveGame().getSkipRegions(state.settings_string, newLabelSelections),
        );
        newState = { ...newState, locations };
      }

      saveSession(newState);
      return newState;
    }
    case "HINT_ENTRY": {
      const { id, value } = payload;
      const newHintEntries = { ...state.hintEntries };
      if (value) {
        newHintEntries[id] = value;
      } else {
        delete newHintEntries[id];
      }

      const newState = { ...state, hintEntries: newHintEntries };
      saveSession(newState);
      return newState;
    }
    case "DRAGGED_ICON_SET": {
      const { id, iconName } = payload;
      const newDraggedIcons = { ...state.draggedIcons };
      if (iconName) {
        newDraggedIcons[id] = iconName;
      } else {
        delete newDraggedIcons[id];
      }

      const newState = { ...state, draggedIcons: newDraggedIcons };
      saveSession(newState);
      return newState;
    }
    case "ICON_CACHE_SET": {
      const { iconUrlByName, iconNameByUrl } = payload;
      return { ...state, iconUrlByName, iconNameByUrl };
    }
    case "ELEMENT_REGISTER": {
      const { id, startingItem } = payload;

      // Skip if already registered
      if (state.layoutElements.includes(id)) {
        return state;
      }

      const newLayoutElements = [...state.layoutElements, id];
      const newItemsList = { ...state.items_list };
      let newUnchangedStartingInventory = [...state.unchanged_starting_inventory];
      const newStartingItemClaims = { ...state.starting_item_claims };

      if (startingItem !== null && newItemsList[id] === undefined) {
        newItemsList[id] = startingItem;

        // Note that starting item appears on the tracker layout
        const idx = newUnchangedStartingInventory.indexOf(startingItem);
        if (idx !== -1) {
          newUnchangedStartingInventory = [
            ...newUnchangedStartingInventory.slice(0, idx),
            ...newUnchangedStartingInventory.slice(idx + 1),
          ];

          // Track that this element claimed this starting item
          newStartingItemClaims[id] = startingItem;
        }
      }

      return {
        ...state,
        layoutElements: newLayoutElements,
        items_list: newItemsList,
        unchanged_starting_inventory: newUnchangedStartingInventory,
        starting_item_claims: newStartingItemClaims,
      };
    }
    case "SESSION_RESTORE": {
      const snapshot = payload;
      if (!snapshot) { return state; }

      const items_list = snapshot.items_list || {};
      const counters = snapshot.counters || {};
      const labelSelections = snapshot.labelSelections || {};
      const hintEntries = snapshot.hintEntries || {};
      const draggedIcons = snapshot.draggedIcons || {};
      const starting_item_claims = snapshot.starting_item_claims || {};
      const unchanged_starting_inventory = snapshot.unchanged_starting_inventory || [];

      getActiveGame().restoreSettings(snapshot);

      const locations = _.cloneDeep(state.locations);

      // Rebuild game-specific region location lists to match the restored settings.
      getActiveGame().rebuildRestoredRegions(locations);

      _.forEach(snapshot.checkedLocations || {}, (locationNames, regionName) => {
        if (!locations[regionName]) { return; }
        locationNames.forEach(locationName => {
          if (locations[regionName][locationName]) {
            _.set(locations, [regionName, locationName, "isChecked"], true);
          }
        });
      });

      const settingsString = snapshot.settings_string || state.settings_string;
      const skipRegions = getActiveGame().getSkipRegions(settingsString, labelSelections);

      const parsedItems = parseItems(items_list, counters, unchanged_starting_inventory);
      const validatedLocations = validateLocations(locations, parsedItems, skipRegions);

      return {
        ...state,
        locations: validatedLocations,
        items: parsedItems,
        items_list,
        counters,
        labelSelections,
        hintEntries,
        draggedIcons,
        starting_item_claims,
        unchanged_starting_inventory,
      };
    }
    default: {
      // Game-specific actions (e.g. OoT MQ/shortcut toggles) live on the active adapter.
      const handler = getActiveGame().extraActions?.[action.type];
      if (handler) {
        const newState = { ...state, ...handler(state, payload) };
        saveSession(newState);
        return newState;
      }
      throw new Error();
    }
  }
}

/**
 * Provides tracker state and dispatch to child components.
 * @param {object} props - React component props.
 * @returns {object} The context provider.
 */
function TrackerProvider(props) {
  const initialState = {
    locations: {},
    items: _.cloneDeep(getActiveGame().defaultItems),
    counters: {},
    starting_inventory: [],
    unchanged_starting_inventory: [],
    items_list: {},
    layoutElements: [],
    starting_item_claims: {}, // { elementId: uuid } - tracks which element claimed which starting item
    settings_string: getSettingsStringCache(),
    generator_version: getGeneratorVersionCache(),
    labelSelections: {}, // { elementId: { name, value } } - e.g. { 1: {"efk_dungeon", "DEK"} }
    hintEntries: {}, // { selectId: "hint string" } - text typed into hint inputs
    draggedIcons: {}, // { elementId: iconName } - stable name of the icon shown on a receiver
    iconUrlByName: {}, // { iconName: blobUrl } - this session's icon cache (name -> url)
    iconNameByUrl: {}, // { blobUrl: iconName } - reverse of iconUrlByName (url -> name)
  };

  const [state, dispatch] = useReducer(reducer, initialState);

  return <TrackerContext.Provider value={{ state, dispatch }} {...props} />;
}

const useTracker = () => useContext(TrackerContext);

const useChecks = () => {
  const {
    state: { locations, items },
  } = useTracker();

  return {
    locations,
    items,
  };
};

const useElement = (id, startingItem) => {
  const {
    state: { layoutElements },
    dispatch,
  } = useTracker();

  useEffect(() => {
    if (!layoutElements.includes(id)) {
      dispatch({ type: "ELEMENT_REGISTER", payload: { id, startingItem } });
    }
  }, [id, startingItem, layoutElements, dispatch]);
};

const useLocation = () => {
  const { dispatch } = useTracker();

  const actions = useMemo(
    () => ({
      addLocation: (locationName, regionName, items) =>
        dispatch({ type: "LOCATION_ADD", payload: { locationName, regionName, items } }),
      markLocation: (locationName, regionName) =>
        dispatch({ type: "LOCATION_MARK", payload: { locationName, regionName } }),
      toggleMQ: regionName => dispatch({ type: "MQ_TOGGLE", payload: regionName }),
      toggleShortcut: regionName => dispatch({ type: "SHORTCUT_TOGGLE", payload: regionName }),
      toggleRegion: regionName => dispatch({ type: "REGION_TOGGLE", payload: regionName }),
    }),
    [dispatch],
  );

  return [actions];
};

const useItems = (items, elementId = null, name = null) => {
  const { state, dispatch } = useTracker();

  const actions = useMemo(
    () => ({
      markCounter: (value, item) => dispatch({ type: "COUNTER_MARK", payload: { value, item } }),
      markItem: (item, parentID) => dispatch({ type: "ITEM_MARK", payload: { item, parentID } }),
      updateItemsFromLogic: settings => dispatch({ type: "ITEMS_UPDATE_FROM_LOGIC", payload: settings }),
    }),
    [dispatch],
  );

  const startingIndex = useMemo(() => {
    // Loops through the items of the element,
    // searching for a match against the items in the tracker context.
    // Returns the highest matching index to prefer combo states.
    let itemIndex = 0;
    if (!items || !items.length) { return 0; }
    for (let i = 0; i < items.length; i++) {
      const itemUuid = items[i];
      if (!itemUuid) { continue; }

      // Check if this element already claimed this starting item
      const elementClaimedItem = elementId && state.starting_item_claims[elementId] === itemUuid;

      // Check if the item is still available to claim
      const itemAvailableToClaim = _.includes(state.unchanged_starting_inventory, itemUuid);

      if (elementClaimedItem || itemAvailableToClaim) {
        itemIndex = i;
      }
    }
    return itemIndex;
  }, [items, state.unchanged_starting_inventory, state.starting_item_claims, elementId]);

  const startingItem = useMemo(() => {
    let itemID = null;
    if (!items || !items.length) { return null; }
    for (let i = 0; i < items.length; i++) {
      const itemUuid = items[i];
      if (!itemUuid) { continue; }

      // Check if this element already claimed this starting item
      const elementClaimedItem = elementId && state.starting_item_claims[elementId] === itemUuid;

      // Check if the item is still available to claim
      const itemAvailableToClaim = _.includes(state.unchanged_starting_inventory, itemUuid);

      if (elementClaimedItem || itemAvailableToClaim) {
        itemID = itemUuid;
      }
    }
    return itemID;
  }, [items, state.unchanged_starting_inventory, state.starting_item_claims, elementId]);

  const savedIndex = useMemo(() => {
    if (elementId === null || !items || !items.length) { return null; }
    const savedItem = state.items_list[elementId];
    if (!savedItem) { return null; }
    const idx = items.indexOf(savedItem);
    return idx >= 0 ? idx : null;
  }, [items, elementId, state.items_list]);

  const savedCounter = useMemo(() => {
    if (name === null) { return null; }
    const value = state.counters[name];
    return value === undefined ? null : value;
  }, [name, state.counters]);

  const savedLabelValue = useMemo(() => {
    if (elementId === null) { return null; }
    const selection = state.labelSelections[elementId];
    return selection ? selection.value : null;
  }, [elementId, state.labelSelections]);

  return { ...actions, startingIndex, startingItem, savedIndex, savedCounter, savedLabelValue };
};

const useLabelSelect = () => {
  const { dispatch } = useTracker();
  return useCallback(
    (elementId, name, value) =>
      dispatch({ type: "LABEL_SELECT", payload: { elementId, name, value } }),
    [dispatch],
  );
};

const useHintEntry = (id = null) => {
  const { state, dispatch } = useTracker();

  const setHintEntry = useCallback(
    value => dispatch({ type: "HINT_ENTRY", payload: { id, value } }),
    [dispatch, id],
  );

  const savedHintEntry = useMemo(() => {
    if (id === null) { return null; }
    return state.hintEntries[id] ?? null;
  }, [id, state.hintEntries]);

  return { setHintEntry, savedHintEntry };
};

const useDraggedIcon = (id = null) => {
  const { state, dispatch } = useTracker();

  const persistDraggedIcon = useCallback(
    iconName => dispatch({ type: "DRAGGED_ICON_SET", payload: { id, iconName } }),
    [dispatch, id],
  );

  const savedDraggedIcon = useMemo(() => {
    if (id === null) { return null; }
    return state.draggedIcons[id] ?? null;
  }, [id, state.draggedIcons]);

  return { persistDraggedIcon, savedDraggedIcon };
};

const useIconCache = () => {
  const { state, dispatch } = useTracker();

  const setIconCache = useCallback(
    (iconUrlByName, iconNameByUrl) =>
      dispatch({ type: "ICON_CACHE_SET", payload: { iconUrlByName, iconNameByUrl } }),
    [dispatch],
  );

  return { setIconCache, iconUrlByName: state.iconUrlByName, iconNameByUrl: state.iconNameByUrl };
};

const useSelectedEFKDungeons = () => {
  const { state: { labelSelections } } = useTracker();
  return useMemo(() => getActiveGame().getSelectedDungeons(labelSelections), [labelSelections]);
};

const useSettingsString = () => {
  const {
    state: { settings_string, generator_version },
    dispatch,
  } = useTracker();

  const actions = useMemo(
    () => ({
      setString: string => dispatch({ type: "STRING_SET", payload: string }),
      setVersion: version => dispatch({ type: "VERSION_SET", payload: version }),
    }),
    [dispatch],
  );

  return { ...actions, settings_string, generator_version };
};

/**
 * Restores a saved session once the tracker structure is ready, when the
 * window was opened with `?resume=1`. Runs at most once.
 * @param {boolean} isReady - True when locations/items have finished building.
 */
const useSessionRestore = isReady => {
  const { dispatch } = useTracker();
  const restoredRef = useRef(false);

  useEffect(() => {
    if (!isReady || restoredRef.current) { return; }

    const params = new URLSearchParams(window.location.search);
    if (params.get("resume") !== "1") { return; }

    const snapshot = loadSession();
    if (snapshot) {
      dispatch({ type: "SESSION_RESTORE", payload: snapshot });
    }
    restoredRef.current = true;
  }, [isReady, dispatch]);
};

export {
  getGeneratorVersionCache, getSettingsStringCache, loadSession, TrackerProvider,
  useChecks, useDraggedIcon, useElement, useHintEntry, useIconCache, useItems, useLabelSelect, useLocation,
  useSelectedEFKDungeons, useSessionRestore, useSettingsString, useTracker
};

