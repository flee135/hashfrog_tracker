import DEFAULT_ITEMS from "./data/default-items.json";
import elements from "./data/elements.json";
import icons from "./data/icons.json";
import SETTING_STRINGS from "./data/setting-strings.json";
import base from "./layouts/base.json";
import hashFrogMM from "./layouts/HashFrogMM.json";
import * as tracker from "./tracker";

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
  },

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
