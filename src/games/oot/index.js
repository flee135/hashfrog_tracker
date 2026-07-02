import DEFAULT_ITEMS from "./data/default-items.json";
import elements from "./data/elements.json";
import icons from "./data/icons.json";
import labels from "./data/labels.json";
import SETTING_STRINGS from "./data/setting-strings.json";
import base from "./layouts/base.json";
import escapefromkak from "./layouts/escapefromkak.json";
import hashfrog from "./layouts/hashfrog.json";
import linso from "./layouts/linso.json";
import * as tracker from "./tracker";

// The OoT game adapter: everything game-specific the shared engine consumes.
const ootAdapter = {
  id: "oot",
  displayName: "Ocarina of Time Randomizer",
  defaultItems: DEFAULT_ITEMS,

  data: {
    elements,
    icons,
    labels,
    layouts: {
      base,
      default: hashfrog,
      presets: [
        { key: "hashfrog", label: "HashFrog", layout: hashfrog },
        { key: "linso", label: "LinSo Like", layout: linso },
        { key: "escapefromkak", label: "EscapeFromKak", layout: escapefromkak },
      ],
    },
    settingPresets: SETTING_STRINGS.presets || [],
    supportedVersions: SETTING_STRINGS.supportedVersions || ["9.0.0"],
    currentActiveVersion: SETTING_STRINGS.currentActiveVersion || "9.0.0",
  },

  // Logic lifecycle + reducer hooks (see ./tracker.js)
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

export default ootAdapter;
