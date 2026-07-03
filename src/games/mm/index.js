import DEFAULT_ITEMS from "./data/default-items.json";
import elements from "./data/elements.json";
import icons from "./data/icons.json";
import SETTING_STRINGS from "./data/setting-strings.json";
import base from "./layouts/base.json";
import hashFrogMM from "./layouts/HashFrogMM.json";
import Checks from "./scenes/Checks";
import * as tracker from "./tracker";

// Check tracking is driven by two generator strings (see logic/checks.js).
const CHECKS_STRING_FIELDS = [
  { key: "itemList", label: "Item List String", placeholder: "Paste item list string here" },
  { key: "junk", label: "Enforce Junk Locations String", placeholder: "Paste enforce junk locations string here" },
];

const CHECKS_NOTES = [
  "Check tracking uses casual logic. Tricks and glitches are assumed off.",
  "Paste both the item-list string and the enforce-junk-locations string from the randomizer; together they determine which checks are tracked.",
];

// The Majora's Mask game adapter. Phase A wires real MM icons, elements, and a
// default layout for item tracking; reachability logic arrives in Phase B.
const mmAdapter = {
  id: "mm",
  displayName: "Majora's Mask Randomizer",
  basePath: "/mm",
  defaultItems: DEFAULT_ITEMS,

  data: {
    elements,
    icons,
    labels: {},
    layouts: {
      base,
      default: hashFrogMM,
      presets: [{ key: "hashfrogmm", label: "HashFrog MM", layout: hashFrogMM }],
    },
    settingPresets: SETTING_STRINGS.presets || [],
    supportedVersions: SETTING_STRINGS.supportedVersions || ["2.0.0"],
    currentActiveVersion: SETTING_STRINGS.currentActiveVersion || "2.0.0",
    checksStringFields: CHECKS_STRING_FIELDS,
    checksNotes: CHECKS_NOTES,
  },

  ChecksScene: Checks,

  evaluator: tracker.evaluator,
  parseItems: tracker.parseItems,
  deriveStartingInventory: tracker.deriveStartingInventory,
  initializeLogic: tracker.initializeLogic,
  getSkipRegions: tracker.getSkipRegions,
  shouldRevalidateOnLabel: tracker.shouldRevalidateOnLabel,
  getSelectedDungeons: tracker.getSelectedDungeons,
  serializeSettings: tracker.serializeSettings,
  restoreSettings: tracker.restoreSettings,
  rebuildRestoredRegions: tracker.rebuildRestoredRegions,
  extraActions: tracker.extraActions,
};

export default mmAdapter;
