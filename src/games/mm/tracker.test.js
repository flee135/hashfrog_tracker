import LOCATIONS from "./data/locations.json";
import STARTING_ITEM_IDS from "./data/starting-item-ids.json";
import UUID_TO_ITEM from "./data/uuid-to-item.json";
import MMEvaluator from "./logic/evaluator";
import { deriveStartingInventory, initializeLogic, parseItems } from "./tracker";

const ALL_CHECK_IDS = Object.values(LOCATIONS).flat().map(check => check.id);

// The generator default (from GameplaySettings.CustomStartingItemListString). Its
// four leading dashes are empty high-order words; it decodes to Ocarina, Song of
// Time, Song of Soaring, every dungeon map/compass, and every tingle map. Only
// Song of Time is a tracked element, so that is the sole pre-owned UUID.
const DEFAULT_STRING = "----1fbfc-5800000-";
const SONG_TIME_UUID = "b87a2661d33c4256889c48ef83d6d646";
const MASK_DEKU_UUID = "49311bcea5184cc98f5e5b80ae7a7a2a";
const BOTTLE_UUID = "92e48794a0a94b59a4235ff3820b2f63";
const GOLD_DUST_UUID = "63453628ad7d41699ec34e9c82192c74";

/**
 * Encodes basis indices into a CustomStartingItemListString, mirroring mm-rando's
 * ItemUtils.ConvertItemListToString (zero words render empty, words emitted MSW-first).
 * @param {Array<number>} indices - Bit indices into STARTING_ITEM_IDS to set.
 * @returns {string} The encoded "-"-separated hex string.
 */
function encode(indices) {
  const sectionCount = Math.ceil(STARTING_ITEM_IDS.length / 32);
  const words = new Array(sectionCount).fill(0);
  for (const i of indices) {
    words[Math.floor(i / 32)] |= 1 << i % 32;
  }
  return words.map(word => (word === 0 ? "" : (word >>> 0).toString(16))).reverse().join("-");
}

describe("deriveStartingInventory", () => {
  it("returns no pre-owned items for a blank or missing string", () => {
    expect(deriveStartingInventory({ startingItemsString: "" })).toEqual([]);
    expect(deriveStartingInventory({})).toEqual([]);
    expect(deriveStartingInventory()).toEqual([]);
  });

  it("decodes the generator default to only the tracked Song of Time", () => {
    expect(deriveStartingInventory({ startingItemsString: DEFAULT_STRING })).toEqual([SONG_TIME_UUID]);
  });

  it("maps a set starting-item bit to its tracked element UUID", () => {
    const string = encode([STARTING_ITEM_IDS.indexOf("MaskDeku")]);
    expect(deriveStartingInventory({ startingItemsString: string })).toEqual([MASK_DEKU_UUID]);
  });

  it("collapses the five interchangeable bottle ids to the single bottle element UUID", () => {
    const bottleIndices = [
      "ItemBottleWitch", "ItemBottleAliens",
      "ItemBottleBeavers", "ItemBottleDampe", "ItemBottleMadameAroma",
    ].map(id => STARTING_ITEM_IDS.indexOf(id));
    expect(deriveStartingInventory({ startingItemsString: encode(bottleIndices) })).toEqual([BOTTLE_UUID]);
  });

  it("maps the Goron Race gold-dust bottle to its own element, separate from the bottle toggle", () => {
    const goldDust = encode([STARTING_ITEM_IDS.indexOf("ItemBottleGoronRace")]);
    expect(deriveStartingInventory({ startingItemsString: goldDust })).toEqual([GOLD_DUST_UUID]);
  });

  it("ignores starting items that have no tracked element", () => {
    // ItemOcarina is a real starting item but has no element in UUID_TO_ITEM.
    expect(UUID_TO_ITEM["ItemOcarina"]).toBeUndefined();
    const string = encode([STARTING_ITEM_IDS.indexOf("ItemOcarina")]);
    expect(deriveStartingInventory({ startingItemsString: string })).toEqual([]);
  });
});

describe("parseItems starting-item seeding", () => {
  // STARTING_ITEM_SEED is module state set by initializeLogic; reset after each test.
  afterEach(async () => {
    await initializeLogic({ startingItemsString: "" });
  });

  it("seeds untracked, logic-gated starting items so the evaluator assumes them", async () => {
    await initializeLogic({ startingItemsString: DEFAULT_STRING });
    const items = parseItems({}, {}, []);
    expect(items.ItemOcarina).toBe(1); // untracked (no icon), referenced by logic
    expect(items.SongSoaring).toBe(1); // untracked (no icon), referenced by logic
    expect(items.SongTime).toBe(1); // tracked too, but seeded here regardless
  });

  it("does not seed starting items when no string is configured", async () => {
    await initializeLogic({ startingItemsString: "" });
    const items = parseItems({}, {}, []);
    expect(items.ItemOcarina).toBeUndefined();
    expect(items.SongTime).toBe(0);
  });

  it("makes more checks reachable in the evaluator once the seed is applied", async () => {
    const reachableCount = async startingItemsString => {
      await initializeLogic({ startingItemsString });
      MMEvaluator.updateItems(parseItems({}, {}, []));
      return ALL_CHECK_IDS.filter(id => MMEvaluator.isLocationAvailable(id)).length;
    };
    // Seeding the default starting inventory (Ocarina, songs, ...) unlocks checks
    // that were unreachable with only the hardcoded casual baseline.
    expect(await reachableCount(DEFAULT_STRING)).toBeGreaterThan(await reachableCount(""));
  });
});

describe("Small Key Doors Open toggle", () => {
  afterEach(async () => {
    await initializeLogic({ startingItemsString: "", smallKeysOpen: true });
  });

  it("seeds the dungeon small keys as held when on (the default)", async () => {
    await initializeLogic({ startingItemsString: "" }); // smallKeysOpen defaults on
    const items = parseItems({}, {}, []);
    expect(items.ItemWoodfallKey1).toBe(1);
    expect(items.ItemStoneTowerKey4).toBe(1);
  });

  it("does not seed small keys when off", async () => {
    await initializeLogic({ startingItemsString: "", smallKeysOpen: false });
    const items = parseItems({}, {}, []);
    expect(items.ItemWoodfallKey1).toBeUndefined();
    expect(items.ItemStoneTowerKey4).toBeUndefined();
  });

  it("satisfies a small-key requirement in the evaluator when on, not when off", async () => {
    // "3 Snowhead Keys" is a pure key-count macro: RequiredItems are the three
    // Snowhead small keys and nothing else, so it flips solely on the toggle.
    await initializeLogic({ startingItemsString: "", smallKeysOpen: false });
    MMEvaluator.updateItems(parseItems({}, {}, []));
    expect(MMEvaluator.isLocationAvailable("3 Snowhead Keys")).toBe(false);

    await initializeLogic({ startingItemsString: "", smallKeysOpen: true });
    MMEvaluator.updateItems(parseItems({}, {}, []));
    expect(MMEvaluator.isLocationAvailable("3 Snowhead Keys")).toBe(true);
  });
});

describe("initializeLogic possession-gating", () => {
  // A settings string is "itemList|junk". "2---" sets bit 97 (word 3, bit 1) =
  // SongHealing: its "Starting Song" vanilla slot. When songs are shuffled that
  // slot is randomized AND force-junked, so both fields set it here. Gating must
  // key off the item-list alone -- subtracting junk would un-gate SongHealing and
  // let its rule-less vanilla node freely unlock Kamaro (needs Play Song of Healing).
  it("gates a shuffled item whose vanilla location is force-junked", async () => {
    await initializeLogic({ settingsString: "2---|2---", startingItemsString: "" });

    MMEvaluator.updateItems({ ItemOcarina: 1 });
    expect(MMEvaluator.isLocationAvailable("MaskKamaro")).toBe(false); // no song held

    MMEvaluator.updateItems({ ItemOcarina: 1, SongHealing: 1 });
    expect(MMEvaluator.isLocationAvailable("MaskKamaro")).toBe(true);
  });
});
