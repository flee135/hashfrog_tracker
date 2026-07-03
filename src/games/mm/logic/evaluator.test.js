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
  const nodes = buildNodes([
    { Id: "A", RequiredItems: [], ConditionalItems: [] },
    { Id: "B", RequiredItems: [], ConditionalItems: [] },
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

  it("marks a rule-less shuffled leaf reachable while other leaves stay gated", () => {
    const graph = buildNodes([
      { Id: "FreeChest", RequiredItems: [], ConditionalItems: [] }, // shuffled check, no rule
      { Id: "NightChest", RequiredItems: [], ConditionalItems: [], TimeAvailable: "Night1" },
      { Id: "Trick", RequiredItems: [], ConditionalItems: [] }, // non-item gating leaf
    ]);
    const shuffled = new Set(["FreeChest", "NightChest"]);
    const mask = computeReachability(graph, new Set(), shuffled);

    // A shuffled item's rule-less vanilla location is always reachable.
    expect(mask.get("FreeChest")).toBe(TIME_FULL);
    expect(mask.get("NightChest")).toBe(TIME_BITS.Night1); // honors its available time
    // A non-item leaf only counts when seeded, so it stays unreachable.
    expect(mask.get("Trick")).toBe(0);
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
});
