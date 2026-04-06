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
} from "../constants/gameConfig"
import { Platform } from "../state/types"

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
    if (p.type === 'fake') continue

    // Breakable platforms — skip if already crumbling (bounce already happened)
    if (p.type === 'breakable' && p.crumbling) continue

    // Horizontal overlap check
    if (px + PLAYER_WIDTH <= p.x || px >= p.x + COLLISION_PLATFORM_WIDTH)
      continue
    // Vertical: feet crossed the platform top edge this frame
    if (prevFeetY <= p.y && feetY >= p.y) {
      // Trigger breakable crumble on first hit — collision registers this
      // frame so BeerGuy bounces, then crumbling = true disables future hits.
      if (p.type === 'breakable') {
        p.crumbling = true
      }
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
