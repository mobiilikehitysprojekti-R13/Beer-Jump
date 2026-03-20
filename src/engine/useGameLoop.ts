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
} from "../constants/gameConfig"
import { log, logFromWorklet } from "../utils/logger"

// ---------------------------------------------------------------------------
// useGameLoop
//
// Drives the per-frame physics tick via Reanimated's useFrameCallback
// (UI thread, ~60fps) and exposes restartRun() for GameScreen to call.
//
// Key architectural decisions:
//
//   GameScreen is the permanent root screen — it never unmounts. This means
//   useFrameCallback registers exactly once per app session and is never
//   re-registered, which is the root fix for BUG-9.
//
//   restartRun() is NOT called automatically on mount. It is called only
//   when the player explicitly presses Play or Play Again in GameScreen.
//   This eliminates every remaining BUG-9 vector:
//     - No mount-triggered callback activation
//     - No stale setTimeout race from a previous restartRun() call
//     - No re-registration on Home navigation (GameScreen stays mounted,
//       but the game loop is simply idle while HomeOverlay is visible)
//
// onGameOver is called once per run via runOnJS when the death condition
// fires. It receives the final score and runs on the JS thread.
//
// sensitivity is passed as a plain number from GameScreen (read from Zustand
// there) so useGameLoop holds no Zustand subscription of its own.
//
// RNG: LCG seed stored in GV.rngState (SharedValue<number[]>) so
// recyclePlatforms can read/write it on the UI thread without closures.
// ---------------------------------------------------------------------------
export function useGameLoop(
  onGameOver: (score: number) => void,
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

      // 1. Guard — do nothing if paused or already dead
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

      // 3. Input — timeSinceFirstFrame null on frame 0, default to 0.
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

      // 4. Gravity
      GV.velocityY.value = applyGravity(GV.velocityY.value, dt)

      // 5. Move — capture prevPy before move for accurate collision (Key Rule 12)
      const prevPy = GV.playerY.value
      GV.playerX.value = wrapHorizontal(
        GV.playerX.value + GV.velocityX.value * dt,
      )
      GV.playerY.value = GV.playerY.value + GV.velocityY.value * dt

      const wrappedX = GV.playerX.value
      if (wrappedX === SCREEN_WIDTH || wrappedX === -PLAYER_WIDTH) {
        logFromWorklet("physics", "screen wrap", { newX: wrappedX })
      }

      // 6. Platform collision
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
        logFromWorklet("physics", "platform bounce", {
          px: GV.playerX.value,
          py: GV.playerY.value,
          screenY: GV.playerY.value - GV.cameraY.value,
          vyOnLanding: vyBeforeBounce,
          cameraY: GV.cameraY.value,
          score: GV.score.value,
        })
      }

      // 7. Camera — advance when player enters upper 40% of visible screen
      const scrollThreshold = GV.playerY.value - SCREEN_HEIGHT * 0.4
      if (scrollThreshold < GV.cameraY.value) {
        GV.cameraY.value = scrollThreshold
      }

      // 8. Score
      GV.score.value = Math.floor(Math.abs(GV.cameraY.value) / SCORE_PER_UNIT)

      const newScore = GV.score.value
      if (newScore !== prevScore && newScore % 100 === 0 && newScore > 0) {
        logFromWorklet("gameLoop", "score milestone", {
          score: newScore,
          cameraY: GV.cameraY.value,
          playerY: GV.playerY.value,
        })
      }

      // 9. Recycle off-screen platforms
      recyclePlatforms(GV.platforms.value, GV.cameraY.value, GV.rngState.value)

      // 10. Death check — playerY > bottom edge of visible screen
      if (GV.playerY.value > GV.cameraY.value + SCREEN_HEIGHT) {
        GV.isDead.value = true
        logFromWorklet("gameLoop", "death triggered", {
          playerY: GV.playerY.value,
          cameraY: GV.cameraY.value,
          deathThreshold: GV.cameraY.value + SCREEN_HEIGHT,
          distanceBelowThreshold:
            GV.playerY.value - (GV.cameraY.value + SCREEN_HEIGHT),
          score: GV.score.value,
          platformCount: GV.platforms.value.length,
          p0active: GV.platforms.value[0]?.active,
          p0y: GV.platforms.value[0]?.y,
          p1active: GV.platforms.value[1]?.active,
          p1y: GV.platforms.value[1]?.y,
        })
        runOnJS(onGameOver)(GV.score.value)
      }
    },
    [onGameOver, sensitivity],
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
  //
  // Sequence:
  //   Step 0 — deactivate any currently active callback
  //   Step A — pause + clear dead flag
  //   Step B — reset all primitive shared values
  //   Step C — reset RNG state on UI thread
  //   Step D — reset platform pool on UI thread, then unpause
  //   Step E — activate frame callback after GAME_START_DELAY_MS
  //
  // The GAME_START_DELAY_MS setTimeout in Step E allows the screen transition
  // animation (Play button press → game canvas appearing) to complete before
  // BeerGuy starts moving. INPUT_GRACE_MS then suppresses tilt/touch input
  // for the same duration after the callback activates.
  //
  // Pool-ready guarantee: isPaused is set false inside modify() on the UI
  // thread (Step D), so the worklet cannot tick until the pool is written.
  // -------------------------------------------------------------------------
  const restartRun = useCallback(() => {
    // Step 0: deactivate — prevents reading partially-reset state
    frameCallback.setActive(false)

    const newSeed = Date.now()
    log.info("gameLoop", "restartRun START", { seed: newSeed })

    // Step A
    GV.isPaused.value = true
    GV.isDead.value = false

    // Step B
    GV.seed.value = newSeed
    GV.playerX.value = SCREEN_WIDTH / 2 - PLAYER_WIDTH / 2
    GV.playerY.value = SCREEN_HEIGHT - 160 - PLAYER_HEIGHT // feet flush with p0
    GV.velocityX.value = 0
    GV.velocityY.value = 0
    GV.cameraY.value = 0
    GV.score.value = 0
    GV.gyroX.value = 0 // zero stale tilt from previous run
    GV.touchLeft.value = false
    GV.touchRight.value = false

    log.info("gameLoop", "restartRun — primitives set", {
      seed: newSeed,
      playerX: SCREEN_WIDTH / 2 - PLAYER_WIDTH / 2,
      playerY: SCREEN_HEIGHT - 160 - PLAYER_HEIGHT,
    })

    // Step C: reset RNG on UI thread
    GV.rngState.modify((state) => {
      "worklet"
      state[0] = newSeed
      state[1] = 0
      return state
    })

    // Step D: reset platform pool on UI thread, then unpause
    GV.platforms.modify((pool) => {
      "worklet"
      resetPlatforms(pool, newSeed)

      logFromWorklet("gameLoop", "platform pool reset on UI thread", {
        platformCount: pool.length,
        p0active: pool[0].active,
        p0x: pool[0].x,
        p0y: pool[0].y,
        p1active: pool[1].active,
        p1y: pool[1].y,
      })

      // Unpause here — pool is ready, worklet safe to tick once activated.
      GV.isPaused.value = false
      return pool
    })

    // Step E: activate after GAME_START_DELAY_MS — lets the screen transition
    // animation complete before BeerGuy starts moving.
    setTimeout(() => {
      frameCallback.setActive(true)
      log.info("gameLoop", "restartRun COMPLETE — frame callback activated")
    }, GAME_START_DELAY_MS)
  }, [frameCallback])

  // No mount useEffect — restartRun() is called only by explicit player action
  // (Play / Play Again buttons in GameScreen). GameScreen never unmounts, so
  // there is no mount/unmount lifecycle to manage here.
  //
  // No cleanup useEffect — Reanimated's internal useEffect handles
  // unregistration via its own memoised callback ID.

  return {
    playerX: GV.playerX,
    playerY: GV.playerY,
    cameraY: GV.cameraY,
    platforms: GV.platforms,
    score: GV.score,
    restartRun,
  }
}
