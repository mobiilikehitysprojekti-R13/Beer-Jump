import { useEffect } from "react"
import { StyleSheet, View, Text, TouchableOpacity } from "react-native"
import { Platform } from "react-native"
import { submitScore } from '../../services/firebase/leaderboard'

// GameOverOverlay
// Renders the game-over UI as a full-screen View overlay inside GameScreen.
// Previously this was a separate navigator screen (GameOverScreen). It was
// moved to an overlay to eliminate the GameScreen unmount/remount cycle that
// was the root cause of BUG-9 (frame callback accumulation).
// Props are passed directly from GameScreen — no navigation params, no Zustand
// reads here. personalBest is read by GameScreen and passed down so this
// component stays purely presentational.
// Visual design is identical to the old GameOverScreen and will be replaced
// with pixel art assets in Phase 3.
//
// Score submission:
//   onGameOver() is defined above the component (avoids temporal dead zone
//   from const hoisting) and called inside useEffect — never in the render
//   body. This ensures exactly one Firestore write per mount, regardless of
//   how many times React re-renders the component (Strict Mode, parent
//   updates, etc.).
//   TODO: replace hardcoded level/xp/coins/platform with values from
//   useAppStore.getState() and Platform.OS once progression is wired up.

// Defined above the component so the reference is fully initialised before
// the component function body executes (const is not hoisted like function).
const onGameOver = async (score: number) => {
  await submitScore(score, {
    level: 3,
    xp: 120,
    coins: 50,
    platform: Platform.OS as 'ios' | 'android',
  })
}

type Props = {
  score: number
  personalBest: number
  onPlayAgain: () => void
  onHome: () => void
}

export function GameOverOverlay({
  score,
  personalBest,
  onPlayAgain,
  onHome,
}: Props) {
  // Submit score once on mount — useEffect guarantees this never runs during
  // render, and the empty dep array guarantees it fires exactly once per
  // GameOverOverlay mount, not on subsequent re-renders.
  useEffect(() => {
    onGameOver(score)
  }, [])

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Game Over</Text>
      <Text style={styles.score}>Score: {score}</Text>
      <Text style={styles.best}>Best: {personalBest}</Text>

      <TouchableOpacity style={styles.button} onPress={onPlayAgain}>
        <Text style={styles.buttonText}>Play Again</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.secondaryButton]}
        onPress={onHome}
      >
        <Text style={[styles.buttonText, styles.secondaryButtonText]}>
          Home
        </Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#1a1a2e",
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
  },
  title: {
    color: "#FF5252",
    fontSize: 48,
    fontWeight: "bold",
  },
  score: {
    color: "#FFFFFF",
    fontSize: 28,
  },
  best: {
    color: "#FFA000",
    fontSize: 20,
  },
  button: {
    backgroundColor: "#FFA000",
    paddingHorizontal: 48,
    paddingVertical: 16,
    borderRadius: 8,
    marginTop: 8,
  },
  buttonText: {
    color: "#1a1a2e",
    fontSize: 22,
    fontWeight: "bold",
  },
  secondaryButton: {
    backgroundColor: "transparent",
    borderWidth: 2,
    borderColor: "#FFA000",
  },
  secondaryButtonText: {
    color: "#FFA000",
  },
})
