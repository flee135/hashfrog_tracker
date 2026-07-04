import LOGIC from "../data/logic-casual.json";
import SHUFFLED_ITEM_IDS from "../data/shuffled-item-ids.json";
import { CASUAL_SETTINGS, CASUAL_STARTING_ITEMS } from "./settings";

// MM reachability evaluator. REQ_CASUAL is a flat graph where availability is
// AND(RequiredItems) AND (ConditionalItems empty OR OR-of-AND(branches)),
// carrying a 6-bit TimeOfDay mask. Every enum Id is both an item and its vanilla
// location, so an Id plays two roles that must stay separate: as a requirement
// referenced by other nodes it asks "does the player possess this", but its own
// node asks "can the player reach this location" and is solved from its own rule.
//
// How a reference resolves depends on whether the Id is *possession-gated* -- a
// shuffled item whose vanilla location holds some other random item this seed:
//   - Possession-gated: possession only. It counts when held (toggled item, casual
//     starting item) and NEVER via its own location's reachability -- reaching that
//     location grants the random item placed there, not this one. Un-held ones
//     resolve to 0.
//   - Everything else -- Area* access, macros like "Any Sword", Setting* nodes, and
//     shuffleable checks NOT shuffled this seed (a vanilla stray fairy still sits at
//     its location): transitive. It resolves to its own computed reachability, so
//     region access, macros, and unshuffled checks propagate through the fixpoint.
//
// The possession-gated set is the seed's shuffled subset (setEnabledChecks). The
// broader *shuffleable* set (shuffled-item-ids.json -- Item.cs members with an
// ItemPool ItemCategory) is separate: it marks which rule-less nodes are real
// vanilla locations (freely reachable) rather than gating inputs, regardless of
// whether the item there is shuffled.
// Possession never short-circuits the held node's own value -- otherwise holding
// an item would falsely mark the vanilla location it lives at as reachable. See
// mm-logic-format memory for the format details.

export const TIME_BITS = { Day1: 1, Night1: 2, Day2: 4, Night2: 8, Day3: 16, Night3: 32 };
export const TIME_FULL = 63;

/**
 * Parses a TimeAvailable string ("Day1, Night1") into a 6-bit mask. A missing
 * value means "any time" and maps to the full mask.
 * @param {string} [str] - The serialized TimeOfDay flags, or undefined.
 * @returns {number} The time mask.
 */
export function parseTime(str) {
  if (!str) {
    return TIME_FULL;
  }
  return str.split(",").reduce((mask, part) => mask | (TIME_BITS[part.trim()] || 0), 0);
}

/**
 * Precomputes evaluator nodes from raw logic entries.
 * @param {Array<object>} entries - Raw {Id, RequiredItems?, ConditionalItems?, TimeAvailable?} entries.
 * @returns {Array<object>} Nodes with parsed time masks and a leaf flag.
 */
export function buildNodes(entries) {
  return entries.map(entry => {
    const required = entry.RequiredItems || [];
    const conditional = entry.ConditionalItems || [];
    return {
      id: entry.Id,
      required,
      conditional,
      time: parseTime(entry.TimeAvailable),
      isLeaf: required.length === 0 && conditional.length === 0,
    };
  });
}

/**
 * Solves the reachable time mask for every node by monotonic fixpoint. A held id
 * satisfies references to it in other nodes' rules (full mask), but never
 * short-circuits its own node -- that stays gated on its own location rule. An
 * un-held possession-gated id resolves to 0; any other un-held node resolves to
 * its own computed reachability (transitive). A leaf node is freely reachable when
 * it is a shuffleable check (its rule-less vanilla location), but unreachable
 * otherwise -- non-item leaves (tricks, off-settings) only count when seeded.
 * @param {Array<object>} nodes - Nodes from buildNodes.
 * @param {Set<string>} seeded - Ids held as inputs (items, settings, starting items).
 * @param {Set<string>} [shuffleable] - Ids whose rule-less node is a reachable vanilla location (default: none).
 * @param {Set<string>} [possessionGated] - Ids that resolve by possession only (default: all shuffleable).
 * @returns {Map<string, number>} Map of node id to reachable time mask (0 = unreachable).
 */
export function computeReachability(nodes, seeded, shuffleable = new Set(), possessionGated = shuffleable) {
  const mask = new Map(nodes.map(node => [node.id, 0]));
  // A held id resolves full when referenced as a requirement. An un-held
  // possession-gated id is not possessed, so it resolves to 0 -- reaching its
  // vanilla location never grants it. Other un-held nodes contribute their own
  // reachability (transitive), including shuffleable checks left vanilla this seed.
  const lookup = id => {
    if (seeded.has(id)) {
      return TIME_FULL;
    }
    if (possessionGated.has(id)) {
      return 0;
    }
    return mask.get(id) || 0;
  };

  let changed = true;
  while (changed) {
    changed = false;
    for (const node of nodes) {
      let next;
      if (node.isLeaf) {
        // A shuffleable check's leaf node is its vanilla location, which -- having
        // no rule -- is freely reachable at its available times; possession (when
        // shuffled) is resolved separately in lookup. Every other leaf (tricks,
        // off-settings, OtherInaccessible) is a gating input that only counts when
        // seeded, so it stays unreachable here.
        next = shuffleable.has(node.id) ? node.time : 0;
      } else {
        next = node.time;
        for (const reqId of node.required) {
          next &= lookup(reqId);
          if (next === 0) {
            break;
          }
        }
        if (next !== 0 && node.conditional.length > 0) {
          let condMask = 0;
          for (const branch of node.conditional) {
            let branchMask = TIME_FULL;
            for (const memberId of branch) {
              branchMask &= lookup(memberId);
              if (branchMask === 0) {
                break;
              }
            }
            condMask |= branchMask;
            if (condMask === TIME_FULL) {
              break;
            }
          }
          next &= condMask;
        }
      }
      if (next !== mask.get(node.id)) {
        mask.set(node.id, next);
        changed = true;
      }
    }
  }

  return mask;
}

const NODES = buildNodes(LOGIC);
const SHUFFLED_ITEMS = new Set(SHUFFLED_ITEM_IDS);

// Singleton implementing the shared engine's evaluator contract
// ({ updateItems, isLocationAvailable }) over the casual graph.
class MMEvaluator {
  static mask = new Map();

  // Ids resolved by possession only. Defaults to every shuffleable item (all
  // gated) until a seed narrows it via setEnabledChecks; a shuffleable check left
  // out of this set stays at its vanilla location and propagates transitively.
  static possessionGated = SHUFFLED_ITEMS;

  // Restricts possession-gating to the seed's actually-shuffled checks. `enabled`
  // is the location set from deriveEnabledChecks; intersecting with SHUFFLED_ITEMS
  // keeps non-item locations out so only real shuffled items are gated.
  static setEnabledChecks(enabled) {
    MMEvaluator.possessionGated = new Set([...SHUFFLED_ITEMS].filter(id => enabled.has(id)));
  }

  static updateItems(parsedItems, _skipRegions) {
    const seeded = new Set(CASUAL_STARTING_ITEMS);
    for (const settingId of CASUAL_SETTINGS) {
      seeded.add(settingId);
    }
    for (const [id, count] of Object.entries(parsedItems || {})) {
      if (count > 0) {
        seeded.add(id);
      }
    }
    MMEvaluator.mask = computeReachability(NODES, seeded, SHUFFLED_ITEMS, MMEvaluator.possessionGated);
  }

  static isLocationAvailable(id) {
    return (MMEvaluator.mask.get(id) || 0) !== 0;
  }
}

export default MMEvaluator;
