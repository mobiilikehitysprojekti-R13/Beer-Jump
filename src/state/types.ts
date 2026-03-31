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
export type GamePhase = "home" | "playing" | "gameover" | "leaderboard" | "settings" | "shop"

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
