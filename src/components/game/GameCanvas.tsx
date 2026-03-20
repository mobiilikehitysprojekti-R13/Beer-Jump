import { StyleSheet } from "react-native"
import { Canvas, Rect, Fill } from "@shopify/react-native-skia"
import { useDerivedValue, SharedValue } from "react-native-reanimated"
import { Platform } from "../../state/types"
import {
  PLATFORM_POOL_SIZE,
  PLATFORM_HEIGHT,
  PLATFORM_COLUMNS,
  SCREEN_WIDTH,
  PLAYER_WIDTH,
  PLAYER_HEIGHT,
} from "../../constants/gameConfig"

// Platform render width must match PlatformGenerator's columnX calculation exactly.
// Both use SCREEN_WIDTH / PLATFORM_COLUMNS so tiling is pixel-perfect.
const RENDER_PLATFORM_WIDTH = SCREEN_WIDTH / PLATFORM_COLUMNS

// AnimatedPlatformRect
// Renders one platform slot from the shared value pool.
// Uses useDerivedValue to extract this platform's screen-space x/y from the
// pool array — Skia subscribes to these derived values on the UI thread and
// redraws without touching React.
// Inactive platforms are pushed off-screen to -9999 rather than conditionally
// rendered — conditional rendering inside a Skia <Canvas> causes React
// reconciliation overhead on every frame.
type PlatformRectProps = {
  index: number
  platforms: SharedValue<Platform[]>
  cameraY: SharedValue<number>
}

function AnimatedPlatformRect({
  index,
  platforms,
  cameraY,
}: PlatformRectProps) {
  const x = useDerivedValue(() => {
    const p = platforms.value[index]
    return p && p.active ? p.x : -9999
  })

  const y = useDerivedValue(() => {
    const p = platforms.value[index]
    return p && p.active ? p.y - cameraY.value : -9999
  })

  return (
    <Rect
      x={x}
      y={y}
      width={RENDER_PLATFORM_WIDTH}
      height={PLATFORM_HEIGHT}
      color='#4CAF50'
    />
  )
}

// GameCanvas
// Full-screen Skia canvas. Reads shared values each frame and renders:
//   - Dark background
//   - Platform pool (PLATFORM_POOL_SIZE fixed slots)
//   - BeerGuy (amber rectangle — sprite placeholder for Phase 3)
// Skia natively accepts SharedValue<number> as animated props — no
// useAnimatedProps needed. The canvas redraws on the UI thread whenever any
// subscribed shared value changes, with no React re-renders.
// screenPlayerY is derived on the UI thread: playerY (world-space) minus
// cameraY gives the player's position relative to the top of the screen.
// playerX is already screen-space (world and screen share the same X axis).
type Props = {
  playerX: SharedValue<number>
  playerY: SharedValue<number>
  cameraY: SharedValue<number>
  platforms: SharedValue<Platform[]>
}

export function GameCanvas({ playerX, playerY, cameraY, platforms }: Props) {
  const screenPlayerY = useDerivedValue(() => playerY.value - cameraY.value)

  return (
    <Canvas style={StyleSheet.absoluteFill}>
      {/* Background */}
      <Fill color='#1a1a2e' />

      {/* Platform pool — fixed number of slots, never conditionally rendered */}
      {Array.from({ length: PLATFORM_POOL_SIZE }).map((_, i) => (
        <AnimatedPlatformRect
          key={i}
          index={i}
          platforms={platforms}
          cameraY={cameraY}
        />
      ))}

      {/* BeerGuy — amber rectangle (Phase 3: replace with pixel art sprite) */}
      <Rect
        x={playerX}
        y={screenPlayerY}
        width={PLAYER_WIDTH}
        height={PLAYER_HEIGHT}
        color='#FFA000'
      />
    </Canvas>
  )
}
