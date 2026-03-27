import { useState } from 'react'
import { StyleSheet, View, Text, TouchableOpacity } from "react-native"
import { useAppStore } from "../../state/appStore"
import { LeaderboardOverlay } from './LeaderboardOverlay'

// HomeOverlay
// Renders the home / main menu UI as a full-screen View overlay inside
// GameScreen. Previously this was a separate navigator screen (HomeScreen).
// It was moved to an overlay so GameScreen never unmounts — the root fix
// for BUG-9 (frame callback accumulation on remount).
// Props:
//   onPlay — called when the player presses Play. GameScreen transitions
//            game phase to "playing" and calls restartRun().
// personalBest is read directly from Zustand here — this overlay is
// purely presentational and not in the hot render path of the game loop.
// Visual design is identical to HomeScreen and will be replaced with
// pixel art assets in Phase 3.
type Props = {
  onPlay: () => void
}

const selectPersonalBest = (s: ReturnType<typeof useAppStore.getState>) =>
  s.personalBest

export function HomeOverlay({ onPlay }: Props) {
  const personalBest = useAppStore(selectPersonalBest)
  const [showLeaderboard, setShowLeaderboard] = useState(false)

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Beer Jump</Text>
      <Text style={styles.best}>Best: {personalBest}</Text>
      <TouchableOpacity style={styles.button} onPress={onPlay}>
        <Text style={styles.buttonText}>Play</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={() => setShowLeaderboard(true)}>
        <Text style={styles.buttonText}>Leaderboard</Text>
      </TouchableOpacity>

      <LeaderboardOverlay
        visible={showLeaderboard}
        onClose={() => setShowLeaderboard(false)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#1a1a2e",
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
  },
  title: {
    color: "#FFA000",
    fontSize: 48,
    fontWeight: "bold",
  },
  best: {
    color: "#FFFFFF",
    fontSize: 20,
  },
  button: {
    backgroundColor: "#FFA000",
    paddingHorizontal: 48,
    paddingVertical: 16,
    borderRadius: 8,
  },
  buttonText: {
    color: "#1a1a2e",
    fontSize: 24,
    fontWeight: "bold",
  },
})
