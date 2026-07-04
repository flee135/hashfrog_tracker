// Provisional casual configuration for the MM reachability evaluator. A later
// phase refines these from the generator's extra-starting-items and settings
// strings; for now they encode vanilla-casual defaults.

// Setting* pseudo-nodes that are ON in casual. REQ_CASUAL models each generator
// setting as a boolean node, so seeding these true resolves the setting-gated
// branches (the complementary "Not*"/"Is*" nodes are left off).
export const CASUAL_SETTINGS = [
  "SettingNotRandomizeEnemies",
  "SettingNotRandomizedItemGreatBayBossKey",
  "SettingNotRandomizedBottleCatchHotSpringWater",
  "SettingNotRandomizedBottleCatchSpringWater",
  "SettingDamageModeDefault",
  "SettingNotDeathMoonCrash",
  "SettingCharacterAdultLink",
  "Setting Can Shield",
];

// Tricks allowed in this casual preset. Every IsTrick node is off by default --
// the evaluator drops it from the graph. Listing a trick id here keeps its node in
// the graph so its own rule is evaluated (the trick's cost still applies); it is
// NOT seeded, which would assert the trick true and bypass its requirements.
export const ENABLED_TRICKS = [
  "Lensless Chests",
  "Pinnacle Rock without Seahorse",
  "Run Through Poisoned Water",
  "Deku Palace Bean Skip",
  "WFT 2nd Floor With Hookshot",
  "Exit OSH Without Goron",
  "Day 2 Grave Without Lens of Truth",
  "Climb Stone Tower with One Transformation",
  "SHT Lensless Walls/Ceilings",
];

// Items the player is assumed to hold from the start in casual. Only ids the
// logic actually gates on are needed (Ocarina and songs are baked in and never
// referenced). Shop consumables are always buyable while shops are unrandomized.
export const CASUAL_STARTING_ITEMS = [
  "StartingSword",
  "StartingShield",
  "ShopItemTradingPostRedPotion",
  "ShopItemTradingPostGreenPotion",
  "ShopItemTradingPostShield",
  "ShopItemWitchRedPotion",
  "ShopItemWitchGreenPotion",
  "ShopItemBombsBombchu10",
  "ShopItemGormanBrosMilk",
];
