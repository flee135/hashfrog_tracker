/* eslint-disable */
// Extracts the Majora's Mask casual reachability graph into the runtime bundle
// consumed by src/games/mm/logic/evaluator.js.
//
// Inputs (drop these into scripts/mm/source/, they are gitignored):
//   - Item.cs         : mm-rando MMR.Randomizer/GameObjects/Item.cs (the Item enum)
//   - REQ_CASUAL.json : mm-rando MMR.Randomizer/Resources/REQ_CASUAL.txt (JSON despite .txt)
//
// Outputs:
//   - src/games/mm/data/logic-casual.json : trimmed graph, one entry per node:
//       { Id, RequiredItems?, ConditionalItems?, TimeAvailable? }
//     Empty RequiredItems / ConditionalItems and a "None" TimeAvailable are
//     omitted to keep the bundle lean; the evaluator defaults them.
//   - src/games/mm/data/locations.json : { Region: [ { id, name, category } ] }
//     the full check universe grouped by Item.cs Region attribute. The enabled
//     subset for a given seed is derived at runtime from the generator's
//     item-list / enforce-junk strings.
//   - src/games/mm/data/all-locations.json : ordered [id] of every Item member
//     carrying a LocationName, in enum-declaration order. This is mm-rando's
//     ItemUtils.AllLocations() basis — the index each bit of the generator's
//     item-list / enforce-junk hex strings maps to (see logic/checks.js).
//   - src/games/mm/data/shuffled-item-ids.json : sorted [id] of every logic node
//     that is a shuffled item (Item.cs member with an ItemPool ItemCategory). The
//     evaluator possession-gates these: referenced as a requirement they count
//     only when held, never via their vanilla location's reachability. Nodes
//     absent here (Area* access, macros, settings) still propagate transitively.
//
// A node with neither RequiredItems nor ConditionalItems is a leaf/input: the
// evaluator holds it only if it is seeded (held item, casual starting item, or
// on-setting). Tricks are leaves that are never seeded, so IsTrick is not
// needed at runtime and is dropped here.
//
// Run: node scripts/mm/extract-mm-data.js

const fs = require("fs");
const path = require("path");

const SOURCE_DIR = path.join(__dirname, "source");
const DATA_DIR = path.join(__dirname, "..", "..", "src", "games", "mm", "data");
const OUT_FILE = path.join(DATA_DIR, "logic-casual.json");
const LOCATIONS_FILE = path.join(DATA_DIR, "locations.json");
const ALL_LOCATIONS_FILE = path.join(DATA_DIR, "all-locations.json");
const SHUFFLED_ITEMS_FILE = path.join(DATA_DIR, "shuffled-item-ids.json");

// LocationCategories that are not player-trackable checks.
const EXCLUDED_CATEGORIES = new Set(["StartingItems", "Fake"]);

function loadLogic() {
  const raw = fs.readFileSync(path.join(SOURCE_DIR, "REQ_CASUAL.json"), "utf8");
  return JSON.parse(raw).Logic;
}

// Parses the Item enum in declaration order, accumulating attribute lines until
// each bare member line. Declaration order equals the enum value order (verified
// to match REQ_CASUAL order across all shared ids).
function loadItemMembers() {
  const lines = fs.readFileSync(path.join(SOURCE_DIR, "Item.cs"), "utf8").split(/\r?\n/);
  const reserved = new Set(["public", "enum", "get", "set", "private", "return"]);
  const members = [];
  let attrs = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith("[")) {
      attrs.push(line);
      continue;
    }
    const match = line.match(/^([A-Za-z_]\w*)\s*(=\s*[^,]+)?,\s*(\/\/.*)?$/);
    if (match && !reserved.has(match[1])) {
      const blob = attrs.join(" ");
      members.push({
        id: match[1],
        locationName: (blob.match(/LocationName\("([^"]*)"/) || [])[1] || null,
        regionRef: (blob.match(/Region\((?:Region\.)?(\w+)\)/) || [])[1] || null,
        category: (blob.match(/ItemPool\([^)]*LocationCategory\.(\w+)/) || [])[1] || null,
        itemCategory: (blob.match(/ItemPool\(ItemCategory\.(\w+)/) || [])[1] || null,
      });
      attrs = [];
    } else if (line && !line.startsWith("//")) {
      attrs = [];
    }
  }
  return members;
}

// A Region can be given directly (Region.WoodfallTemple) or via another Item that
// carries the region — the boss lairs do this, e.g. Region(AreaOdolwasLair), where
// AreaOdolwasLair is itself an Item with Region.WoodfallTemple. Follow that alias
// chain to the underlying Region name; region-less members resolve to null.
function resolveRegion(member, byId) {
  let current = member;
  const seen = new Set();
  while (current.regionRef && byId.has(current.regionRef) && !seen.has(current.id)) {
    seen.add(current.id);
    current = byId.get(current.regionRef);
  }
  return current.regionRef || null;
}

function buildLocations(members, logicIds) {
  const byId = new Map(members.map(member => [member.id, member]));
  const byRegion = {};
  for (const member of members) {
    if (!member.locationName || !logicIds.has(member.id)) {
      continue;
    }
    if (member.category && EXCLUDED_CATEGORIES.has(member.category)) {
      continue;
    }
    const region = resolveRegion(member, byId) || "Misc";
    (byRegion[region] ||= []).push({
      id: member.id,
      name: member.locationName,
      category: member.category || null,
    });
  }
  // Stable, alphabetical region order for a readable diff.
  const sorted = {};
  for (const region of Object.keys(byRegion).sort()) {
    sorted[region] = byRegion[region];
  }
  return sorted;
}

// mm-rando's ItemUtils.AllLocations() = every Item enum member with a
// LocationName, in declaration order. Unlike locations.json this keeps ALL of
// them (including StartingItems/Fake) and stays unfiltered by logic membership,
// because the generator's hex strings index bits into this exact list.
function buildAllLocations(members) {
  return members.filter(member => member.locationName).map(member => member.id);
}

// Shuffled items = Item.cs members with an ItemPool ItemCategory that are also
// logic nodes. These are possession-gated by the evaluator (see the header):
// holding one satisfies references to it, but merely reaching its vanilla
// location never does. Access/macro/setting nodes lack an ItemCategory and keep
// propagating transitively.
function buildShuffledItemIds(members, logicIds) {
  return members
    .filter(member => member.itemCategory && logicIds.has(member.id))
    .map(member => member.id)
    .sort();
}

function trimEntry(entry) {
  const trimmed = { Id: entry.Id };
  if (entry.RequiredItems && entry.RequiredItems.length) {
    trimmed.RequiredItems = entry.RequiredItems;
  }
  if (entry.ConditionalItems && entry.ConditionalItems.length) {
    trimmed.ConditionalItems = entry.ConditionalItems;
  }
  if (entry.TimeAvailable && entry.TimeAvailable !== "None") {
    trimmed.TimeAvailable = entry.TimeAvailable;
  }
  return trimmed;
}

function main() {
  const logic = loadLogic();

  const ids = new Set(logic.map(e => e.Id));
  const dangling = new Set();
  for (const e of logic) {
    for (const id of e.RequiredItems || []) if (!ids.has(id)) dangling.add(id);
    for (const branch of e.ConditionalItems || []) for (const id of branch) if (!ids.has(id)) dangling.add(id);
  }
  if (dangling.size) {
    throw new Error(`Graph references undefined ids: ${[...dangling].slice(0, 10).join(", ")}`);
  }

  const trimmed = logic.map(trimEntry);
  fs.writeFileSync(OUT_FILE, JSON.stringify(trimmed, null, 2) + "\n");

  const leaves = trimmed.filter(e => !e.RequiredItems && !e.ConditionalItems).length;
  console.log(`Wrote ${trimmed.length} nodes (${leaves} leaves) to ${path.relative(process.cwd(), OUT_FILE)}`);

  const members = loadItemMembers();
  const locations = buildLocations(members, ids);
  fs.writeFileSync(LOCATIONS_FILE, JSON.stringify(locations, null, 2) + "\n");

  const regionCount = Object.keys(locations).length;
  const locationCount = Object.values(locations).reduce((sum, list) => sum + list.length, 0);
  console.log(`Wrote ${locationCount} locations across ${regionCount} regions to ${path.relative(process.cwd(), LOCATIONS_FILE)}`);

  const allLocations = buildAllLocations(members);
  fs.writeFileSync(ALL_LOCATIONS_FILE, JSON.stringify(allLocations, null, 2) + "\n");
  console.log(`Wrote ${allLocations.length} ordered locations to ${path.relative(process.cwd(), ALL_LOCATIONS_FILE)}`);

  const shuffledItemIds = buildShuffledItemIds(members, ids);
  fs.writeFileSync(SHUFFLED_ITEMS_FILE, JSON.stringify(shuffledItemIds, null, 2) + "\n");
  console.log(`Wrote ${shuffledItemIds.length} shuffled item ids to ${path.relative(process.cwd(), SHUFFLED_ITEMS_FILE)}`);
}

main();
