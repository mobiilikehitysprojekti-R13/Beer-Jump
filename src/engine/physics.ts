"worklet"

import {
  GRAVITY,
  MAX_FALL_SPEED,
  MAX_HORIZONTAL_SPEED,
  TOUCH_ACCELERATION,
  TOUCH_DECEL,
  PLAYER_WIDTH,
  PLAYER_HEIGHT,
  PLATFORM_COLUMNS,
  SCREEN_WIDTH,
  CRUMBLE_DELAY_MS,
  MAX_ENEMIES,
  MAX_POWER_UPS_ON_SCREEN,
  POWER_UP_WIDTH,
  POWER_UP_HEIGHT,
} from "../constants/gameConfig"
import { Enemy, Platform, PowerUp, PowerUpType } from "../state/types"

// Platform collision width computed the same way as PlatformGenerator and GameCanvas.
// Must stay in sync with SCREEN_WIDTH / PLATFORM_COLUMNS.
const COLLISION_PLATFORM_WIDTH = SCREEN_WIDTH / PLATFORM_COLUMNS

// ---------------------------------------------------------------------------
// applyGravity
// Increases downward velocity by GRAVITY * deltaTime each frame, capped at
// MAX_FALL_SPEED to prevent runaway acceleration on freeze/lag frames.
// ---------------------------------------------------------------------------
export function applyGravity(velocityY: number, deltaTime: number): number {
  "worklet"
  const next = velocityY + GRAVITY * deltaTime
  return next > MAX_FALL_SPEED ? MAX_FALL_SPEED : next
}

// ---------------------------------------------------------------------------
// applyGyroInput
// Maps gyroscope tilt directly to horizontal velocity (not accumulation).
// Direct mapping is stable under Expo Go's Android 12 gyro cap of 200ms —
// a stale reading still correctly reflects current phone orientation.
// Full tilt ≈ 1.5 rad/s. GYRO_SENSITIVITY = 0.3 maps full tilt to
// MAX_HORIZONTAL_SPEED. Tune GYRO_SENSITIVITY in gameConfig.ts.
// ---------------------------------------------------------------------------
export function applyGyroInput(gyroVal: number, sensitivity: number): number {
  "worklet"
  const target = gyroVal * sensitivity
  if (target > MAX_HORIZONTAL_SPEED) return MAX_HORIZONTAL_SPEED
  if (target < -MAX_HORIZONTAL_SPEED) return -MAX_HORIZONTAL_SPEED
  return target
}

// ---------------------------------------------------------------------------
// applyTouchInput
// Applies touch zone acceleration while a zone is held.
// When neither zone is pressed AND gyroActive is false, decelerates toward zero.
// When gyroActive is true, decel is skipped — gyro governs velocity directly.
// Only called from the game loop when touchControlsEnabled.value is true.
// ---------------------------------------------------------------------------
export function applyTouchInput(
  velocityX: number,
  left: boolean,
  right: boolean,
  gyroActive: boolean,
  deltaTime: number,
): number {
  "worklet"
  if (left) {
    const next = velocityX - TOUCH_ACCELERATION * deltaTime
    return next < -MAX_HORIZONTAL_SPEED ? -MAX_HORIZONTAL_SPEED : next
  }
  if (right) {
    const next = velocityX + TOUCH_ACCELERATION * deltaTime
    return next > MAX_HORIZONTAL_SPEED ? MAX_HORIZONTAL_SPEED : next
  }
  // Neither zone pressed — decelerate only if gyro is not actively steering
  if (gyroActive) return velocityX
  if (velocityX > 0) {
    const next = velocityX - TOUCH_DECEL * deltaTime
    return next < 0 ? 0 : next
  }
  if (velocityX < 0) {
    const next = velocityX + TOUCH_DECEL * deltaTime
    return next > 0 ? 0 : next
  }
  return 0
}

// ---------------------------------------------------------------------------
// tickMovingPlatform
// Advances a moving platform along its patrol path each frame.
// Mutates p.x and reverses p.moveDirection at each boundary.
// Pure worklet function — no closures, no dynamic allocation.
//
// Called from gameTick for every active platform with type === "moving".
// ---------------------------------------------------------------------------
export function tickMovingPlatform(p: Platform, dt: number): void {
  "worklet"
  p.x += p.moveSpeed * p.moveDirection * dt

  // Clamp and reverse at boundaries
  if (p.x <= p.moveBoundaryLeft) {
    p.x = p.moveBoundaryLeft
    p.moveDirection = 1
  } else if (p.x + COLLISION_PLATFORM_WIDTH >= p.moveBoundaryRight) {
    p.x = p.moveBoundaryRight - COLLISION_PLATFORM_WIDTH
    p.moveDirection = -1
  }
}

// ---------------------------------------------------------------------------
// tickBreakablePlatform
// Advances the crumble timer on a triggered breakable platform.
// When crumbleTimer reaches CRUMBLE_DELAY_MS the platform deactivates itself —
// it becomes invisible and passable. recyclePlatforms will reposition it
// as a new platform (any type) when it scrolls off camera.
//
// INVARIANT: BREAKABLE_FRAME_COUNT × BREAKABLE_FRAME_MS === CRUMBLE_DELAY_MS
//   4 × 75 = 300 ms ✓  (see gameConfig.ts Section 10)
//   The animation is guaranteed to complete exactly as the platform deactivates.
//
// Called from gameTick for every active platform with type === "breakable"
// and p.crumbling === true.
// ---------------------------------------------------------------------------
export function tickBreakablePlatform(p: Platform, dt: number): void {
  "worklet"
  p.crumbleTimer += dt

  if (p.crumbleTimer >= CRUMBLE_DELAY_MS) {
    // Deactivate — invisible, no collision, will be recycled when off-screen
    p.active = false
    p.crumbling = false
    p.crumbleTimer = 0
  }
}

// ---------------------------------------------------------------------------
// checkPlatformCollision
// Returns true if BeerGuy's feet crossed the top edge of a collidable platform
// this frame. Only checked when falling (velocityY > 0) — one-way platforms.
//
// Accepts prevPy — playerY from BEFORE the move step this frame. This gives
// the exact previous feet position without any approximation, correctly
// catching cases where BeerGuy moves fast enough to tunnel through a platform
// in a single frame.
//
// Per-type collision rules:
//   "static"       — always collidable while active
//   "moving"       — always collidable while active (no velocity inheritance needed)
//   "disappearing" — always collidable while active (cycle is purely visual)
//   "fake"         — never collidable (BeerGuy always falls through)
//   "breakable"    — collidable only when NOT yet crumbling.
//                    On first hit: set p.crumbling = true so this frame's bounce
//                    registers normally, and collision is skipped on all future
//                    frames for this instance. The caller (gameTick) then fires
//                    JUMP_VELOCITY as usual — BeerGuy gets exactly one jump.
// ---------------------------------------------------------------------------
export function checkPlatformCollision(
  px: number,
  py: number,
  prevPy: number,
  velocityY: number,
  platforms: Platform[],
): boolean {
  "worklet"
  if (velocityY <= 0) return false

  const feetY = py + PLAYER_HEIGHT
  const prevFeetY = prevPy + PLAYER_HEIGHT

  for (let i = 0; i < platforms.length; i++) {
    const p = platforms[i]
    if (!p.active) continue

    // Fake platforms — always fall through
    if (p.type === "fake") continue

    // Breakable platforms — skip if already crumbling (bounce already happened)
    if (p.type === "breakable" && p.crumbling) continue

    // Horizontal overlap check
    if (px + PLAYER_WIDTH <= p.x || px >= p.x + COLLISION_PLATFORM_WIDTH)
      continue
    // Vertical: feet crossed the platform top edge this frame
    if (prevFeetY <= p.y && feetY >= p.y) {
      // Trigger breakable crumble on first hit — collision registers this
      // frame so BeerGuy bounces, then crumbling = true disables future hits.
      if (p.type === "breakable") {
        p.crumbling = true
      }
      return true
    }
  }
  return false
}

// ---------------------------------------------------------------------------
// willLikelyLandSoon
// Predicts whether the player will cross a collidable platform top within
// lookAheadMs while descending. Pure check only: no platform mutation.
// ---------------------------------------------------------------------------
export function willLikelyLandSoon(
  px: number,
  py: number,
  velocityY: number,
  platforms: Platform[],
  lookAheadMs: number,
): boolean {
  "worklet"
  if (velocityY <= 0 || lookAheadMs <= 0) return false

  const feetY = py + PLAYER_HEIGHT
  const projectedFeetY = feetY + velocityY * lookAheadMs
  if (projectedFeetY < feetY) return false

  for (let i = 0; i < platforms.length; i++) {
    const p = platforms[i]
    if (!p.active) continue
    if (p.type === "fake") continue
    if (p.type === "breakable" && p.crumbling) continue

    if (px + PLAYER_WIDTH <= p.x || px >= p.x + COLLISION_PLATFORM_WIDTH) {
      continue
    }

    if (feetY <= p.y && projectedFeetY >= p.y) {
      return true
    }
  }

  return false
}

// ---------------------------------------------------------------------------
// wrapHorizontal
// Wraps BeerGuy from one side of the screen to the other when he exits the
// horizontal bounds. Mirrors Doodle Jump's screen-wrap mechanic.
// ---------------------------------------------------------------------------
export function wrapHorizontal(x: number): number {
  "worklet"
  if (x + PLAYER_WIDTH < 0) return SCREEN_WIDTH
  if (x > SCREEN_WIDTH) return -PLAYER_WIDTH
  return x
}

// ---------------------------------------------------------------------------
// tickEnemy
// Advances an enemy along its horizontal patrol path each frame.
// Reverses direction at patrol boundaries. Mutates enemy in place.
// Called from gameTick for every active enemy (active === true).
// ---------------------------------------------------------------------------
export function tickEnemy(e: Enemy, dt: number): void {
  "worklet"
  e.x += e.velocityX * dt

  if (e.x <= e.patrolLeft) {
    e.x = e.patrolLeft
    e.velocityX = e.velocityX < 0 ? -e.velocityX : e.velocityX
  } else if (e.x + e.width >= e.patrolRight) {
    e.x = e.patrolRight - e.width
    e.velocityX = e.velocityX > 0 ? -e.velocityX : e.velocityX
  }
}

// ---------------------------------------------------------------------------
// checkEnemyCollision
// Returns 'stomp', 'death', or null.
//
// Guard: skips enemies where alive === false OR active === false.
// A stomped enemy is immediately fully deactivated (both flags false) so it
// cannot be stomped again or deal contact damage on any subsequent frame.
//
// Stomp (feet crossed enemy top while falling, velocityY > 0):
//   Sets alive=false and active=false immediately — instant disappear.
//   Returns 'stomp' — caller applies JUMP_VELOCITY (normal bounce).
//
// Death (AABB overlap from side or below, enemy alive):
//   Returns 'death' — caller sets isDead=true and fires onGameOver.
//   NOTE: when invincible === true the caller skips this function entirely.
//   Stomp is still checked even while invincible — stomping an enemy while
//   on a jetpack is valid and gives a bounce. Only side/below deaths are
//   blocked by invincibility.
//
// prevPy tunnelling guard: uses the player Y from before the move step,
// same pattern as checkPlatformCollision.
// ---------------------------------------------------------------------------
export function checkEnemyCollision(
  px: number,
  py: number,
  prevPy: number,
  velocityY: number,
  enemyPool: Enemy[],
  invincible: boolean,
): "stomp" | "death" | null {
  "worklet"
  const feetY = py + PLAYER_HEIGHT
  const prevFeetY = prevPy + PLAYER_HEIGHT
  const headY = py

  for (let i = 0; i < MAX_ENEMIES; i++) {
    const e = enemyPool[i]
    if (!e.active || !e.alive) continue

    // Horizontal overlap
    if (px + PLAYER_WIDTH <= e.x || px >= e.x + e.width) continue

    // Stomp — feet crossed the top face of the enemy while falling.
    // Stomp is ALWAYS checked regardless of invincibility — you can still
    // stomp enemies while riding the jetpack or bottle rocket.
    if (velocityY > 0 && prevFeetY <= e.y && feetY >= e.y) {
      e.alive = false
      e.active = false
      return "stomp"
    }

    // Side / below contact — death only when NOT invincible.
    // When invincible (jetpack / bottleRocket active) BeerGuy phases through.
    if (!invincible && feetY > e.y && headY < e.y + e.height) {
      return "death"
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// checkPowerUpCollection
//
// Returns the type of the collected power-up, or null if nothing was collected.
//
// Collection rules:
//   1. Only called when activePowerUpState.type === "none" — the caller guards
//      this. If a power-up is already active, this function is never reached
//      and all power-up items remain visible on their platforms.
//   2. AABB overlap between BeerGuy's hitbox and the power-up item hitbox.
//      Power-ups are collected by walking/jumping into them mid-air, same as
//      Doodle Jump. No "landing" required.
//   3. Pretzel Boots follow the same AABB collection path BUT their effect
//      (jump multiplier) is applied by the caller immediately if the bounce
//      on the same frame is detected. The caller checks both platform collision
//      and power-up collection, so both can fire on the same frame.
//   4. On collection: mutates powerUp.active = false (item disappears).
//      The caller writes activePowerUpState via .modify() — not done here
//      to keep this function a pure worklet with no SharedValue access.
//
// Returns the type string so the caller can set up the correct state.
// ---------------------------------------------------------------------------
export function checkPowerUpCollection(
  px: number,
  py: number,
  powerUpPool: PowerUp[],
): PowerUpType | null {
  "worklet"
  // BeerGuy hitbox
  const right = px + PLAYER_WIDTH
  const bottom = py + PLAYER_HEIGHT

  for (let i = 0; i < MAX_POWER_UPS_ON_SCREEN; i++) {
    const pu = powerUpPool[i]
    if (!pu.active) continue

    // AABB overlap
    if (
      px < pu.x + POWER_UP_WIDTH &&
      right > pu.x &&
      py < pu.y + POWER_UP_HEIGHT &&
      bottom > pu.y
    ) {
      pu.active = false // deactivate item — disappears from canvas immediately
      return pu.type
    }
  }
  return null
}
