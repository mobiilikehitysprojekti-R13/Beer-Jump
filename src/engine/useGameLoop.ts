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

      // 5. Gravity
      GV.velocityY.value = applyGravity(GV.velocityY.value, dt)

      // 6. Move — capture prevPy before move for accurate collision (Key Rule 12)
      const prevPy = GV.playerY.value
      GV.playerX.value = wrapHorizontal(
        GV.playerX.value + GV.velocityX.value * dt,
      )
      GV.playerY.value = GV.playerY.value + GV.velocityY.value * dt

      const wrappedX = GV.playerX.value
      if (wrappedX === SCREEN_WIDTH || wrappedX === -PLAYER_WIDTH) {
        logFromWorklet("physics", "screen wrap", { newX: wrappedX })
      }

      // 7. Platform tick loop — moving patrol + breakable crumble timer.
      //    No dynamic allocation. Mutates platform objects in place.
      //    Disappearing platforms have no per-instance tick — their animation
      //    is derived from GV.globalTime in GameCanvas on the UI thread.
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

      // 7b. Enemy tick loop — horizontal patrol for all active enemies.
      const enems = GV.enemies.value
      for (let i = 0; i < MAX_ENEMIES; i++) {
        if (enems[i].active) tickEnemy(enems[i], dt)
      }

      // 8. Enemy collision — checked before platform collision so a stomp
      //    registers as a bounce rather than falling through the enemy.
      const enemyResult = checkEnemyCollision(
        GV.playerX.value,
        GV.playerY.value,
        prevPy,
        GV.velocityY.value,
        GV.enemies.value,
      )
      if (enemyResult === "stomp") {
        // Silent normal bounce — same velocity as a platform landing
        GV.velocityY.value = JUMP_VELOCITY
      } else if (enemyResult === "death") {
        GV.isDead.value = true
        runOnJS(onGameOver)(GV.score.value)
        return
      }

      // 8b. Platform collision
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

      GV.isAirborne.value =
        GV.velocityY.value > 0.01 || GV.velocityY.value < -0.01

      // 9. Camera — advance when player enters upper 40% of visible screen
      const scrollThreshold = GV.playerY.value - SCREEN_HEIGHT * 0.4
      if (scrollThreshold < GV.cameraY.value) {
        GV.cameraY.value = scrollThreshold
      }

      // 10. Score
      GV.score.value = Math.floor(Math.abs(GV.cameraY.value) / SCORE_PER_UNIT)

      const newScore = GV.score.value
      if (newScore !== prevScore && newScore % 100 === 0 && newScore > 0) {
        logFromWorklet("gameLoop", "score milestone", {
          score: newScore,
          cameraY: GV.cameraY.value,
          playerY: GV.playerY.value,
        })
      }

      // 11. Recycle off-screen platforms (and enemies)
      recyclePlatforms(
        GV.platforms.value,
        GV.enemies.value,
        GV.cameraY.value,
        GV.rngState.value,
      )

      // 12. Death check — playerY > bottom edge of visible screen
      if (GV.playerY.value > GV.cameraY.value + SCREEN_HEIGHT) {
        // Guard: enemy death path above already sets isDead and returns early,
        // so this branch only fires for fall deaths. The guard here prevents
        // any future code path that doesn't early-return from double-firing.
        if (!GV.isDead.value) {
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
  //   Step B — reset all primitive shared values (including globalTime)
  //   Step C — reset RNG state on UI thread
  //   Step D — reset platform pool on UI thread, then unpause
  //   Step E — activate frame callback after GAME_START_DELAY_MS
  //
  // globalTime is reset to 0 in Step B so every run starts with all
  // disappearing platforms at the beginning of Phase D (fully visible).
  // This is the most forgiving starting state for the player.
  // -------------------------------------------------------------------------
  const restartRun = useCallback(() => {
    // Step 0: deactivate — prevents reading partially-reset state
    frameCallback.setActive(false)

    const newSeed = Date.now()
    log.info("gameLoop", "restartRun START", { seed: newSeed })

    // Step A
    GV.isPaused.value = true
    GV.isDead.value = false

    // Step B — reset all primitives including globalTime
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
    GV.globalTime.value = 0
    GV.isAirborne.value = false

    log.info("gameLoop", "restartRun — primitives set", {
      seed: newSeed,
      playerX: SCREEN_WIDTH / 2 - PLAYER_WIDTH / 2,
      playerY: SCREEN_HEIGHT - 160 - PLAYER_HEIGHT,
    })

    // Step C: reset RNG on UI thread — including rowsGenerated counter
    GV.rngState.modify((state) => {
      "worklet"
      state[0] = newSeed
      state[1] = 0
      state[2] = 0 // rowsGenerated — resets tier to 1 on every new run
      return state
    })

    // Step D: reset platform pool + enemy pool on UI thread, then unpause
    GV.enemies.modify((pool) => {
      "worklet"
      for (let i = 0; i < pool.length; i++) {
        pool[i].active = false
        pool[i].alive = false
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

  return {
    playerX: GV.playerX,
    playerY: GV.playerY,
    cameraY: GV.cameraY,
    platforms: GV.platforms,
    enemies: GV.enemies,
    score: GV.score,
    globalTime: GV.globalTime,
    isAirborne: GV.isAirborne,
    jumpAnimActive: GV.jumpAnimActive,
    jumpAnimStartTime: GV.jumpAnimStartTime,
    restartRun,
  }
}
