import { Enemy, Platform, PlatformType, DifficultyConfig,ActivePowerUpState, PowerUp, PowerUpType } from "../state/types"
import {
  PLATFORM_POOL_SIZE,
  PLATFORM_HEIGHT,
  PLATFORM_ROW_HEIGHT,
  PLATFORM_COLUMNS,
  FLOOR_PLATFORMS,
  PLATFORMS_PER_ROW,
  SCREEN_WIDTH,
  SCREEN_HEIGHT,
  MAX_ENEMIES,
  ENEMY_BASE_SPEED,
  ENEMY_HEIGHT,
  MAX_POWER_UPS_ON_SCREEN,
  POWER_UP_WIDTH,
  POWER_UP_HEIGHT,
  POWER_UP_PLATFORM_OFFSET,
  POWER_UP_SPAWN_PROB,
} from "../constants/gameConfig"
import { getDifficultyConfig } from "./DifficultyScaler"

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
// Picks a random starting column for a row such that all `step` consecutive
// columns fit without wrapping, and the first column differs from prevCol.
//
// step — number of platforms in this row (from config.platformsPerRow).
// Max valid start = PLATFORM_COLUMNS - step
// ---------------------------------------------------------------------------
function nextStartColumn(
  s: number,
  prevCol: number,
  step: number,
): [number, number, number] {
  "worklet"
  const maxStart = PLATFORM_COLUMNS - step
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
// Selects a platform type from a probability table using one LCG step.
// Returns [nextSeed, type].
//
// probs — cumulative upper bounds from DifficultyConfig.typeProbabilities.
//   rand < probs.static       → 'static'
//   rand < probs.static+moving → 'moving'   (stored as probs.moving cumulative)
//   etc.
// The table is built cumulatively in getDifficultyConfig so this function
// just walks the bounds in order — no addition needed here.
//
// Floor row platforms always use 'static' — the caller passes Tier 1 probs
// or handles floor rows before calling pickType at all.
// ---------------------------------------------------------------------------
function pickType(
  s: number,
  probs: DifficultyConfig["typeProbabilities"],
): [number, PlatformType] {
  "worklet"
  let rand: number
  ;[s, rand] = lcgNext(s)

  // Cumulative probability walk — probs values are raw per-type weights.
  // We accumulate inline to avoid storing a separate cumulative array.
  let cum = probs.static
  if (rand < cum) return [s, "static"]
  cum += probs.moving
  if (rand < cum) return [s, "moving"]
  cum += probs.breakable
  if (rand < cum) return [s, "breakable"]
  cum += probs.disappearing
  if (rand < cum) return [s, "disappearing"]
  return [s, "fake"]
}

// ---------------------------------------------------------------------------
// pickPowerUpType
// Selects a power-up type using one LCG step against the weight table.
// Returns [nextSeed, powerUpType].
//
// Cumulative thresholds derived from POWER_UP_TYPE_WEIGHTS in gameConfig.ts:
//   pretzelBoots: 0.50             → rand < 0.50
//   foamHat:      0.25 cumul 0.75  → rand < 0.75
//   jetpack:      0.15 cumul 0.90  → rand < 0.90
//   bottleRocket: 0.10 cumul 1.00  → fallthrough
//
// The thresholds are hardcoded here because POWER_UP_TYPE_WEIGHTS is a plain
// JS object and object property access inside a worklet from a non-worklet
// constant is unreliable. If you change POWER_UP_TYPE_WEIGHTS in gameConfig.ts,
// update the thresholds here to match.
// ---------------------------------------------------------------------------
function pickPowerUpType(s: number): [number, PowerUpType] {
  "worklet"
  let rand: number
  ;[s, rand] = lcgNext(s)

  if (rand < 0.5) return [s, "pretzelBoots"]
  if (rand < 0.75) return [s, "foamHat"]
  if (rand < 0.9) return [s, "jetpack"]
  return [s, "bottleRocket"]
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
function setPlatform(
  p: Platform,
  x: number,
  y: number,
  type: PlatformType,
): void {
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
  if (type === "moving") {
    // Patrol one column left and one column right of spawn position,
    // clamped so the platform never leaves the screen.
    const patrolLeft = x - cw
    const patrolRight = x + cw * 2
    p.moveBoundaryLeft = patrolLeft < 0 ? 0 : patrolLeft
    p.moveBoundaryRight =
      patrolRight > SCREEN_WIDTH ? SCREEN_WIDTH : patrolRight
    p.moveSpeed = 0.12
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
//   Current: (60 - 6) = 54, 54 / 1 = 54 rows ✓
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// safeRowTypes
// Ensures a row's type array never leaves the player with zero landable
// platforms. If every slot is "fake", force the first slot to "static".
// ---------------------------------------------------------------------------
function safeRowTypes(types: PlatformType[]): void {
  "worklet"
  let allFake = true
  for (let i = 0; i < types.length; i++) {
    if (types[i] !== "fake") {
      allFake = false
      break
    }
  }
  if (allFake) {
    types[0] = "static"
  }
}

// ---------------------------------------------------------------------------
// enforceMovingRowRule
// If any slot in the row is 'moving', forces all other slots to 'moving'.
// Applies regardless of row width — a single moving platform is still an
// all-moving row, which matters for enemy spawn exclusion.
//
// Called after safeRowTypes so both invariants are enforced in sequence.
// types[] is mutated in place — no allocation.
// ---------------------------------------------------------------------------
function enforceMovingRowRule(types: PlatformType[], count: number): void {
  "worklet"
  let hasMoving = false
  for (let i = 0; i < count; i++) {
    if (types[i] === "moving") {
      hasMoving = true
      break
    }
  }
  if (hasMoving) {
    for (let i = 0; i < count; i++) {
      types[i] = "moving"
    }
  }
}

// ---------------------------------------------------------------------------
// setMovingPlatformGroup
// Writes a coordinated patrol for a group of moving platforms that share a row.
// All platforms in the group get the same patrol boundaries, moveSpeed, and
// moveDirection so they move as one wide surface without ever intersecting.
//
// Group patrol logic:
//   groupLeft  = left edge of the leftmost platform's per-column patrol bound
//   groupRight = right edge of the rightmost platform's per-column patrol bound
//   Both are clamped to [0, SCREEN_WIDTH].
//   Every platform in the group shares these bounds — they all reverse at the
//   same wall simultaneously.
//
// Called in place of individual setPlatform calls when the row is all-moving.
// ---------------------------------------------------------------------------
function setMovingPlatformGroup(
  pool: Platform[],
  poolOffset: number,
  startX: number,
  y: number,
  count: number,
): void {
  "worklet"
  const cw = colWidth()

  // Group patrol: one column left of leftmost, one column right of rightmost
  const groupLeft = startX - cw < 0 ? 0 : startX - cw
  const groupRight =
    startX + count * cw + cw > SCREEN_WIDTH
      ? SCREEN_WIDTH
      : startX + count * cw + cw

  for (let offset = 0; offset < count; offset++) {
    const p = pool[poolOffset + offset]
    const x = startX + offset * cw

    // Base reset (same as setPlatform)
    p.x = x
    p.y = y
    p.type = "moving"
    p.active = true
    p.moveSpeed = 0.12
    p.moveDirection = 1
    p.moveBoundaryLeft = groupLeft
    p.moveBoundaryRight = groupRight
    p.crumbling = false
    p.crumbleTimer = 0
    p.opacity = 1
    p.visible = true
    p.visibleTimer = 0
  }
}

// ---------------------------------------------------------------------------
// trySpawnPowerUp
//
// Attempts to place a power-up item on a platform in the current row.
// Called only after a non-enemy platform row has been placed and only when
// the row is not all-moving (moving platforms cannot hold power-ups).
//
// Spawn rules:
//   • Roll one LCG check against the tier's spawn probability.
//   • If the roll passes, pick a random eligible platform in the row
//     (any type except "fake" — fake platforms are not collidable so the
//     player cannot reliably land to "collect" the item visually).
//   • Find an inactive power-up pool slot and write into it.
//   • Position: centered horizontally on the chosen platform, sitting on
//     top of it (y = platformY - POWER_UP_HEIGHT - POWER_UP_PLATFORM_OFFSET).
//
// Mutates s (LCG seed) in place via the returned value.
// Returns the updated seed. Only one power-up per row maximum.
// ---------------------------------------------------------------------------
function trySpawnPowerUp(
  s: number,
  platforms: Platform[],
  rowPoolOffset: number,
  rowPlatformCount: number,
  rowTypes: PlatformType[],
  powerUpPool: PowerUp[],
  tierIndex: number,
): number {
  "worklet"
  const spawnProb = POWER_UP_SPAWN_PROB[tierIndex] ?? 0.04
  let spawnRand: number
  ;[s, spawnRand] = lcgNext(s)

  if (spawnRand >= spawnProb) return s // no spawn this row

  // Find an eligible platform in this row (not fake) to host the power-up
  // Pick a random eligible slot rather than always using the first one
  let eligibleCount = 0
  for (let offset = 0; offset < rowPlatformCount; offset++) {
    if (rowTypes[offset] !== "fake") eligibleCount++
  }
  if (eligibleCount === 0) return s // all fake row — no host available

  let pickRand: number
  ;[s, pickRand] = lcgNext(s)
  const pickIndex = Math.floor(pickRand * eligibleCount)

  let found = 0
  let chosenOffset = 0
  for (let offset = 0; offset < rowPlatformCount; offset++) {
    if (rowTypes[offset] !== "fake") {
      if (found === pickIndex) {
        chosenOffset = offset
        break
      }
      found++
    }
  }

  const hostPlatform = platforms[rowPoolOffset + chosenOffset]

  // Find an inactive power-up pool slot
  for (let e = 0; e < MAX_POWER_UPS_ON_SCREEN; e++) {
    if (!powerUpPool[e].active) {
      let puType: PowerUpType
      ;[s, puType] = pickPowerUpType(s)

      const cw = colWidth()
      // Center the power-up horizontally on its host platform
      const puX = hostPlatform.x + (cw - POWER_UP_WIDTH) / 2
      // Sit on top of the platform with a small offset gap
      const puY = hostPlatform.y - POWER_UP_HEIGHT - POWER_UP_PLATFORM_OFFSET

      powerUpPool[e].x = puX
      powerUpPool[e].y = puY
      powerUpPool[e].type = puType
      powerUpPool[e].active = true
      break
    }
  }

  return s
}

export function resetPlatforms(pool: Platform[], seed: number): void {
  "worklet"
  let s = seed
  let rand: number

  const floorY = SCREEN_HEIGHT - 160
  const cw = colWidth()

  // Floor row — always static (BeerGuy must land here reliably on spawn)
  for (let col = 0; col < FLOOR_PLATFORMS; col++) {
    setPlatform(pool[col], col * cw, floorY, "static")
  }

  // Regular rows — type chosen per-platform by pickType(), then validated
  // by safeRowTypes to prevent all-fake rows.
  // resetPlatforms always uses Tier 1 settings — the player always
  // starts fresh regardless of previous run history.
  let currentY = floorY
  let prevStartCol = 0

  // Tier 1 settings: 3 platforms per row (wide grouped surface), generous type mix
  const tier1PlatformsPerRow = 3
  const tier1Probs = {
    static: 0.75,
    moving: 0.12,
    breakable: 0.06,
    disappearing: 0.05,
    fake: 0.02,
  }

  // Reusable type buffer — filled with a loop (no Array.from closure)
  const rowTypes: PlatformType[] = []
  for (let i = 0; i < PLATFORMS_PER_ROW; i++) rowTypes[i] = "static"

  let poolIndex = FLOOR_PLATFORMS
  while (poolIndex + PLATFORMS_PER_ROW <= PLATFORM_POOL_SIZE) {
    let startCol: number
    ;[s, rand, startCol] = nextStartColumn(
      s,
      prevStartCol,
      tier1PlatformsPerRow,
    )
    currentY -= PLATFORM_ROW_HEIGHT

    // Pick types for Tier 1 group width
    for (let offset = 0; offset < tier1PlatformsPerRow; offset++) {
      let type: PlatformType
      ;[s, type] = pickType(s, tier1Probs)
      rowTypes[offset] = type
    }

    // Guarantee at least one landable platform per row
    safeRowTypes(rowTypes)
    // If any slot is moving, make all slots moving (prevents type conflicts)
    enforceMovingRowRule(rowTypes, tier1PlatformsPerRow)

    // Fill active platforms for this row's group
    // All-moving rows use coordinated group patrol; mixed rows use individual setPlatform
    const rowIsAllMoving = rowTypes[0] === "moving"
    if (rowIsAllMoving) {
      setMovingPlatformGroup(
        pool,
        poolIndex,
        columnX(startCol),
        currentY,
        tier1PlatformsPerRow,
      )
    } else {
      for (let offset = 0; offset < tier1PlatformsPerRow; offset++) {
        setPlatform(
          pool[poolIndex + offset],
          columnX(startCol + offset),
          currentY,
          rowTypes[offset],
        )
      }
    }
    // Deactivate trailing slots in the stride beyond tier1PlatformsPerRow
    for (
      let offset = tier1PlatformsPerRow;
      offset < PLATFORMS_PER_ROW;
      offset++
    ) {
      pool[poolIndex + offset].active = false
      pool[poolIndex + offset].y = -9999
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
// one PLATFORM_ROW_HEIGHT higher.
//
// DifficultyScaler integration:
//   getDifficultyConfig(rngState[2]) is called once per recycled row.
//   rngState[2] (rowsGenerated) is incremented after each row is placed.
//   pickType receives the config's typeProbabilities for the current tier.
//   Enemy spawn uses config.enemiesEnabled and config.enemySpeedMultiplier.
//
// Enemy spawn:
//   One enemy may spawn per row when enemiesEnabled is true.
//   Spawn probability scales with tier (15% at Tier 2 -> 35% at Tier 5).
//   Enemies are never placed on fake or disappearing platforms.
//   An inactive slot from the enemy pool is claimed; if none available, skip.
//
// RNG state (rngState[]):
//   [0] - LCG seed (persisted across frames)
//   [1] - start column of the most recently placed row
//   [2] - rows generated this run (tier input for DifficultyScaler)
// ---------------------------------------------------------------------------

// Enemy spawn probability per tier index (0-based: tier1=index0, etc.)
// Index 0 (Tier 1) is always 0 -- enemiesEnabled is false for Tier 1.
const ENEMY_SPAWN_PROB = [0, 0.15, 0.22, 0.28, 0.35]

export function recyclePlatforms(
  platforms: Platform[],
  enemyPool: Enemy[],
  powerUpPool: PowerUp[],
  cameraY: number,
  rngState: number[],
): void {
  "worklet"
  const offscreenThreshold = cameraY + SCREEN_HEIGHT * 1.5

  // Find the highest active platform Y (smallest world-Y).
  // Only active platforms are included so deactivated breakables don't skew
  // the high-water mark and cause new rows to appear far above the live zone.
  let minY = cameraY
  for (let i = 0; i < platforms.length; i++) {
    if (platforms[i].active && platforms[i].y < minY) {
      minY = platforms[i].y
    }
  }

  let s = rngState[0]
  let prevStartCol = rngState[1] !== undefined ? rngState[1] : 0
  let rowsGenerated = rngState[2] !== undefined ? rngState[2] : 0
  let rand: number

  // Hoisted — constant for the run
  const cw = colWidth()

  // Pool stride is always PLATFORMS_PER_ROW (3 = max group size).
  // config.platformsPerRow tells us how many slots to actually fill per stride.
  // Trailing slots in the stride are deactivated.
  const stride = PLATFORMS_PER_ROW

  // Reusable type buffer — filled with a loop (no Array.from closure)
  const rowTypes: PlatformType[] = []
  for (let i = 0; i < stride; i++) rowTypes[i] = "static"

  // Deactivate power-ups that have scrolled off screen (unconditional outer check)
  for (let e = 0; e < MAX_POWER_UPS_ON_SCREEN; e++) {
    if (powerUpPool[e].active && powerUpPool[e].y > offscreenThreshold) {
      powerUpPool[e].active = false
      powerUpPool[e].y = -9999
    }
  }

  // Deactivate enemies that have scrolled off screen (unconditional — not
  // inside the platform loop so they are cleaned up even when no rows recycle)
  for (let e = 0; e < MAX_ENEMIES; e++) {
    if (enemyPool[e].active && enemyPool[e].y > offscreenThreshold) {
      enemyPool[e].active = false
      enemyPool[e].alive = false
    }
  }

  for (let i = 0; i + stride <= platforms.length; i += stride) {
    // Use world-Y of the first slot in the group regardless of active state
    if (platforms[i].y > offscreenThreshold) {
      // Resolve difficulty config for this row
      const config = getDifficultyConfig(rowsGenerated)
      const step = config.platformsPerRow

      let startCol: number
      ;[s, rand, startCol] = nextStartColumn(s, prevStartCol, step)

      const newY = minY - PLATFORM_ROW_HEIGHT

      // Enemy row or platform row
      let enemySpawnedThisRow = false

      if (config.enemiesEnabled) {
        const spawnProb = ENEMY_SPAWN_PROB[config.tier - 1] ?? 0
        let spawnRand: number
        ;[s, spawnRand] = lcgNext(s)

        if (spawnRand < spawnProb) {
          // Find an inactive enemy pool slot
          for (let e = 0; e < MAX_ENEMIES; e++) {
            if (!enemyPool[e].active) {
              const enemy = enemyPool[e]

              // Enemy width = 2 column widths — spans two platform widths
              const enemyWidth = cw * 2

              // Spawn column: pick a column such that the 2-wide enemy fits.
              // Reuse the LCG for the column choice.
              let spawnCol: number
              ;[s, , spawnCol] = nextStartColumn(s, prevStartCol, 2)

              const enemyX = spawnCol * cw

              // Patrol: one column left of leftmost edge, one column right of rightmost edge
              const patrolLeft = enemyX - cw < 0 ? 0 : enemyX - cw
              const patrolRight =
                enemyX + enemyWidth + cw > SCREEN_WIDTH
                  ? SCREEN_WIDTH
                  : enemyX + enemyWidth + cw

              enemy.x = enemyX
              enemy.y = newY
              enemy.width = enemyWidth
              enemy.height = ENEMY_HEIGHT
              enemy.patrolLeft = patrolLeft
              enemy.patrolRight = patrolRight
              enemy.velocityX = ENEMY_BASE_SPEED * config.enemySpeedMultiplier
              enemy.alive = true
              enemy.active = true

              enemySpawnedThisRow = true
              break
            }
          }
        }
      }

      if (enemySpawnedThisRow) {
        // Deactivate all platform slots — the flying enemy owns this row.
        // No power-up spawns on enemy rows.
        for (let offset = 0; offset < stride; offset++) {
          platforms[i + offset].active = false
          platforms[i + offset].y = -9999
        }
      } else {
        // No enemy — place platforms
        for (let offset = 0; offset < step; offset++) {
          let type: PlatformType
          ;[s, type] = pickType(s, config.typeProbabilities)
          rowTypes[offset] = type
        }
        safeRowTypes(rowTypes)
        enforceMovingRowRule(rowTypes, step)

        const rowIsAllMoving = rowTypes[0] === "moving"
        if (rowIsAllMoving) {
          setMovingPlatformGroup(platforms, i, startCol * cw, newY, step)
        } else {
          for (let offset = 0; offset < step; offset++) {
            setPlatform(
              platforms[i + offset],
              (startCol + offset) * cw,
              newY,
              rowTypes[offset],
            )
          }
        }
        // Deactivate trailing slots
        for (let offset = step; offset < stride; offset++) {
          platforms[i + offset].active = false
          platforms[i + offset].y = -9999
        }

        // Power-up spawn
        // Only on non-moving rows. Moving platforms cannot hold power-ups
        // because the item would need to track the platform's x each frame
        // (the item has no physics tick). Fake-only rows are also excluded
        // (safeRowTypes guarantees at least one non-fake, but rowIsAllMoving
        // false still allows mixed rows that have some fakes — trySpawnPowerUp
        // handles that internally by skipping fake-hosted slots).
        if (!rowIsAllMoving) {
          s = trySpawnPowerUp(
            s,
            platforms,
            i,
            step,
            rowTypes,
            powerUpPool,
            config.tier - 1, // tier is 1-based, POWER_UP_SPAWN_PROB is 0-based
          )
        }
      }

      minY = newY
      prevStartCol = startCol
      rowsGenerated += 1
    }
  }

  rngState[0] = s
  rngState[1] = prevStartCol
  rngState[2] = rowsGenerated
}
