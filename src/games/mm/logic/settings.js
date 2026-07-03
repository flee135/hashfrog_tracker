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
