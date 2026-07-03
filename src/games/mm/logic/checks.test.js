import { decodeLocationString, deriveEnabledChecks } from "./checks";

// Real generator strings from an MM 2.0.0 casual seed (item-list + enforce-junk).
const ITEM_LIST =
  "-------------------------40c-bfff83f0-7f003800---ffffff-ffffffff-ffffffff-f0000000-7bbeeffb-ffffffff-fffffffe-ffffffff";
const JUNK =
  "--------------------------3fff83f0-7f003800---fe0000----82-80400000-190e0201-f000";

describe("decodeLocationString", () => {
  it("decodes the item-list string to the randomized set", () => {
    const randomized = decodeLocationString(ITEM_LIST);
    expect(randomized.size).toBe(248);
    expect(randomized.has("ItemBow")).toBe(true); // Hero's Bow Chest is shuffled
    expect(randomized.has("ItemWoodfallBossKey")).toBe(false); // vanilla boss keys are not
  });

  it("decodes the enforce-junk string to the forced-junk set", () => {
    const junk = decodeLocationString(JUNK);
    expect(junk.size).toBe(54);
    expect(junk.has("FairySpinAttack")).toBe(true); // Woodfall Great Fairy, forced junk
  });

  it("maps bits MSW-first, LSB-first within a word, over the given basis", () => {
    const basis = Array.from({ length: 40 }, (_, i) => `id${i}`);
    // Set indices 0 and 5 (word 0) and 33 (word 1); words are emitted high-first.
    expect(decodeLocationString("2-21", basis)).toEqual(new Set(["id0", "id5", "id33"]));
  });

  it("ignores empty fields and bits past the end of the basis", () => {
    expect(decodeLocationString("--3", ["a", "b"])).toEqual(new Set(["a", "b"]));
    expect(decodeLocationString("ff", ["a", "b", "c"])).toEqual(new Set(["a", "b", "c"]));
  });
});

describe("deriveEnabledChecks", () => {
  it("returns randomized locations that are not forced to junk", () => {
    const enabled = deriveEnabledChecks(ITEM_LIST, JUNK);
    expect(enabled.size).toBe(195); // 248 randomized - 53 junked (the 54th is a Fake, unrandomized)
    expect(enabled.has("MaskDeku")).toBe(true); // randomized, kept
    expect(enabled.has("FairySpinAttack")).toBe(false); // randomized, junked out
    expect(enabled.has("UpgradeRoyalWallet")).toBe(false); // Fake junk id, never randomized
  });
});
