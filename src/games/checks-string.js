// A game may need several generator strings to configure check tracking (MM
// takes an item-list string and an enforce-junk string). The shared engine
// persists a single settings_string, so multi-field games pack their values
// into that one slot with this separator. It is a character that never appears
// in a generator string (hex digits and dashes), so splitting is lossless.
export const CHECKS_STRING_SEPARATOR = "|";

/**
 * Packs per-field string values into the single settings_string slot.
 * @param {Array<string>} values - Field values in field order.
 * @returns {string} The combined string (identity for a single field).
 */
export function joinChecksStrings(values) {
  return values.length === 1 ? values[0] : values.join(CHECKS_STRING_SEPARATOR);
}

/**
 * Unpacks the settings_string slot back into per-field values.
 * @param {string} combined - The combined settings_string.
 * @param {number} count - The number of fields expected.
 * @returns {Array<string>} Exactly `count` values, padded with empty strings.
 */
export function splitChecksStrings(combined, count) {
  if (count === 1) {
    return [combined];
  }
  const parts = combined.split(CHECKS_STRING_SEPARATOR);
  return Array.from({ length: count }, (_unused, i) => parts[i] || "");
}
