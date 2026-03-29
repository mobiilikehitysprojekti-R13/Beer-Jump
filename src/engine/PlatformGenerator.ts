import { Platform } from "../state/types"
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
// setPlatform
// Writes all fields of a Platform object in place.
// Extracted to avoid repeating the same field assignments everywhere.
// ---------------------------------------------------------------------------
function setPlatform(p: Platform, x: number, y: number): void {
  "worklet"
  p.x = x
  p.y = y
  p.type = "static"
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
//     spanning the full screen width. BeerGuy spawns above this and lands
//     on it immediately on frame 0.
//
//   Indices FLOOR_PLATFORMS..PLATFORM_POOL_SIZE-1:
//     Regular rows — PLATFORMS_PER_ROW slots consumed per row.
//     Each row sits PLATFORM_ROW_HEIGHT above the previous.
//     Platforms in a row occupy PLATFORMS_PER_ROW consecutive columns
//     starting from a randomly chosen start column (nextStartColumn ensures
//     they fit without wrapping and differ from the previous row).
//
// Pool constraint check (not enforced at runtime, verify when tuning):
//   (PLATFORM_POOL_SIZE - FLOOR_PLATFORMS) must be divisible by PLATFORMS_PER_ROW
//   Current: (120 - 6) = 114, 114 / 2 = 57 rows ✓
// ---------------------------------------------------------------------------
export function resetPlatforms(pool: Platform[], seed: number): void {
  "worklet"
  let s = seed
  let rand: number

  const floorY = SCREEN_HEIGHT - 160
  const cw = colWidth()

  // Floor row — all PLATFORM_COLUMNS platforms side by side
  for (let col = 0; col < FLOOR_PLATFORMS; col++) {
    setPlatform(pool[col], col * cw, floorY)
  }

  // Regular rows — PLATFORMS_PER_ROW consecutive platforms per row
  let currentY = floorY
  let prevStartCol = 0

  let poolIndex = FLOOR_PLATFORMS
  while (poolIndex + PLATFORMS_PER_ROW <= PLATFORM_POOL_SIZE) {
    let startCol: number
    ;[s, rand, startCol] = nextStartColumn(s, prevStartCol)
    currentY -= PLATFORM_ROW_HEIGHT

    for (let offset = 0; offset < PLATFORMS_PER_ROW; offset++) {
      setPlatform(
        pool[poolIndex + offset],
        columnX(startCol + offset),
        currentY,
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
// RNG state (rngState[]):
//   [0] — LCG seed (persisted across frames)
//   [1] — start column of the most recently placed row (persisted so
//          nextStartColumn never repeats a column at a frame boundary)
//
// Recycling strategy:
//   Platforms are recycled in pool-index order. Because floor platforms
//   (indices 0..FLOOR_PLATFORMS-1) will eventually scroll off, they are
//   recycled as normal paired rows — correct behaviour.
//
//   To recycle in pairs we advance i by PLATFORMS_PER_ROW each iteration.
//   If a platform at index i is off-screen, all PLATFORMS_PER_ROW siblings
//   in that row are recycled together to the same new Y position.
// ---------------------------------------------------------------------------
export function recyclePlatforms(
  platforms: Platform[],
  cameraY: number,
  rngState: number[],
): void {
  "worklet"
  const offscreenThreshold = cameraY + SCREEN_HEIGHT * 1.5

  // Find the highest active platform (smallest world-Y)
  let minY = cameraY
  for (let i = 0; i < platforms.length; i++) {
    if (platforms[i].active && platforms[i].y < minY) {
      minY = platforms[i].y
    }
  }

  let s = rngState[0]
  let prevStartCol = rngState[1] !== undefined ? rngState[1] : 0
  let rand: number

  const step = PLATFORMS_PER_ROW

  for (let i = 0; i + step <= platforms.length; i += step) {
    // Use the first platform in the group as the representative for off-screen check
    if (platforms[i].y > offscreenThreshold) {
      let startCol: number
      ;[s, rand, startCol] = nextStartColumn(s, prevStartCol)

      const newY = minY - PLATFORM_ROW_HEIGHT
      const cw = colWidth()

      for (let offset = 0; offset < step; offset++) {
        setPlatform(platforms[i + offset], (startCol + offset) * cw, newY)
      }

      minY = newY
      prevStartCol = startCol
    }
  }

  rngState[0] = s
  rngState[1] = prevStartCol
}
