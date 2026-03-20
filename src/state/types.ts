export type GamePhase = "idle" | "running" | "paused" | "gameover"

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
