import DEFAULT_ITEMS from "./data/default-items.json";
import elements from "./data/elements.json";
import icons from "./data/icons.json";
import labels from "./data/labels.json";
import SETTING_STRINGS from "./data/setting-strings.json";
import base from "./layouts/base.json";
import escapefromkak from "./layouts/escapefromkak.json";
import hashfrog from "./layouts/hashfrog.json";
import linso from "./layouts/linso.json";
import Checks from "./scenes/Checks";
import * as tracker from "./tracker";

// Notes shown under the launcher's check-tracking panel.
const CHECKS_NOTES = [
  "The logic assumes: access to both ages; no shuffled entrances, owl drops, warp song destinations, or spawns; and vanilla (default) ocarina melodies.",
  "Closed Forest and Closed Door of Time do not work for the reasons above.",
  "The logic assumes that the initial value for a counter is zero. Click the counter to update it if not.",
  "Advanced logic is not yet supported.",
  "Checks with the same name plus a number prefix are grouped together if they have the same access requirements, with the total number of checks shown in parentheses, e.g. Guard House Child Pot (44).",
];

// The OoT game adapter: everything game-specific the shared engine consumes.
const ootAdapter = {
  id: "oot",
  displayName: "Ocarina of Time Randomizer",
  basePath: "",
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
    checksStringFields: [{ key: "settings", label: "Settings String", placeholder: "Paste settings string here" }],
    checksNotes: CHECKS_NOTES,
  },

  ChecksScene: Checks,

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
