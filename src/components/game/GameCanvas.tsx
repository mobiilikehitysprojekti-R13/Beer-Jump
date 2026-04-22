import { StyleSheet } from "react-native"
import {
  Canvas,
  Fill,
  Image as SkiaImage,
  Picture,
  Rect,
  createPicture,
  Skia,
  useImage,
} from "@shopify/react-native-skia"
import {
  SharedValue, 
  useDerivedValue,
} from "react-native-reanimated"
import { Enemy, Platform, ActivePowerUpState, PowerUp } from "../../state/types"
import {
  CHARACTER_RENDER_CONTACT_OFFSET,
  PLATFORM_POOL_SIZE,
  PLATFORM_HEIGHT,
  PLATFORM_COLUMNS,
  SCREEN_WIDTH,
  SCREEN_HEIGHT,
  PLAYER_WIDTH,
  PLAYER_HEIGHT,
  CRUMBLE_DELAY_MS,
  DISAPPEAR_PERIOD_MS,
  FAKE_PLATFORM_ALPHA,
  MAX_ENEMIES,
  MAX_POWER_UPS_ON_SCREEN,
  POWER_UP_WIDTH,
  POWER_UP_HEIGHT,
  COLOR_POWER_UP_PRETZEL,
  COLOR_POWER_UP_FOAM_HAT,
  COLOR_POWER_UP_JETPACK,
  COLOR_POWER_UP_ROCKET,
} from "../../constants/gameConfig"

// ---------------------------------------------------------------------------
// Render geometry computed once at module load.
// ---------------------------------------------------------------------------
const RENDER_PLATFORM_WIDTH = SCREEN_WIDTH / PLATFORM_COLUMNS
const PLAYER_RENDER_WIDTH = PLAYER_WIDTH * 2.4
const PLAYER_RENDER_HEIGHT = PLAYER_HEIGHT * 4.2

// ---------------------------------------------------------------------------
// Platform colors hardcoded hex, must NOT invert in dark mode.
// ---------------------------------------------------------------------------
const COLOR_STATIC = Skia.Color("#4CAF50") // green
const COLOR_MOVING = Skia.Color("#2196F3") // blue
const COLOR_FAKE = Skia.Color("#9E9E9E") // grey
const COLOR_DISAPPEARING = Skia.Color("#FF9800") // amber
const COLOR_BREAKABLE = Skia.Color("#F44336") // red
const COLOR_HIGHLIGHT = Skia.Color("#FFFFFF") // white top-edge highlight
const COLOR_ENEMY = Skia.Color("#36013F") // deep purple

// Power-up placeholder colors — allocated once, reused per frame.
const COLOR_PU_PRETZEL = Skia.Color(COLOR_POWER_UP_PRETZEL) // golden brown
const COLOR_PU_FOAM_HAT = Skia.Color(COLOR_POWER_UP_FOAM_HAT) // cyan
const COLOR_PU_JETPACK = Skia.Color(COLOR_POWER_UP_JETPACK) // orange-red
const COLOR_PU_ROCKET = Skia.Color(COLOR_POWER_UP_ROCKET) // hot pink

// Reusable paint — allocated once.
const paint = Skia.Paint()

// ---------------------------------------------------------------------------
// GameCanvas
//
// Renders the game world using a single Skia Picture for all platforms.
// No sprite files, no Atlas, no images. Platforms are procedural colored
// rectangles with continuous math animations.
//
// Rendering pipeline:
//   useDerivedValue (UI thread, every frame)
//     → createPicture: loops PLATFORM_POOL_SIZE slots, draws active ones
//     → <Picture picture={...} />  — one GPU draw call
//
// Animation model:
//   disappearing — sine wave: opacity = 0.5 + 0.5 × sin(t × 2π / PERIOD)
//                  All instances share globalTime → animate in unison.
//   breakable    — linear drain: opacity = 1 − (crumbleTimer / CRUMBLE_DELAY_MS)
//                  Per-instance, triggered by first landing.
//   fake         — constant FAKE_PLATFORM_ALPHA. No animation.
//   static       — fully opaque. No animation.
//   moving       — fully opaque. Position animated by physics tick.
//
// Visual language:
//   Every platform gets a 2px white highlight strip along the top edge.
//   This reads as a surface the player can land on and separates platforms
//   from the dark background at a glance.
//
// Culling:
//   Platforms with screenY > SCREEN_HEIGHT or screenY + PLATFORM_HEIGHT < 0
//   are skipped. Typically only 8–12 platforms draw per frame out of 120 slots.
//
// BeerGuy: still an amber <Rect> placeholder (Phase 3: sprite).
// ---------------------------------------------------------------------------
type Props = {
  playerX: SharedValue<number>
  playerY: SharedValue<number>
  cameraY: SharedValue<number>
  platforms: SharedValue<Platform[]>
  enemies: SharedValue<Enemy[]>
  powerUps: SharedValue<PowerUp[]>
  activePowerUpState: SharedValue<ActivePowerUpState>
  globalTime: SharedValue<number>
  backgroundColor: string
  backgroundScene: "plain" | "sunrise"
  characterTextureName: string
}

export function GameCanvas({
  playerX,
  playerY,
  cameraY,
  platforms,
  enemies,
  powerUps,
  activePowerUpState,
  globalTime,
  backgroundColor,
  backgroundScene,
  characterTextureName,
}: Props) {
  const bottleImage = useImage(
    require("../../../assets/textures/characters/corona_bottle_1.png"),
  )
  const isBottleCharacter =
    characterTextureName === "corona_bottle" ||
    characterTextureName === "beer_bottle"

  // -------------------------------------------------------------------------
  // platformPicture — the entire platform scene recorded as a Skia display list.
  //
  // createPicture(cb) calls cb with an SkCanvas, records all draw commands,
  // and returns an SkPicture. Skia replays it in one GPU pass.
  //
  // The worklet runs on the UI thread inside useDerivedValue, subscribing to
  // platforms, cameraY, and globalTime. It re-records whenever any of those
  // change — i.e. every frame during gameplay.
  //
  // TWO_PI is captured as a local constant to avoid repeated property lookup
  // inside the hot loop.
  // -------------------------------------------------------------------------
  const platformPicture = useDerivedValue(() => {
    "worklet"
    const cam = cameraY.value
    const t = globalTime.value
    const TWO_PI = 6.283185307

    return createPicture((canvas) => {
      for (let i = 0; i < PLATFORM_POOL_SIZE; i++) {
        const p = platforms.value[i]
        if (!p || !p.active) continue

        const screenY = p.y - cam

        // Cull — skip fully off-screen platforms
        if (screenY > SCREEN_HEIGHT || screenY + PLATFORM_HEIGHT < 0) continue

        // --- Determine color and alpha for this platform type ---
        let color: ReturnType<typeof Skia.Color>
        let alpha: number

        if (p.type === "static") {
          color = COLOR_STATIC
          alpha = 1
        } else if (p.type === "moving") {
          color = COLOR_MOVING
          alpha = 1
        } else if (p.type === "fake") {
          color = COLOR_FAKE
          alpha = FAKE_PLATFORM_ALPHA
        } else if (p.type === "disappearing") {
          color = COLOR_DISAPPEARING
          // Sine wave: oscillates smoothly 0.0 ↔ 1.0
          alpha = 0.5 + 0.5 * Math.sin((t * TWO_PI) / DISAPPEAR_PERIOD_MS)
        } else if (p.type === "breakable") {
          color = COLOR_BREAKABLE
          // Linear drain after trigger, fully opaque before
          alpha = p.crumbling
            ? Math.max(0, 1 - p.crumbleTimer / CRUMBLE_DELAY_MS)
            : 1
        } else {
          color = COLOR_STATIC
          alpha = 1
        }

        // --- Draw platform body ---
        paint.setColor(color)
        paint.setAlphaf(alpha)
        canvas.drawRect(
          Skia.XYWHRect(p.x, screenY, RENDER_PLATFORM_WIDTH, PLATFORM_HEIGHT),
          paint,
        )

        // --- Draw top-edge highlight strip ---
        // 2px white line at full alpha × 0.35, gives a clean surface read
        paint.setColor(COLOR_HIGHLIGHT)
        paint.setAlphaf(alpha * 0.35)
        canvas.drawRect(
          Skia.XYWHRect(p.x, screenY, RENDER_PLATFORM_WIDTH, 2),
          paint,
        )
      }
    })
  })

  // enemyPicture — all flying enemies in one GPU draw call via Picture.
  // Enemies are 2 column-widths wide and float at row Y with no platform.
  // Visual: dark red body with a 2px highlight on top and bottom edges
  // to read as a flying object distinct from grounded platforms.
  const enemyPicture = useDerivedValue(() => {
    "worklet"
    const cam = cameraY.value

    return createPicture((canvas) => {
      for (let i = 0; i < MAX_ENEMIES; i++) {
        const e = enemies.value[i]
        if (!e || !e.active || !e.alive) continue

        const screenY = e.y - cam

        // Cull — skip fully off-screen enemies
        if (screenY > SCREEN_HEIGHT || screenY + e.height < 0) continue

        // Body
        paint.setColor(COLOR_ENEMY)
        paint.setAlphaf(1)
        canvas.drawRect(Skia.XYWHRect(e.x, screenY, e.width, e.height), paint)

        // Top highlight strip
        paint.setColor(COLOR_HIGHLIGHT)
        paint.setAlphaf(0.45)
        canvas.drawRect(Skia.XYWHRect(e.x, screenY, e.width, 2), paint)

        // Bottom highlight strip — signals flying (no platform beneath)
        paint.setColor(COLOR_HIGHLIGHT)
        paint.setAlphaf(0.2)
        canvas.drawRect(
          Skia.XYWHRect(e.x, screenY + e.height - 2, e.width, 2),
          paint,
        )
      }
    })
  })

  // -------------------------------------------------------------------------
  // powerUpPicture — all active power-up items in one GPU draw call.
  //
  // Each power-up is rendered as a small filled rectangle (placeholder) with:
  //   - A 2px white highlight strip on top (same visual language as platforms)
  //   - A small type indicator stripe on the bottom edge (distinct per type)
  //
  // The color per type is defined in gameConfig.ts so it is consistent with
  // the HUD indicator colors.
  //
  // Power-up items that are active but belong to a run where the player has
  // an active power-up are still rendered — they just cannot be collected.
  // This is intentional: the player can see them and plan to collect them
  // after their current power-up expires.
  //
  // Sprite integration path: replace canvas.drawRect with canvas.drawImageRect
  // for each type inside this loop. No structural change needed.
  // -------------------------------------------------------------------------
  const powerUpPicture = useDerivedValue(() => {
    "worklet"
    const cam = cameraY.value

    return createPicture((canvas) => {
      for (let i = 0; i < MAX_POWER_UPS_ON_SCREEN; i++) {
        const pu = powerUps.value[i]
        if (!pu || !pu.active) continue

        const screenY = pu.y - cam
        if (screenY > SCREEN_HEIGHT || screenY + POWER_UP_HEIGHT < 0) continue

        // Pick color by type
        let color: ReturnType<typeof Skia.Color>
        if (pu.type === "pretzelBoots") {
          color = COLOR_PU_PRETZEL
        } else if (pu.type === "foamHat") {
          color = COLOR_PU_FOAM_HAT
        } else if (pu.type === "jetpack") {
          color = COLOR_PU_JETPACK
        } else {
          color = COLOR_PU_ROCKET
        }

        // Main body
        paint.setColor(color)
        paint.setAlphaf(1)
        canvas.drawRect(
          Skia.XYWHRect(pu.x, screenY, POWER_UP_WIDTH, POWER_UP_HEIGHT),
          paint,
        )

        // Top highlight strip — same visual language as platforms
        paint.setColor(COLOR_HIGHLIGHT)
        paint.setAlphaf(0.5)
        canvas.drawRect(Skia.XYWHRect(pu.x, screenY, POWER_UP_WIDTH, 2), paint)

        // Bottom accent strip — 3px darker band to distinguish from platforms
        paint.setColor(COLOR_HIGHLIGHT)
        paint.setAlphaf(0.15)
        canvas.drawRect(
          Skia.XYWHRect(pu.x, screenY + POWER_UP_HEIGHT - 3, POWER_UP_WIDTH, 3),
          paint,
        )
      }
    })
  })

  // -------------------------------------------------------------------------
  // Player rendering — Skia image or amber rect placeholder.
  //
  // While a jetpack or bottleRocket is active we render a simple glow ring
  // around BeerGuy using a slightly larger semi-transparent rect of the
  // power-up color. This is placeholder until sprite assets land.
  // -------------------------------------------------------------------------
  const screenPlayerY = useDerivedValue(() => playerY.value - cameraY.value)
  const screenPlayerHitboxX = useDerivedValue(() => playerX.value)
  const screenPlayerX = useDerivedValue(() => playerX.value - (PLAYER_RENDER_WIDTH - PLAYER_WIDTH) / 2)
  const screenPlayerRenderY = useDerivedValue(
    () =>
      screenPlayerY.value -
      (PLAYER_RENDER_HEIGHT - PLAYER_HEIGHT) +
      CHARACTER_RENDER_CONTACT_OFFSET,
  )

  // Glow rect around player during invincible power-ups (jetpack, bottleRocket)
  const playerGlowPicture = useDerivedValue(() => {
    "worklet"
    const puType = activePowerUpState.value.type
    const invincible = activePowerUpState.value.invincible
    const screenY = playerY.value - cameraY.value

    return createPicture((canvas) => {
      if (!invincible) return

      let glowColor: ReturnType<typeof Skia.Color>
      if (puType === "jetpack") {
        glowColor = COLOR_PU_JETPACK
      } else {
        glowColor = COLOR_PU_ROCKET
      }

      const GLOW = 8
      paint.setColor(glowColor)
      paint.setAlphaf(0.35)
      canvas.drawRect(
        Skia.XYWHRect(
          playerX.value - GLOW,
          screenY - GLOW,
          PLAYER_WIDTH + GLOW * 2,
          PLAYER_HEIGHT + GLOW * 2,
        ),
        paint,
      )
    })
  })

  return (
    <Canvas style={StyleSheet.absoluteFill}>
      {/* Background */}
      {backgroundScene === "plain" ? <Fill color={backgroundColor} /> : null}

      {/* All platforms — one GPU draw call */}
      <Picture picture={platformPicture} />

      {/* Power-up items — drawn above platforms, below enemies */}
      <Picture picture={powerUpPicture} />

      {/* All enemies — one GPU draw call */}
      <Picture picture={enemyPicture} />

      {/* Player invincibility glow (jetpack / bottleRocket) */}
      <Picture picture={playerGlowPicture} />

      {/* Character */}
      {isBottleCharacter && bottleImage ? (
        <SkiaImage
          image={bottleImage}
          x={screenPlayerX}
          y={screenPlayerRenderY}
          width={PLAYER_RENDER_WIDTH}
          height={PLAYER_RENDER_HEIGHT}
        />
      ) : (
        <Rect
          x={screenPlayerHitboxX}
          y={screenPlayerY}
          width={PLAYER_WIDTH}
          height={PLAYER_HEIGHT}
          color="#ff8c00"
        />
      )}
    </Canvas>
  )
}
