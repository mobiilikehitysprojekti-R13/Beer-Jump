import { makeMutable } from "react-native-reanimated"
import { ActivePowerUpState, Enemy, Platform, PowerUp } from "./types"
import {
  SCREEN_WIDTH,
  SCREEN_HEIGHT,
  PLAYER_WIDTH,
  PLAYER_HEIGHT,
  MAX_ENEMIES,
  ENEMY_HEIGHT,
  MAX_POWER_UPS_ON_SCREEN,
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
// Power-up object pool
//
// Fixed pool of MAX_POWER_UPS_ON_SCREEN inactive PowerUp objects.
// Follows the exact same pattern as the enemy pool — allocated once at module
// load, mutated in place by recyclePlatforms() at spawn time, never reassigned.
//
// Spawn rules (enforced by recyclePlatforms):
//   • Only on non-moving, non-enemy rows (moving platforms can't hold items;
//     enemy rows have no platforms beneath them)
//   • Only one power-up per row
//   • If activePowerUpState.type !== "none", no new power-ups are collected
//     (items remain on their platforms, visible but untouchable until the
//     active power-up expires)
//
// Power-ups are positioned sitting ON TOP of their platform:
//   powerUp.y = platform.y - POWER_UP_HEIGHT - POWER_UP_PLATFORM_OFFSET
// This is set at spawn time in recyclePlatforms.
// ---------------------------------------------------------------------------
function createPowerUpPool(): PowerUp[] {
  const pool: PowerUp[] = []
  for (let i = 0; i < MAX_POWER_UPS_ON_SCREEN; i++) {
    pool.push({
      id: i,
      x: 0,
      y: -9999,
      type: "pretzelBoots", // default type — overwritten at spawn
      active: false,
    })
  }
  return pool
}

export const powerUps = makeMutable<PowerUp[]>(createPowerUpPool())

// ---------------------------------------------------------------------------
// Pretzel Boots pending flag
//
// Set to true when Pretzel Boots are collected mid-air (no bounce on the same
// frame). Consumed and cleared on the next platform bounce in gameTick.
// Reset to false in restartRun Step B2.
// ---------------------------------------------------------------------------
export const pretzelBootsPending = makeMutable(false)

// ---------------------------------------------------------------------------
// Active power-up state
//
// Single SharedValue holding all timed power-up state. Written exclusively
// from the UI thread worklet in gameTick (collection + tick + expiry).
// Read by:
//   - gameTick: physics override per frame, enemy invincibility guard
//   - HUD (via useAnimatedReaction): drives the timer bar UI
//   - GameCanvas: drives the visual indicator on BeerGuy (future sprite)
//
// Fields:
//   type       — "none" when no power-up is active
//   timerMs    — countdown in ms; 0 when inactive
//   invincible — true while jetpack or bottleRocket is active
//
// Invariant: if type === "none" then timerMs === 0 and invincible === false.
// The expiry path in gameTick enforces this in one atomic write via .modify().
//
// pretzelBoots NEVER writes to this state — it is instant (single bounce
// multiplier applied in the same frame as platform collision) and has no
// timed active window.
// ---------------------------------------------------------------------------
export const activePowerUpState = makeMutable<ActivePowerUpState>({
  type: "none",
  timerMs: 0,
  invincible: false,
})

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
// Character animation state
// isAirborne        — true while player vertical velocity is non-zero.
// jumpAnimActive    — true during one-shot jump animation playback (frames 1-6).
// jumpAnimStartTime — globalTime timestamp when jump animation started.
// ---------------------------------------------------------------------------
export const isAirborne = makeMutable(false)
export const jumpAnimActive = makeMutable(false)
export const jumpAnimStartTime = makeMutable(0)

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
