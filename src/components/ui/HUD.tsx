import { useState } from "react"
import { StyleSheet, TouchableOpacity, Text, View } from "react-native"
import {
  useAnimatedReaction,
  runOnJS,
  SharedValue,
} from "react-native-reanimated"
import { useActiveTheme } from "../../hooks/useActiveTheme"

// HUD
// Displays the live score and a pause button during play.
// When paused, renders a full-screen overlay with a Resume button.
// Score display: useAnimatedReaction watches score.value on the UI thread
// and calls runOnJS(setDisplayScore) only when the value changes — one React
// re-render per score increment, never on every frame.
// Pause display: same pattern — useAnimatedReaction watches isPaused.value
// and drives displayPaused React state. This means the pause overlay is a
// plain React View toggled by state, with no extra Skia or Animated
// machinery needed.
// pointerEvents behaviour:
//   - Outer container: "box-none" so touches fall through to GameCanvas and
//     TouchZones when the overlay is not visible.
//   - Pause overlay: "auto" (default) — captures all touches when visible,
//     preventing accidental game input while paused.
type Props = {
  score: SharedValue<number>
  isPaused: SharedValue<boolean>
  onPause: () => void
  onResume: () => void
}

export function HUD({ score, isPaused, onPause, onResume }: Props) {
  const [displayScore, setDisplayScore] = useState(0)
  const [displayPaused, setDisplayPaused] = useState(false)
  const activeTheme = useActiveTheme()

  useAnimatedReaction(
    () => score.value,
    (current, previous) => {
      if (current !== previous) {
        runOnJS(setDisplayScore)(current)
      }
    },
  )

  useAnimatedReaction(
    () => isPaused.value,
    (current, previous) => {
      if (current !== previous) {
        runOnJS(setDisplayPaused)(current)
      }
    },
  )

  return (
    <View style={styles.container} pointerEvents='box-none'>
      {/* Top bar — always visible */}
      <View style={styles.topBar}>
        <Text style={[styles.scoreText, { color: activeTheme.textColor, fontFamily: activeTheme.fontFamily }]}>Score: {displayScore}</Text>
        {!displayPaused && (
          <TouchableOpacity
            onPress={onPause}
            style={[styles.pauseButton, { borderColor: activeTheme.textColor }]}
          >
            <View style={styles.pauseGlyph}>
              <View style={[styles.pauseBar, { backgroundColor: activeTheme.textColor }]} />
              <View style={[styles.pauseBar, { backgroundColor: activeTheme.textColor }]} />
            </View>
          </TouchableOpacity>
        )}
      </View>

  {/* We removed the internal pause overlay.
      Pause control is now handled by PauseOverlay with transparent background. */}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-start",
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 8,
  },
  scoreText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "bold",
  },
  pauseButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  pauseGlyph: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  pauseBar: {
    width: 5,
    height: 18,
    borderRadius: 2,
  },

  // Pause overlay — sits above everything, semi-transparent dark fill
  pauseOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    alignItems: "center",
    justifyContent: "center",
    gap: 32,
  },
  pauseTitle: {
    color: "#FFFFFF",
    fontSize: 42,
    fontWeight: "bold",
    letterSpacing: 2,
  },
  resumeButton: {
    backgroundColor: "#FFA000",
    paddingHorizontal: 48,
    paddingVertical: 16,
    borderRadius: 8,
  },
  resumeText: {
    color: "#1a1a2e",
    fontSize: 22,
    fontWeight: "bold",
  },
})
