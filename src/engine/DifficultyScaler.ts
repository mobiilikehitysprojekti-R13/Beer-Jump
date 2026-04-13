"worklet"

import { DifficultyConfig } from "../state/types"

// ---------------------------------------------------------------------------
// DifficultyScaler
//
// Pure worklet module no class, no singleton, no shared state.
// getDifficultyConfig(rowsGenerated) is called directly inside recyclePlatforms
// (UI thread) once per recycled row.
//
// Tier thresholds (rows generated):
//   Tier 1 Intro     0–49    wide platforms (3/row), forgiving mix, no enemies
//   Tier 2 Rising    50–99   wide platforms (3/row), NORMAL mix, enemies start
//   Tier 3 Pressure  100–199 medium platforms (2/row), harder mix, faster enemies
//   Tier 4 Hard      200–349 single platforms (1/row), aggressive mix
//   Tier 5 Brutal    350+    single platforms (1/row), maximum difficulty
//
// platformsPerRow controls how many adjacent columns are filled per row.
// The pool stride is always PLATFORMS_PER_ROW (3 = max). Slots beyond
// platformsPerRow in each stride are left inactive zero rendering cost.
// ---------------------------------------------------------------------------

const TIER_ROW_THRESHOLDS = [0, 50, 100, 200, 350]

// typeProbabilities are raw per-type weights summing to 1.0.
// pickType accumulates them inline during selection.
const TIERS: DifficultyConfig[] = [
  // Tier 1 Intro (rows 0–49)
  // 3 platforms per row → wide grouped surface. No enemies. Very forgiving mix.
  {
    tier: 1,
    platformsPerRow: 3,
    typeProbabilities: {
      static: 0.75,
      moving: 0.12,
      breakable: 0.06,
      disappearing: 0.05,
      fake: 0.02,
    },
    enemySpeedMultiplier: 1.0,
    enemiesEnabled: false,
  },
  // Tier 2 Rising (rows 50–99)
  // 3 platforms per row still player has learned the arc, enemies introduced.
  {
    tier: 2,
    platformsPerRow: 3,
    typeProbabilities: {
      static: 0.6,
      moving: 0.18,
      breakable: 0.1,
      disappearing: 0.08,
      fake: 0.04,
    },
    enemySpeedMultiplier: 1.0,
    enemiesEnabled: true,
  },
  // Tier 3 Pressure (rows 100–199)
  // 2 platforms per row landing surface narrows. Harder mix.
  {
    tier: 3,
    platformsPerRow: 2,
    typeProbabilities: {
      static: 0.4,
      moving: 0.25,
      breakable: 0.15,
      disappearing: 0.12,
      fake: 0.08,
    },
    enemySpeedMultiplier: 1.25,
    enemiesEnabled: true,
  },
  // Tier 4 Hard (rows 200–349)
  // 1 platform per row targets narrow, must aim precisely.
  {
    tier: 4,
    platformsPerRow: 1,
    typeProbabilities: {
      static: 0.3,
      moving: 0.28,
      breakable: 0.18,
      disappearing: 0.14,
      fake: 0.1,
    },
    enemySpeedMultiplier: 1.5,
    enemiesEnabled: true,
  },
  // Tier 5 Brutal (rows 350+)
  // 1 platform per row maximum difficulty, enemies at 2× speed.
  {
    tier: 5,
    platformsPerRow: 1,
    typeProbabilities: {
      static: 0.2,
      moving: 0.28,
      breakable: 0.2,
      disappearing: 0.2,
      fake: 0.12,
    },
    enemySpeedMultiplier: 2.0,
    enemiesEnabled: true,
  },
]

// ---------------------------------------------------------------------------
// getDifficultyConfig
//
// Worklet-safe pure function. Called once per recycled row inside
// recyclePlatforms cheap: one linear scan of 5 thresholds.
// ---------------------------------------------------------------------------
export function getDifficultyConfig(rowsGenerated: number): DifficultyConfig {
  "worklet"
  for (let i = TIER_ROW_THRESHOLDS.length - 1; i >= 0; i--) {
    if (rowsGenerated >= TIER_ROW_THRESHOLDS[i]) return TIERS[i]
  }
  return TIERS[0]
}
