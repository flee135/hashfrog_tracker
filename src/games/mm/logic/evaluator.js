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
// How a reference resolves depends on whether the Id is a *shuffled item*
// (shuffled-item-ids.json -- an Item.cs member with an ItemPool ItemCategory):
//   - Shuffled item: possession only. It counts when held (toggled item, casual
//     starting item) and NEVER via its own location's reachability -- in a
//     randomizer that location holds some other random item, so reaching it does
//     not grant this one. Un-held shuffled items resolve to 0.
//   - Everything else (Area* access, macros like "Any Sword", Setting* nodes):
//     transitive. It resolves to its own computed reachability, so region access
//     and macros still propagate through the fixpoint.
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
 * un-held shuffled item resolves to 0 (possession-gated); any other un-held node
 * resolves to its own computed reachability (transitive). Un-held leaf inputs
 * stay unreachable.
 * @param {Array<object>} nodes - Nodes from buildNodes.
 * @param {Set<string>} seeded - Ids held as inputs (items, settings, starting items).
 * @param {Set<string>} [shuffledItems] - Ids that are possession-gated (default: none).
 * @returns {Map<string, number>} Map of node id to reachable time mask (0 = unreachable).
 */
export function computeReachability(nodes, seeded, shuffledItems = new Set()) {
  const mask = new Map(nodes.map(node => [node.id, 0]));
  // A held id resolves full when referenced as a requirement. An un-held shuffled
  // item is not possessed, so it resolves to 0 -- reaching its vanilla location
  // never grants it. Other un-held nodes contribute their own reachability.
  const lookup = id => {
    if (seeded.has(id)) {
      return TIME_FULL;
    }
    if (shuffledItems.has(id)) {
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
        next = 0;
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
    MMEvaluator.mask = computeReachability(NODES, seeded, SHUFFLED_ITEMS);
  }

  static isLocationAvailable(id) {
    return (MMEvaluator.mask.get(id) || 0) !== 0;
  }
}

export default MMEvaluator;
