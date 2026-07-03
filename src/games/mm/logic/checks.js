import ALL_LOCATIONS from "../data/all-locations.json";

// Decodes mm-rando's generator location strings into the set of enabled checks.
//
// The item-list string (CustomItemListString) and the enforce-junk string
// (CustomJunkLocationsString) share one encoding, verified against mm-rando's
// ItemEditForm / JunkLocationEditForm: a "-"-separated list of 32-bit hex words,
// most-significant word first (so the last field is word 0), least-significant
// bit first within each word. Bit i (word i/32, bit i%32) set means location
// ALL_LOCATIONS[i] is selected, where ALL_LOCATIONS is ItemUtils.AllLocations()
// (every Item member with a LocationName, in enum-declaration order). Bits past
// the end of the list are ignored, matching the generator's own bounds guard.

/**
 * Decodes a generator location bitfield string into the set of selected ids.
 * @param {string} str - The "-"-separated hex word string.
 * @param {Array<string>} [allLocations] - Ordered index-to-id basis (defaults to AllLocations).
 * @returns {Set<string>} The ids whose bit is set.
 */
export function decodeLocationString(str, allLocations = ALL_LOCATIONS) {
  const ids = new Set();
  const words = str.split("-");
  for (let word = 0; word < words.length; word++) {
    const field = words[words.length - 1 - word];
    if (!field) {
      continue;
    }
    const value = parseInt(field, 16) >>> 0;
    for (let bit = 0; bit < 32; bit++) {
      if ((value >>> bit) & 1) {
        const index = word * 32 + bit;
        if (index < allLocations.length) {
          ids.add(allLocations[index]);
        }
      }
    }
  }
  return ids;
}

/**
 * Derives the enabled check set: locations that are randomized (item-list
 * string) and not forced to junk (enforce-junk string).
 * @param {string} itemListString - The CustomItemListString bitfield.
 * @param {string} junkString - The CustomJunkLocationsString bitfield.
 * @returns {Set<string>} Ids of checks that can hold progression.
 */
export function deriveEnabledChecks(itemListString, junkString) {
  const enabled = decodeLocationString(itemListString);
  for (const id of decodeLocationString(junkString)) {
    enabled.delete(id);
  }
  return enabled;
}
