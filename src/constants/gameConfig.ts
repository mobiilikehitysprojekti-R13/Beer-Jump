import { Dimensions } from "react-native"

const { width, height } = Dimensions.get("window")

export const SCREEN_WIDTH = width
export const SCREEN_HEIGHT = height

export const GRAVITY = 0.4
export const JUMP_VELOCITY = -14
export const MAX_FALL_SPEED = 20
export const SCORE_PER_UNIT = 10
export const PLATFORM_POOL_SIZE = 30
export const MAX_ENEMIES = 8
export const MAX_POWER_UPS_ON_SCREEN = 3
export const PLATFORM_WIDTH = 80
export const PLATFORM_HEIGHT = 16
export const PLAYER_WIDTH = 48
export const PLAYER_HEIGHT = 48
export const CRUMBLE_DELAY_MS = 300
export const DISAPPEAR_VISIBLE_MS = 2000
export const DISAPPEAR_FADE_MS = 500
export const JETPACK_DURATION_MS = 5000
export const PRETZEL_JUMP_MULTIPLIER = 3
export const ROCKET_VELOCITY = -40
export const XP_PER_SCORE_UNIT = 0.1
export const COINS_PER_SCORE_UNIT = 0.01

export const createSeededRNG = (seed: number) => {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0xffffffff
  }
}
