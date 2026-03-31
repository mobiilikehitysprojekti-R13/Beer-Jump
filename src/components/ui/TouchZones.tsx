import { StyleSheet, View, Pressable } from "react-native"
import { touchLeft, touchRight } from "../../state/gameValues"
import { useAppStore } from "../../state/appStore"

// TouchZones
// Two transparent full-height Pressable zones covering the left and right
// halves of the screen. Rendered above GameCanvas but below HUD in the
// component stack (see GameScreen layer order).
// onPressIn/Out write directly to shared values — the UI thread worklet in
// useGameLoop reads touchLeft/touchRight each frame and calls applyTouchInput.
// Reads touchControlsEnabled from Zustand (React rendering) rather than the
// shared value — the shared value is for the worklet, Zustand is for React.
// Returns null immediately if touch controls are disabled so no invisible
// Pressables interfere with any future UI elements.
// pointerEvents="box-none" on the outer View ensures touches pass through
// to GameCanvas for any future canvas-layer interactions.
export function TouchZones() {
  const enabled = useAppStore((s) => s.touchControlsEnabled)

  if (!enabled) return null

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents='box-none'>
      <View style={styles.row}>
        <Pressable
          style={styles.half}
          onPressIn={() => {
            touchLeft.value = true
          }}
          onPressOut={() => {
            touchLeft.value = false
          }}
        />
        <Pressable
          style={styles.half}
          onPressIn={() => {
            touchRight.value = true
          }}
          onPressOut={() => {
            touchRight.value = false
          }}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flex: 1,
    flexDirection: "row",
  },
  half: {
    flex: 1,
    backgroundColor: "transparent",
  },
})
