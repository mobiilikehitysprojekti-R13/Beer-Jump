import { Platform, PlatformType } from "../state/types"
import {
  PLATFORM_POOL_SIZE,
  PLATFORM_HEIGHT,
  PLATFORM_ROW_HEIGHT,
  PLATFORM_COLUMNS,
  FLOOR_PLATFORMS,
  PLATFORMS_PER_ROW,
  SCREEN_WIDTH,
  SCREEN_HEIGHT,
} from "../constants/gameConfig"

// ---------------------------------------------------------------------------
// Column layout
//
// Platforms tile edge-to-edge within their column.PLATFORM_WIDTH_APPROX in
// gameConfig.ts is an approximation for rendering only. Collision and
// generation always use the exact runtime value SCREEN_WIDTH / PLATFORM_COLUMNS.
// ---------------------------------------------------------------------------
function colWidth(): number {
  "worklet"
  return SCREEN_WIDTH / PLATFORM_COLUMNS
}

function columnX(col: number): number {
  "worklet"
  return col * colWidth()
}

// ---------------------------------------------------------------------------
// lcgNext
// One LCG step. Returns [nextSeed, randomFloat in [0, 1)].
// Worklet-safe: pure numeric computation, no closures.
// ---------------------------------------------------------------------------
function lcgNext(s: number): [number, number] {
  "worklet"
  const next = (s * 1664525 + 1013904223) & 0xffffffff
  return [next, (next >>> 0) / 0xffffffff]
}

// ---------------------------------------------------------------------------
// nextStartColumn
// Picks a random starting column for a row such that all PLATFORMS_PER_ROW
// consecutive columns fit without wrapping, and the first column differs from
// prevCol. Returns the start column for the row.
//
// Max valid start = PLATFORM_COLUMNS - PLATFORMS_PER_ROW
// Example with 6 columns and PLATFORMS_PER_ROW=2: start can be 0..4.
// Example with 6 columns and PLATFORMS_PER_ROW=1: start can be 0..5.
// ---------------------------------------------------------------------------
function nextStartColumn(s: number, prevCol: number): [number, number, number] {
  "worklet"
  const maxStart = PLATFORM_COLUMNS - PLATFORMS_PER_ROW
  let rand: number
  ;[s, rand] = lcgNext(s)
  let col = Math.floor(rand * (maxStart + 1))
  if (col > maxStart) col = maxStart
  // Avoid starting at the same column as the previous row's first platform
  if (col === prevCol) col = col + 1 > maxStart ? 0 : col + 1
  return [s, rand, col]
}

// ---------------------------------------------------------------------------
// pickType
// Selects a platform type from the regular-row probability table using one
// LCG step. Returns [nextSeed, type].
//
// Type mix (placeholder — DifficultyScaler will override this in Phase 2):
//   55% static
//   20% moving
//   10% breakable
//   10% disappearing
//    5% fake
//
// Floor row platforms always use "static" — BeerGuy spawns above the floor
// and the first collision must always succeed.
// ---------------------------------------------------------------------------
function pickType(s: number): [number, PlatformType] {
  "worklet"
  let rand: number
  ;[s, rand] = lcgNext(s)
  let type: PlatformType
  if (rand < 0.55) {
    type = 'static'
  } else if (rand < 0.75) {
    type = 'moving'
  } else if (rand < 0.85) {
    type = 'breakable'
  } else if (rand < 0.95) {
    type = 'disappearing'
  } else {
    type = 'fake'
  }
  return [s, type]
}

// ---------------------------------------------------------------------------
// setPlatform
// Writes all fields of a Platform object in place, then applies type-specific
// field overrides. Always resets crumbling/crumbleTimer so recycled breakable
// platforms start clean.
//
// Moving platform patrol boundaries are set to ±1 column from the spawn
// column so the platform stays within a predictable horizontal range.
// moveSpeed is hardcoded here as a starting tuning value — DifficultyScaler
// will pass a range in Phase 2.
// ---------------------------------------------------------------------------
function setPlatform(p: Platform, x: number, y: number, type: PlatformType ): void {
  "worklet"
  const cw = colWidth()

  // Base reset — all fields to clean defaults
  p.x = x
  p.y = y
  p.type = type
  p.active = true
  p.moveDirection = 1
  p.moveSpeed = 0
  p.moveBoundaryLeft = 0
  p.moveBoundaryRight = SCREEN_WIDTH
  p.crumbling = false
  p.crumbleTimer = 0
  p.opacity = 1
  p.visible = true
  p.visibleTimer = 0

  // Type-specific overrides
  if (type === 'moving') {
    // Patrol one column left and one column right of spawn position,
    // clamped so the platform never leaves the screen.
    const patrolLeft = x - cw
    const patrolRight = x + cw * 2 // +2 because platform itself is 1 cw wide
    p.moveBoundaryLeft = patrolLeft < 0 ? 0 : patrolLeft
    p.moveBoundaryRight =
      patrolRight > SCREEN_WIDTH ? SCREEN_WIDTH : patrolRight
    p.moveSpeed = 0.12 // units/ms — tunable, roughly half of player walk speed
    p.moveDirection = 1
  }
  // disappearing: no per-instance fields — animation driven by GV.globalTime
  // breakable: crumbling/crumbleTimer already reset above
  // fake: no overrides needed
  // static: no overrides needed
}

// ---------------------------------------------------------------------------
// createPlatformPool
// Pre-allocates the full pool at module load time. Array reference never
// changes — Reanimated 4 does not reliably propagate a full array replacement
// from JS thread to UI thread, so we always mutate existing objects.
// ---------------------------------------------------------------------------
export function createPlatformPool(): Platform[] {
  const pool: Platform[] = []
  for (let i = 0; i < PLATFORM_POOL_SIZE; i++) {
    pool.push({
      id: i,
      x: 0,
      y: -9999,
      type: "static",
      active: false,
      moveDirection: 1,
      moveSpeed: 0,
      moveBoundaryLeft: 0,
      moveBoundaryRight: SCREEN_WIDTH,
      crumbling: false,
      crumbleTimer: 0,
      opacity: 1,
      visible: true,
      visibleTimer: 0,
    })
  }
  return pool
}

// ---------------------------------------------------------------------------
// resetPlatforms
// Called via GV.platforms.modify() at run start (UI thread).
//
// Layout:
//   Indices 0..FLOOR_PLATFORMS-1:
//     Floor row — all PLATFORM_COLUMNS platforms side-by-side at floorY,
//     always "static". BeerGuy spawns above this and lands on it immediately.
//
//   Indices FLOOR_PLATFORMS..PLATFORM_POOL_SIZE-1:
//     Regular rows — PLATFORMS_PER_ROW slots consumed per row.
//     Each row sits PLATFORM_ROW_HEIGHT above the previous.
//     Platform type is chosen by pickType() using the LCG.
//
// Pool constraint check (not enforced at runtime, verify when tuning):
//   (PLATFORM_POOL_SIZE - FLOOR_PLATFORMS) must be divisible by PLATFORMS_PER_ROW
//   Current: (120 - 6) = 114, 114 / 2 = 57 rows ✓
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// safeRowTypes
// Ensures a row's type array never leaves the player with zero landable
// platforms. Called after pickType() assigns all slots in a row.
//
// Rule: if every slot in the row is "fake", force the first slot to "static".
// A single fake platform per row is intentional game design — the player can
// jump over it. An all-fake row is an unwinnable gap: the player has no
// platform to land on regardless of horizontal position.
//
// When PLATFORMS_PER_ROW = 1 (NORMAL mode), this never triggers because a
// single "fake" is always one slot, not "all slots". The guard is only
// meaningful at PLATFORMS_PER_ROW ≥ 2.
//
// types[] is mutated in place — avoids allocation inside a worklet.
// ---------------------------------------------------------------------------
function safeRowTypes(types: PlatformType[]): void {
  'worklet'
  let allFake = true
  for (let i = 0; i < types.length; i++) {
    if (types[i] !== 'fake') {
      allFake = false
      break
    }
  }
  if (allFake) {
    types[0] = 'static'
  }
}

export function resetPlatforms(pool: Platform[], seed: number): void {
  "worklet"
  let s = seed
  let rand: number

  const floorY = SCREEN_HEIGHT - 160
  const cw = colWidth()

  // Floor row — always static (BeerGuy must land here reliably on spawn)
  for (let col = 0; col < FLOOR_PLATFORMS; col++) {
    setPlatform(pool[col], col * cw, floorY, 'static')
  }

  // Regular rows — type chosen per-platform by pickType(), then validated
  // by safeRowTypes to prevent all-fake rows.
  let currentY = floorY
  let prevStartCol = 0

  // Reusable type buffer — fixed length, no dynamic allocation.
  // Array literal is safe here; this is run-start init, not per-frame.
  const rowTypes: PlatformType[] = ['static', 'static']

  let poolIndex = FLOOR_PLATFORMS
  while (poolIndex + PLATFORMS_PER_ROW <= PLATFORM_POOL_SIZE) {
    let startCol: number
    ;[s, rand, startCol] = nextStartColumn(s, prevStartCol)
    currentY -= PLATFORM_ROW_HEIGHT

    // Pick types for all slots in this row
    for (let offset = 0; offset < PLATFORMS_PER_ROW; offset++) {
      let type: PlatformType
      ;[s, type] = pickType(s)
      rowTypes[offset] = type
    }

    // Guarantee at least one landable platform per row
    safeRowTypes(rowTypes)

    for (let offset = 0; offset < PLATFORMS_PER_ROW; offset++) {
      setPlatform(
        pool[poolIndex + offset],
        columnX(startCol + offset),
        currentY,
        rowTypes[offset],
      )
    }

    poolIndex += PLATFORMS_PER_ROW
    prevStartCol = startCol
  }
}

// ---------------------------------------------------------------------------
// recyclePlatforms
// Called every frame inside useFrameCallback (UI thread).
//
// Finds platforms that have scrolled 1.5 screen heights below the camera
// bottom and repositions them above the current highest active platform,
// one PLATFORM_ROW_HEIGHT higher. Platforms are recycled in groups of
// PLATFORMS_PER_ROW to maintain the paired layout.
//
// setPlatform fully resets all fields including crumbling/crumbleTimer, so
// a deactivated breakable platform that gets recycled starts completely clean
// regardless of what type it is assigned.
//
// The offscreen check uses p.y regardless of p.active — deactivated breakable
// platforms (active = false) still have a valid world-Y and will be recycled
// normally when they scroll off camera.
//
// colWidth() is hoisted above the recycle loop — it is a constant for the
// lifetime of a run (screen dimensions don't change) but calling it inside
// the inner loop per recycled platform was a repeated division that adds up
// across many recycle events.
//
// RNG state (rngState[]):
//   [0] — LCG seed (persisted across frames)
//   [1] — start column of the most recently placed row
// ---------------------------------------------------------------------------
export function recyclePlatforms(
  platforms: Platform[],
  cameraY: number,
  rngState: number[],
): void {
  "worklet"
  const offscreenThreshold = cameraY + SCREEN_HEIGHT * 1.5

  // Find the highest platform Y (smallest world-Y).
  // Includes inactive platforms so deactivated breakables don't cause
  // new rows to spawn at a stale high-water mark.
  let minY = cameraY
  for (let i = 0; i < platforms.length; i++) {
    if (platforms[i].y < minY) {
      minY = platforms[i].y
    }
  }

  let s = rngState[0]
  let prevStartCol = rngState[1] !== undefined ? rngState[1] : 0
  let rand: number

  // Hoisted — constant for the run, avoids repeated division per recycle event
  const cw = colWidth()

  const step = PLATFORMS_PER_ROW

  // Reusable type buffer — fixed length, no dynamic allocation.
  const rowTypes: PlatformType[] = ['static', 'static']

  for (let i = 0; i + step <= platforms.length; i += step) {
    // Use world-Y of the first slot in the group regardless of active state
    if (platforms[i].y > offscreenThreshold) {
      let startCol: number
      ;[s, rand, startCol] = nextStartColumn(s, prevStartCol)

      const newY = minY - PLATFORM_ROW_HEIGHT

      // Pick types, then guarantee at least one landable platform
      for (let offset = 0; offset < step; offset++) {
        let type: PlatformType
        ;[s, type] = pickType(s)
        rowTypes[offset] = type
      }
      safeRowTypes(rowTypes)

      for (let offset = 0; offset < step; offset++) {
        setPlatform(platforms[i + offset], (startCol + offset) * cw, newY, rowTypes[offset] )
      }

      minY = newY
      prevStartCol = startCol
    }
  }

  rngState[0] = s
  rngState[1] = prevStartCol
}
