// ---------------------------------------------------------------------------
// GamePhase — canonical source of truth for all phase values.
//
// "home"        — HomeOverlay visible, game loop idle
// "playing"     — game running, HUD visible
// "gameover"    — GameOverOverlay visible, score frozen
// "leaderboard" — LeaderboardOverlay visible (Phase 4)
// "settings"    — SettingsOverlay visible (Phase 5)
// "shop"        — ShopOverlay visible (Phase 5)
//
// Note: "paused" is NOT a phase — pause is handled via isPaused SharedValue
// inside the HUD, orthogonal to phase. This keeps the worklet guard simple.
//
// Previous values "idle" | "running" | "paused" renamed to "home" | "playing"
// to match GameScreen's actual local phase type and architecture doc §5.
// appStore.gamePhase default updated to "home" accordingly.
// ---------------------------------------------------------------------------
export type GamePhase =
  | "home"
  | "playing"
  | "gameover"
  | "leaderboard"
  | "settings"
  | "shop"

// ---------------------------------------------------------------------------
// DifficultyConfig produced by DifficultyScaler.getDifficultyConfig().
// Consumed by PlatformGenerator.recyclePlatforms() on every recycled row.
// current tier number (1–5), used for logging
// typeProbabilities cumulative upper bounds for pickType LCG selection
// enemySpeedMultiplier multiplied by ENEMY_BASE_SPEED at enemy spawn
// enemiesEnabled false for Tier 1 (rows 0–49), true from Tier 2 onward
// ---------------------------------------------------------------------------
export type DifficultyConfig = {
  tier: number
  platformsPerRow: number
  typeProbabilities: {
    static: number
    moving: number
    breakable: number
    disappearing: number
    fake: number
  }
  enemySpeedMultiplier: number
  enemiesEnabled: boolean
}

export type PlatformType =
  | "static"
  | "moving"
  | "breakable"
  | "disappearing"
  | "fake"

export type Platform = {
  id: number
  x: number
  y: number
  type: PlatformType
  active: boolean
  moveDirection: 1 | -1
  moveSpeed: number
  moveBoundaryLeft: number
  moveBoundaryRight: number
  crumbling: boolean
  crumbleTimer: number
  opacity: number
  visible: boolean
  visibleTimer: number
}

export type Enemy = {
  id: number
  x: number
  y: number
  width: number
  height: number
  velocityX: number
  patrolLeft: number
  patrolRight: number
  alive: boolean
  active: boolean
}

export type PowerUpType =
  | "jetpack"
  | "foamHat"
  | "pretzelBoots"
  | "bottleRocket"

export type PowerUp = {
  id: number
  x: number
  y: number
  type: PowerUpType
  active: boolean
}

// ---------------------------------------------------------------------------
// ActivePowerUpState
//
// Held in a single SharedValue<ActivePowerUpState> so the worklet reads one
// object instead of four separate shared values every frame.
//
// Fields:
//   type        — which power-up is active ("none" = no power-up)
//   timerMs     — ms remaining; counts down each frame; 0 when inactive
//   invincible  — true while the player cannot be killed by enemies
//
// Power-up invincibility rules:
//   jetpack       → invincible (moving fast, keg thrusters)
//   bottleRocket  → invincible (short violent burst)
//   foamHat       → NOT invincible (slow float, enemies can still hit)
//   pretzelBoots  → instant, no timed state, no invincibility flag
//
// "none" is a string sentinel rather than null so the worklet can compare
// without a null check (worklets handle string === "none" safely).
// ---------------------------------------------------------------------------
export type ActivePowerUpState = {
  type: PowerUpType | "none"
  timerMs: number
  invincible: boolean
}
