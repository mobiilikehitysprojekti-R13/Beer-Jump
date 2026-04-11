import { makeMutable } from "react-native-reanimated"
import { Enemy, Platform } from "./types"
import {
  SCREEN_WIDTH,
  SCREEN_HEIGHT,
  PLAYER_WIDTH,
  PLAYER_HEIGHT,
  MAX_ENEMIES,
  ENEMY_HEIGHT,
} from "../constants/gameConfig"
import { createPlatformPool } from "../engine/PlatformGenerator"

// ---------------------------------------------------------------------------
// Player position & velocity
// Written exclusively from the UI thread worklet (useFrameCallback).
// ---------------------------------------------------------------------------
export const playerX = makeMutable(SCREEN_WIDTH / 2 - PLAYER_WIDTH / 2)
export const playerY = makeMutable(SCREEN_HEIGHT - 200)
export const velocityX = makeMutable(0)
export const velocityY = makeMutable(0)

// ---------------------------------------------------------------------------
// Camera & world
// cameraY = world-Y of the top edge of the visible screen.
// Starts at 0, only ever decreases as the player rises above world-Y 0.
// Score is derived from how far cameraY has decreased: Math.abs(cameraY) / SCORE_PER_UNIT.
// Written exclusively from the UI thread worklet.
// ---------------------------------------------------------------------------
export const cameraY = makeMutable(0)
export const score = makeMutable(0)
export const seed = makeMutable(0) // set once at run start from JS thread, then read-only

// RNG state for recyclePlatforms — array so the worklet can read and write
// all generator state across frames without closures.
// rngState[0] — LCG seed (persisted across frames for recyclePlatforms)
// rngState[1] — column index of the most recently placed platform (persisted
//               so nextColumn avoids repeating columns across frame boundaries)
// rngState[2] — rows generated this run (incremented by recyclePlatforms after
//               each row placement; read by getDifficultyConfig to select tier)
export const rngState = makeMutable<number[]>([0, 1, 0])

// ---------------------------------------------------------------------------
// Platform object pool
// Allocated once at module load time — PLATFORM_POOL_SIZE objects with
// inactive placeholder values. resetPlatforms() mutates these in place at
// run start. The array reference never changes — Reanimated 4 does not
// reliably propagate a full array reassignment from the JS thread to the
// UI thread worklet, so we always mutate the existing objects instead.
// ---------------------------------------------------------------------------
export const platforms = makeMutable<Platform[]>(createPlatformPool())

// ---------------------------------------------------------------------------
// Enemy object pool
// Fixed pool of MAX_ENEMIES inactive Enemy objects. Follows the same pattern
// as platforms — allocated once, mutated in place, never reassigned.
// resetEnemies() deactivates all slots at run start.
// recyclePlatforms() spawns enemies into inactive slots as new rows are placed.
// ---------------------------------------------------------------------------
function createEnemyPool(): Enemy[] {
  const pool: Enemy[] = []
  for (let i = 0; i < MAX_ENEMIES; i++) {
    pool.push({
      id: i,
      x: 0,
      y: -9999,
      width: 0, // set at spawn time to 2 × colWidth (2 column widths)
      height: ENEMY_HEIGHT,
      velocityX: 0,
      patrolLeft: 0,
      patrolRight: SCREEN_WIDTH,
      alive: false,
      active: false,
    })
  }
  return pool
}

export const enemies = makeMutable<Enemy[]>(createEnemyPool())

// ---------------------------------------------------------------------------
// Global animation clock
// Written every frame in gameTick: globalTime.value = timeSinceFirstFrame.
// Reset to 0 in restartRun Step B.
//
// Used by AnimatedPlatformImage in GameCanvas to drive the disappearing
// platform spritesheet cycle. All disappearing platform slots read the same
// value and arrive at the same frame index independently — they animate in
// unison without any per-instance timer state on the Platform object.
//
// Written exclusively from the UI thread worklet (useFrameCallback).
// ---------------------------------------------------------------------------
export const globalTime = makeMutable(0)

// ---------------------------------------------------------------------------
// Game control flags
// These are the shared values written from the JS thread:
//   isPaused       — HUD pause button / AppState background listener
//   isDead         — set true the frame death is detected; prevents runOnJS firing twice
//   gyroX          — gyroscope JS listener pushes ~every 16ms
//   touchLeft      — Pressable onPressIn/Out
//   touchRight     — Pressable onPressIn/Out
//   touchControlsEnabled — written once when settings change
//
// All other shared values above are written exclusively from the UI thread worklet.
// Reanimated shared values are thread-safe for concurrent access — this is correct and intentional.
// ---------------------------------------------------------------------------
export const isPaused = makeMutable(false)
export const isDead = makeMutable(false)
export const gyroX = makeMutable(0) // raw gyroscope Y-axis rate (rad/s), portrait mode
export const touchLeft = makeMutable(false)
export const touchRight = makeMutable(false)
export const touchControlsEnabled = makeMutable(true) // mirrors appStore.touchControlsEnabled
