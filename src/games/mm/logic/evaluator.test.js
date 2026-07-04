import LOGIC from "../data/logic-casual.json";
import MMEvaluator, { buildNodes, computeReachability, parseTime, TIME_BITS, TIME_FULL } from "./evaluator";

describe("parseTime", () => {
  it("treats missing/None as the full mask", () => {
    expect(parseTime(undefined)).toBe(TIME_FULL);
    expect(parseTime("")).toBe(TIME_FULL);
  });

  it("parses single and multiple flags", () => {
    expect(parseTime("Night1")).toBe(TIME_BITS.Night1);
    expect(parseTime("Day1, Night1")).toBe(TIME_BITS.Day1 | TIME_BITS.Night1);
  });
});

describe("computeReachability (synthetic)", () => {
  // A, B and Unreachable are external input ids (not nodes in the graph), the way a
  // dropped gating input is referenced: they resolve to 0 until seeded. Every node
  // below carries a rule, so none is a free spot on its own.
  const nodes = buildNodes([
    { Id: "L1", RequiredItems: ["A"], ConditionalItems: [] }, // A
    { Id: "L2", RequiredItems: [], ConditionalItems: [["A"], ["B"]] }, // A OR B
    { Id: "L3", RequiredItems: ["A", "B"], ConditionalItems: [] }, // A AND B
    { Id: "L4", RequiredItems: ["L1"], ConditionalItems: [] }, // chains through L1
    { Id: "T1", RequiredItems: ["A"], ConditionalItems: [], TimeAvailable: "Night1" },
    { Id: "Loc", RequiredItems: ["Unreachable"], ConditionalItems: [] }, // gated by a missing input
  ]);
  const solve = seeded => computeReachability(nodes, new Set(seeded));

  it("leaves nothing reachable with no inputs", () => {
    const mask = solve([]);
    expect(mask.get("L1")).toBe(0);
    expect(mask.get("L2")).toBe(0);
  });

  it("resolves AND / OR-of-AND and chains through computed nodes", () => {
    const mask = solve(["A"]);
    expect(mask.get("L1")).toBe(TIME_FULL); // required A
    expect(mask.get("L2")).toBe(TIME_FULL); // A OR B
    expect(mask.get("L3")).toBe(0); // needs A AND B
    expect(mask.get("L4")).toBe(TIME_FULL); // fixpoint: A -> L1 -> L4

    expect(solve(["A", "B"]).get("L3")).toBe(TIME_FULL);
  });

  it("restricts a time-gated node to its mask", () => {
    expect(solve(["A"]).get("T1")).toBe(TIME_BITS.Night1);
  });

  it("lets a held id satisfy other nodes' rules without self-unlocking its own", () => {
    // Holding Loc's own id must not mark Loc reachable -- its rule is still unmet.
    expect(solve([]).get("Loc")).toBe(0);
    expect(solve(["Loc"]).get("Loc")).toBe(0);
    // But holding the id Loc requires does unlock it (possession satisfies the reference).
    expect(solve(["Unreachable"]).get("Loc")).toBe(TIME_FULL);
  });

  it("gates a shuffled item by possession while non-items still propagate", () => {
    // Item is a shuffled item reachable via A; Consumer requires Item.
    const graph = buildNodes([
      { Id: "A", RequiredItems: [], ConditionalItems: [] },
      { Id: "Item", RequiredItems: ["A"], ConditionalItems: [] },
      { Id: "Consumer", RequiredItems: ["Item"], ConditionalItems: [] },
    ]);
    const shuffled = new Set(["Item"]);

    // Reaching Item's location (via A) does NOT satisfy Consumer's requirement.
    const reachedOnly = computeReachability(graph, new Set(["A"]), shuffled);
    expect(reachedOnly.get("Item")).toBe(TIME_FULL); // its own location is reachable
    expect(reachedOnly.get("Consumer")).toBe(0); // but Item is not possessed

    // Holding Item satisfies the requirement (possession).
    expect(computeReachability(graph, new Set(["Item"]), shuffled).get("Consumer")).toBe(TIME_FULL);

    // Without the shuffled flag the reference propagates transitively (old behavior).
    expect(computeReachability(graph, new Set(["A"])).get("Consumer")).toBe(TIME_FULL);
  });

  it("propagates an unshuffled check transitively but gates a shuffled one", () => {
    // FairyMagic requires the Clock Town stray fairy. Unshuffled, the fairy sits at
    // its rule-less location, so reaching it frees FairyMagic with nothing held;
    // shuffled, a random item sits there, so possession is required instead.
    const graph = buildNodes([
      { Id: "StrayFairy", RequiredItems: [], ConditionalItems: [] },
      { Id: "FairyMagic", RequiredItems: ["StrayFairy"], ConditionalItems: [] },
    ]);

    // Unshuffled (not possession-gated): the reference resolves to the location's
    // own reachability, so FairyMagic is free from the start.
    const unshuffled = computeReachability(graph, new Set());
    expect(unshuffled.get("StrayFairy")).toBe(TIME_FULL);
    expect(unshuffled.get("FairyMagic")).toBe(TIME_FULL);

    // Shuffled (possession-gated): reaching the location does not grant the fairy.
    const shuffled = computeReachability(graph, new Set(), new Set(["StrayFairy"]));
    expect(shuffled.get("StrayFairy")).toBe(TIME_FULL); // location reachable
    expect(shuffled.get("FairyMagic")).toBe(0); // but not possessed
  });

  it("chains an unshuffled ruled check through its dependents, gating blocks it", () => {
    // SeaHorse needs the pictobox to reach; HeartPieceSeaHorse needs SeaHorse. When
    // SeaHorse is not shuffled, holding the pictobox chains through to the heart
    // piece without ever holding a SeaHorse item.
    const graph = buildNodes([
      { Id: "Pictobox", RequiredItems: [], ConditionalItems: [] },
      { Id: "SeaHorse", RequiredItems: ["Pictobox"], ConditionalItems: [] },
      { Id: "HeartPieceSeaHorse", RequiredItems: ["SeaHorse"], ConditionalItems: [] },
    ]);

    const unshuffled = computeReachability(graph, new Set(["Pictobox"]));
    expect(unshuffled.get("HeartPieceSeaHorse")).toBe(TIME_FULL);

    // Shuffled: SeaHorse is possession-gated, so the heart piece stays locked until
    // a SeaHorse item is actually held.
    const shuffled = computeReachability(graph, new Set(["Pictobox"]), new Set(["SeaHorse"]));
    expect(shuffled.get("HeartPieceSeaHorse")).toBe(0);
  });

  it("treats every rule-less node as a reachable spot and a dropped id as 0", () => {
    // Gating inputs are excluded from the graph upstream, so here every leaf is a
    // real spot: reachable at its available time. A rule referencing an id that was
    // dropped (absent from the graph) reads it as 0.
    const graph = buildNodes([
      { Id: "FreeChest", RequiredItems: [], ConditionalItems: [] },
      { Id: "NightChest", RequiredItems: [], ConditionalItems: [], TimeAvailable: "Night1" },
      { Id: "NeedsTrick", RequiredItems: ["DroppedTrick"], ConditionalItems: [] },
    ]);
    const mask = computeReachability(graph, new Set());

    expect(mask.get("FreeChest")).toBe(TIME_FULL);
    expect(mask.get("NightChest")).toBe(TIME_BITS.Night1); // honors its available time
    expect(mask.get("NeedsTrick")).toBe(0); // DroppedTrick has no node -> reads as 0
  });
});

describe("MMEvaluator (casual graph)", () => {
  const countAvailable = () => LOGIC.filter(entry => MMEvaluator.isLocationAvailable(entry.Id)).length;

  it("bootstraps a sane baseline from the casual seed alone", () => {
    MMEvaluator.updateItems({});
    const baseline = countAvailable();
    expect(baseline).toBeGreaterThan(50);
    expect(baseline).toBeLessThan(LOGIC.length);
  });

  it("gains reachability monotonically as items are held", () => {
    MMEvaluator.updateItems({});
    const baseline = countAvailable();

    const everything = Object.fromEntries(LOGIC.map(entry => [entry.Id, 1]));
    MMEvaluator.updateItems(everything);
    expect(countAvailable()).toBeGreaterThan(baseline);
  });

  it("cascades a held bottle into the Any Bottle macro without unlocking its own location", () => {
    MMEvaluator.updateItems({});
    expect(MMEvaluator.isLocationAvailable("Any Bottle")).toBe(false);

    // Holding the bottle satisfies the Any Bottle reference (possession), but its
    // own vanilla location (Snowhead clear + Goron Mask + magic) stays unreachable.
    MMEvaluator.updateItems({ ItemBottleGoronRace: 1 });
    expect(MMEvaluator.isLocationAvailable("ItemBottleGoronRace")).toBe(false);
    expect(MMEvaluator.isLocationAvailable("Any Bottle")).toBe(true);
  });

  it("does not transitively unlock a check through a shuffled item's vanilla location", () => {
    // Toilet Hand needs a trade item (paper). Moon's Tear is what you turn in to
    // get the Land Deed in vanilla, but a randomizer puts a random item there, so
    // holding Moon's Tear alone must NOT make the Land Deed -- or Toilet Hand --
    // available. Only actually holding a deed/letter does.
    MMEvaluator.updateItems({ TradeItemMoonTear: 1 });
    expect(MMEvaluator.isLocationAvailable("TradeItemLandDeed")).toBe(true); // its own location is reachable
    expect(MMEvaluator.isLocationAvailable("HeartPieceNotebookHand")).toBe(false);

    MMEvaluator.updateItems({ TradeItemKafeiLetter: 1 });
    expect(MMEvaluator.isLocationAvailable("HeartPieceNotebookHand")).toBe(true);
  });

  it("unlocks Town Great Fairy from an unshuffled Clock Town stray fairy, no mask needed", () => {
    // MaskGreatFairy needs CollectibleStrayFairyClockTown, which resolves through a
    // rule-less laundry-pool access macro (kept in the graph as a real spot). Left
    // unshuffled, that spot is freely reachable, so the reward unlocks from the
    // casual seed alone -- previously it required a Deku/Goron/Great Fairy mask.
    const allIds = new Set(LOGIC.map(entry => entry.Id));
    const unshuffledFairy = new Set(allIds);
    unshuffledFairy.delete("CollectibleStrayFairyClockTown");

    MMEvaluator.setEnabledChecks(unshuffledFairy);
    MMEvaluator.updateItems({}); // casual seed only, no masks
    expect(MMEvaluator.isLocationAvailable("MaskGreatFairy")).toBe(true);

    // Shuffled instead, the reward stays possession-gated on holding the fairy.
    MMEvaluator.setEnabledChecks(allIds);
    MMEvaluator.updateItems({});
    expect(MMEvaluator.isLocationAvailable("MaskGreatFairy")).toBe(false);
  });
});
