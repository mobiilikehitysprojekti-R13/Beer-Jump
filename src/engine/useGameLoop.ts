import {
  useFrameCallback,
  runOnJS,
  type FrameInfo,
} from "react-native-reanimated"
import { useCallback } from "react"
import { resetPlatforms, recyclePlatforms } from "./PlatformGenerator"
import {
  applyGravity,
  applyGyroInput,
  applyTouchInput,
  checkPlatformCollision,
  checkEnemyCollision,
  checkPowerUpCollection,
  tickMovingPlatform,
  tickBreakablePlatform,
  tickEnemy,
  wrapHorizontal,
} from "./physics"
import * as GV from "../state/gameValues"
import {
  JUMP_VELOCITY,
  SCORE_PER_UNIT,
  SCREEN_WIDTH,
  SCREEN_HEIGHT,
  PLAYER_WIDTH,
  PLAYER_HEIGHT,
  GYRO_DEADZONE,
  INPUT_GRACE_MS,
  MAX_DELTA_TIME,
  GAME_START_DELAY_MS,
  PLATFORM_POOL_SIZE,
  MAX_ENEMIES,
  MAX_POWER_UPS_ON_SCREEN,
  PRETZEL_JUMP_MULTIPLIER,
  FOAM_HAT_DURATION_MS,
  FOAM_HAT_ASCENT_SPEED,
  JETPACK_DURATION_MS,
  JETPACK_ASCENT_SPEED,
  ROCKET_DURATION_MS,
  ROCKET_ASCENT_SPEED,
} from "../constants/gameConfig"
import { log, logFromWorklet } from "../utils/logger"

// ---------------------------------------------------------------------------
// useGameLoop
//
// Drives the per-frame physics tick via Reanimated's useFrameCallback
// (UI thread, ~60fps) and exposes restartRun() for GameScreen to call.
//
// Power-up integration:
//
//   Collection — after platform collision each frame, checkPowerUpCollection
//   is called ONLY when no power-up is currently active. If a power-up item
//   is overlapping BeerGuy it is consumed and activePowerUpState is written.
//   If a power-up is already active, all items stay on their platforms.
//
//   Tick / physics override — at the START of each frame (before gravity),
//   if a power-up is active its timer is decremented. The remaining time
//   drives the physics override for that frame:
//     • foamHat       → velocityY set to FOAM_HAT_ASCENT_SPEED, gravity applied after
//     • jetpack       → velocityY set to JETPACK_ASCENT_SPEED, gravity applied after
//     • bottleRocket  → velocityY set to ROCKET_ASCENT_SPEED, gravity SKIPPED this frame
//
//   Expiry — when timerMs reaches 0 the state is reset atomically via
//   .modify() in one call. Gravity resumes from the next frame. BeerGuy's
//   velocityY at expiry is whatever the last override wrote (e.g. JETPACK_ASCENT_SPEED)
//   so he continues upward briefly — this is intentional and feels natural.
//   The player retains control the moment the timer expires.
//
//   Invincibility — while jetpack or bottleRocket is active, enemy side/below
//   collisions are ignored. Stomp is always checked (you can stomp enemies
//   during any power-up). The invincible flag is carried in activePowerUpState
//   and read directly in the enemy collision step.
//
//   Pretzel Boots — instant, no timed state. Collected like other power-ups
//   (AABB overlap), but instead of setting activePowerUpState, the caller
//   multiplies JUMP_VELOCITY by PRETZEL_JUMP_MULTIPLIER on the same frame
//   if (and only if) a platform bounce also happened this frame. If the boots
//   are collected in mid-air with no bounce this frame, the multiplier is
//   stored in a local worklet variable and applied on the NEXT bounce only.
//   After one use the boots effect is consumed — it does not persist.
// ---------------------------------------------------------------------------
export function useGameLoop(
  onGameOver: (score: number) => void,
  onJump: () => void,
  onStomp: () => void,
  sensitivity: number,
) {
  // -------------------------------------------------------------------------
  // gameTick — the per-frame worklet.
  //
  // Memoised with useCallback so the function reference is stable across
  // re-renders. useFrameCallback's internal useEffect has [callback] as its
  // dep array — a new function reference causes re-registration (BUG-9).
  // Stable deps: onGameOver (stable useCallback in GameScreen), sensitivity
  // (primitive number, only changes when the user adjusts Settings).
  // -------------------------------------------------------------------------
  const gameTick = useCallback(
    (frameInfo: FrameInfo) => {
      "worklet"

      // 1. Guard
      if (GV.isPaused.value || GV.isDead.value) return

      // 2. Delta time — cap at MAX_DELTA_TIME to prevent physics explosion on
      //    lag spikes. timeSincePreviousFrame is null on the very first frame —
      //    return early, pool may not be ready yet.
      const rawDelta = frameInfo.timeSincePreviousFrame
      if (rawDelta === null) return
      const dt = rawDelta > MAX_DELTA_TIME ? MAX_DELTA_TIME : rawDelta

      if (rawDelta > MAX_DELTA_TIME) {
        logFromWorklet("gameLoop", "deltaTime capped", {
          raw: rawDelta,
          capped: dt,
        })
      }

      // 3. Global animation clock — written before any rendering reads it.
      //    GameCanvas's AnimatedPlatformImage components subscribe to
      //    GV.globalTime via useDerivedValue to drive the disappearing
      //    platform spritesheet cycle. Reset to 0 by restartRun Step B.
      GV.globalTime.value = frameInfo.timeSinceFirstFrame ?? 0

      // 4. Input — timeSinceFirstFrame null on frame 0, default to 0.
      //    Frame 0 treated as t=0ms: input suppressed, FIRST FRAME log fires.
      const timeSinceStart = frameInfo.timeSinceFirstFrame ?? 0
      const inputActive = timeSinceStart > INPUT_GRACE_MS

      const gyroVal = GV.gyroX.value
      const gyroActive =
        inputActive && (gyroVal > GYRO_DEADZONE || gyroVal < -GYRO_DEADZONE)

      let vx: number
      if (!inputActive) {
        vx = 0
      } else if (gyroActive) {
        vx = applyGyroInput(gyroVal, sensitivity)
      } else {
        vx = GV.velocityX.value
      }

      if (inputActive && GV.touchControlsEnabled.value) {
        vx = applyTouchInput(
          vx,
          GV.touchLeft.value,
          GV.touchRight.value,
          gyroActive,
          dt,
        )
      }
      GV.velocityX.value = vx

      // Log on the very first active frame — confirms worklet state after init.
      if (timeSinceStart < 50) {
        logFromWorklet("gameLoop", "FIRST FRAME — worklet state", {
          playerX: GV.playerX.value,
          playerY: GV.playerY.value,
          velocityX: GV.velocityX.value,
          velocityY: GV.velocityY.value,
          cameraY: GV.cameraY.value,
          score: GV.score.value,
          isDead: GV.isDead.value,
          isPaused: GV.isPaused.value,
          p0y: GV.platforms.value[0]?.y,
          p0active: GV.platforms.value[0]?.active,
        })
      }

      // Log once at end of grace period.
      const prevScore = GV.score.value
      if (
        timeSinceStart > INPUT_GRACE_MS &&
        timeSinceStart < INPUT_GRACE_MS + 50
      ) {
        logFromWorklet("input", "GRACE PERIOD ENDED — input now active", {
          gyroX: gyroVal,
          gyroActive,
          vx: GV.velocityX.value,
          vy: GV.velocityY.value,
          px: GV.playerX.value,
          py: GV.playerY.value,
          screenY: GV.playerY.value - GV.cameraY.value,
          score: prevScore,
        })
      }

      // -----------------------------------------------------------------------
      // 5. Power-up tick — runs BEFORE gravity so the override velocity is set
      //    first, then gravity either adds to it (foamHat/jetpack) or is skipped
      //    entirely (bottleRocket burst).
      //
      //    suppressGravity is a local boolean used in step 6 to skip the normal
      //    gravity call for the bottleRocket burst window.
      // -----------------------------------------------------------------------
      let suppressGravity = false

      const puState = GV.activePowerUpState.value
      if (puState.type !== "none") {
        const newTimer = puState.timerMs - dt

        if (newTimer <= 0) {
          // Power-up expired this frame — reset all state atomically.
          // velocityY is intentionally left at whatever the last override wrote
          // so BeerGuy continues in the direction of travel for a natural handoff.
          GV.activePowerUpState.modify((state) => {
            "worklet"
            state.type = "none"
            state.timerMs = 0
            state.invincible = false
            return state
          })
          logFromWorklet("powerUp", "power-up expired", {
            wasType: puState.type,
          })
        } else {
          // Still active — update timer and apply physics override for this frame.
          GV.activePowerUpState.modify((state) => {
            "worklet"
            state.timerMs = newTimer
            return state
          })

          if (puState.type === "foamHat") {
            // Override velocityY to gentle upward drift; gravity still applied after.
            GV.velocityY.value = FOAM_HAT_ASCENT_SPEED
          } else if (puState.type === "jetpack") {
            // Override velocityY to strong upward; gravity still applied after,
            // net is JETPACK_ASCENT_SPEED + GRAVITY * dt ≈ -1.31 units/ms upward.
            GV.velocityY.value = JETPACK_ASCENT_SPEED
          } else if (puState.type === "bottleRocket") {
            // Maximum burst — suppress gravity entirely this frame.
            GV.velocityY.value = ROCKET_ASCENT_SPEED
            suppressGravity = true
            // Dampen horizontal to ~30% during the rocket burst.
            GV.velocityX.value = GV.velocityX.value * 0.3
          }
        }
      }

      // 6. Gravity (skipped during bottleRocket burst)
      if (!suppressGravity) {
        GV.velocityY.value = applyGravity(GV.velocityY.value, dt)
      }

      // 7. Move — capture prevPy before move for accurate collision
      const prevPy = GV.playerY.value
      GV.playerX.value = wrapHorizontal(
        GV.playerX.value + GV.velocityX.value * dt,
      )
      GV.playerY.value = GV.playerY.value + GV.velocityY.value * dt

      const wrappedX = GV.playerX.value
      if (wrappedX === SCREEN_WIDTH || wrappedX === -PLAYER_WIDTH) {
        logFromWorklet("physics", "screen wrap", { newX: wrappedX })
      }

      // 8. Platform tick loop
      const plats = GV.platforms.value
      for (let i = 0; i < PLATFORM_POOL_SIZE; i++) {
        const p = plats[i]
        if (!p.active) continue
        if (p.type === "moving") {
          tickMovingPlatform(p, dt)
        } else if (p.type === "breakable" && p.crumbling) {
          tickBreakablePlatform(p, dt)
        }
      }

      // 8b. Enemy tick loop
      const enems = GV.enemies.value
      for (let i = 0; i < MAX_ENEMIES; i++) {
        if (enems[i].active) tickEnemy(enems[i], dt)
      }

      // -----------------------------------------------------------------------
      // 9. Enemy collision
      //
      // Read invincible flag from the current activePowerUpState — note that
      // .modify() above may have just expired the state, so we re-read .value
      // here rather than using the local puState captured before the tick.
      // -----------------------------------------------------------------------
      const currentInvincible = GV.activePowerUpState.value.invincible
      const enemyResult = checkEnemyCollision(
        GV.playerX.value,
        GV.playerY.value,
        prevPy,
        GV.velocityY.value,
        GV.enemies.value,
        currentInvincible,
      )
      if (enemyResult === "stomp") {
        // Silent normal bounce — same velocity as a platform landing
        GV.velocityY.value = JUMP_VELOCITY
        runOnJS(onStomp)()
      } else if (enemyResult === "death") {
        GV.isDead.value = true
        runOnJS(onGameOver)(GV.score.value)
        return
      }

      // 9b. Platform collision
      const hit = checkPlatformCollision(
        GV.playerX.value,
        GV.playerY.value,
        prevPy,
        GV.velocityY.value,
        GV.platforms.value,
      )
      if (hit) {
        const vyBeforeBounce = GV.velocityY.value
        GV.velocityY.value = JUMP_VELOCITY
        runOnJS(onJump)()
        logFromWorklet("physics", "platform bounce", {
          px: GV.playerX.value,
          py: GV.playerY.value,
          screenY: GV.playerY.value - GV.cameraY.value,
          vyOnLanding: vyBeforeBounce,
          cameraY: GV.cameraY.value,
          score: GV.score.value,
        })
      }

      // -----------------------------------------------------------------------
      // 10. Power-up collection
      //
      // Only attempted when no power-up is currently active. This is the hard
      // gate: if activePowerUpState.type !== "none", items are skipped entirely
      // and remain visible on their platforms until the active power-up expires.
      //
      // Pretzel Boots special path:
      //   - Collected via the same AABB check as other power-ups.
      //   - If a platform bounce happened this frame (hit === true), apply the
      //     jump multiplier immediately to velocityY (already set to JUMP_VELOCITY).
      //   - If collected mid-air (no bounce this frame), set pretzelBootsPending.
      //     The multiplier will be applied on the next platform bounce (step 9b
      //     would need to re-check on the following frame). For simplicity,
      //     pretzelBootsPending is stored as a shared value so it persists across
      //     frames and is consumed on the first subsequent bounce.
      //
      //   pretzelBoots NEVER write to activePowerUpState — they are instant.
      // -----------------------------------------------------------------------
      if (GV.activePowerUpState.value.type === "none") {
        const collected = checkPowerUpCollection(
          GV.playerX.value,
          GV.playerY.value,
          GV.powerUps.value,
        )

        if (collected !== null) {
          if (collected === "pretzelBoots") {
            if (hit) {
              // Bounce happened same frame — apply multiplier directly.
              GV.velocityY.value = JUMP_VELOCITY * PRETZEL_JUMP_MULTIPLIER
              logFromWorklet(
                "powerUp",
                "pretzelBoots: mega bounce on collection frame",
                {
                  newVelocityY: GV.velocityY.value,
                },
              )
            } else {
              // Mid-air collection — arm the pending flag for next bounce.
              GV.pretzelBootsPending.value = true
              logFromWorklet(
                "powerUp",
                "pretzelBoots: collected mid-air, pending next bounce",
              )
            }
          } else {
            // Timed power-up — write state atomically.
            let duration = 0
            let invincible = false

            if (collected === "foamHat") {
              duration = FOAM_HAT_DURATION_MS
              invincible = false
            } else if (collected === "jetpack") {
              duration = JETPACK_DURATION_MS
              invincible = true
            } else if (collected === "bottleRocket") {
              duration = ROCKET_DURATION_MS
              invincible = true
            }

            GV.activePowerUpState.modify((state) => {
              "worklet"
              state.type = collected
              state.timerMs = duration
              state.invincible = invincible
              return state
            })

            logFromWorklet("powerUp", "power-up activated", {
              type: collected,
              duration,
              invincible,
            })
          }
        }
      }

      // -----------------------------------------------------------------------
      // 10b. Pretzel Boots pending bounce
      //
      // If boots were collected mid-air in a previous frame and a bounce just
      // happened, apply the multiplier now and clear the pending flag.
      // -----------------------------------------------------------------------
      if (GV.pretzelBootsPending.value && hit) {
        GV.velocityY.value = JUMP_VELOCITY * PRETZEL_JUMP_MULTIPLIER
        GV.pretzelBootsPending.value = false
        logFromWorklet(
          "powerUp",
          "pretzelBoots: pending mega bounce consumed",
          {
            newVelocityY: GV.velocityY.value,
          },
        )
      }

      GV.isAirborne.value =
        GV.velocityY.value > 0.01 || GV.velocityY.value < -0.01

      // 11. Camera
      const scrollThreshold = GV.playerY.value - SCREEN_HEIGHT * 0.4
      if (scrollThreshold < GV.cameraY.value) {
        GV.cameraY.value = scrollThreshold
      }

      // 12. Score
      GV.score.value = Math.floor(Math.abs(GV.cameraY.value) / SCORE_PER_UNIT)

      const newScore = GV.score.value
      if (newScore !== prevScore && newScore % 100 === 0 && newScore > 0) {
        logFromWorklet("gameLoop", "score milestone", {
          score: newScore,
          cameraY: GV.cameraY.value,
          playerY: GV.playerY.value,
        })
      }

      // 13. Recycle platforms (now takes powerUpPool as third argument)
      recyclePlatforms(
        GV.platforms.value,
        GV.enemies.value,
        GV.powerUps.value,
        GV.cameraY.value,
        GV.rngState.value,
      )

      // 14. Death check
      if (GV.playerY.value > GV.cameraY.value + SCREEN_HEIGHT) {
        // Guard: enemy death path above already sets isDead and returns early,
        // so this branch only fires for fall deaths. The guard here prevents
        // any future code path that doesn't early-return from double-firing.
        if (!GV.isDead.value) {
          GV.isDead.value = true
          logFromWorklet("gameLoop", "death triggered", {
            playerY: GV.playerY.value,
            cameraY: GV.cameraY.value,
            score: GV.score.value,
          })
          runOnJS(onGameOver)(GV.score.value)
        }
      }
    },
    [onGameOver, onJump, onStomp, sensitivity],
  )

  // Register the callback INACTIVE. It is activated by restartRun() below.
  // This is the only registration in the entire app session — GameScreen
  // never unmounts so this call never re-runs.
  const frameCallback = useFrameCallback(gameTick, false)

  // -------------------------------------------------------------------------
  // restartRun
  //
  // Resets all game state and starts the frame callback. Called by GameScreen
  // when the player presses Play or Play Again. Never called automatically.
    // -------------------------------------------------------------------------
  const restartRun = useCallback(() => {
    // Prevents reading partially-reset state
    frameCallback.setActive(false)

    const newSeed = Date.now()
    log.info("gameLoop", "restartRun START", { seed: newSeed })

    // Pause + clear dead flag
    GV.isPaused.value = true
    GV.isDead.value = false

    // Reset all primitive shared values (including globalTime)
    GV.seed.value = newSeed
    GV.playerX.value = SCREEN_WIDTH / 2 - PLAYER_WIDTH / 2
    GV.playerY.value = SCREEN_HEIGHT - 160 - PLAYER_HEIGHT
    GV.velocityX.value = 0
    GV.velocityY.value = 0
    GV.cameraY.value = 0
    GV.score.value = 0
    GV.gyroX.value = 0
    GV.touchLeft.value = false
    GV.touchRight.value = false
    GV.globalTime.value = 0
    GV.isAirborne.value = false

    // Clear power-up active state and pending flag.
    // Cleared on JS thread here; the worklet will see the clean state on
    // the first frame because isPaused guards the tick until Step D unpause.
    GV.activePowerUpState.modify((state) => {
      "worklet"
      state.type = "none"
      state.timerMs = 0
      state.invincible = false
      return state
    })
    GV.pretzelBootsPending.value = false

    log.info("gameLoop", "restartRun — primitives + power-up state reset", {
      seed: newSeed,
    })

    // Reset RNG
    GV.rngState.modify((state) => {
      "worklet"
      state[0] = newSeed
      state[1] = 0
      state[2] = 0
      return state
    })

    // Reset enemy pool, power-up pool, platform pool, then unpause
    GV.enemies.modify((pool) => {
      "worklet"
      for (let i = 0; i < pool.length; i++) {
        pool[i].active = false
        pool[i].alive = false
        pool[i].y = -9999
      }
      return pool
    })

    GV.powerUps.modify((pool) => {
      "worklet"
      for (let i = 0; i < pool.length; i++) {
        pool[i].active = false
        pool[i].y = -9999
      }
      return pool
    })

    GV.platforms.modify((pool) => {
      "worklet"
      resetPlatforms(pool, newSeed)

      logFromWorklet("gameLoop", "platform pool reset on UI thread", {
        platformCount: pool.length,
        p0active: pool[0].active,
        p0x: pool[0].x,
        p0y: pool[0].y,
      })

      // Unpause here — pool is ready, worklet safe to tick once activated.
      GV.isPaused.value = false
      return pool
    })

    // Activate after GAME_START_DELAY_MS. lets the screen transition
    // animation complete before BeerGuy starts moving.
    setTimeout(() => {
      frameCallback.setActive(true)
      log.info("gameLoop", "restartRun COMPLETE — frame callback activated")
    }, GAME_START_DELAY_MS)
  }, [frameCallback])

  return {
    playerX: GV.playerX,
    playerY: GV.playerY,
    cameraY: GV.cameraY,
    platforms: GV.platforms,
    enemies: GV.enemies,
    powerUps: GV.powerUps,
    score: GV.score,
    globalTime: GV.globalTime,
    isAirborne: GV.isAirborne,
    jumpAnimActive: GV.jumpAnimActive,
    jumpAnimStartTime: GV.jumpAnimStartTime,
    activePowerUpState: GV.activePowerUpState,
    restartRun,
  }
}
