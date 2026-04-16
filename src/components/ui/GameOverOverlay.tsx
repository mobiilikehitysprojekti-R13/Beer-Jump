import { StyleSheet, View, Text, TouchableOpacity } from "react-native"
import { useActiveTheme } from '../../hooks/useActiveTheme'
import { ThemeBackdrop } from './ThemeBackdrop'

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
  const activeTheme = useActiveTheme()

  return (
    <View style={[styles.container, { backgroundColor: activeTheme.menuBackground }]}>
      <ThemeBackdrop scene={activeTheme.scene} />
      <Text style={[styles.title, { color: activeTheme.titleColor, fontFamily: activeTheme.fontFamily }]}>Game Over</Text>
      <Text style={[styles.score, { color: activeTheme.textColor, fontFamily: activeTheme.fontFamily }]}>Score: {score}</Text>
      <Text style={[styles.best, { color: activeTheme.titleColor, fontFamily: activeTheme.fontFamily }]}>Best: {personalBest}</Text>

      <TouchableOpacity style={[styles.button, { backgroundColor: activeTheme.buttonBackground }]} onPress={onPlayAgain}>
        <Text style={[styles.buttonText, { color: activeTheme.buttonTextColor, fontFamily: activeTheme.fontFamily }]}>Play Again</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.secondaryButton, { borderColor: activeTheme.cardBorder }]}
        onPress={onHome}
      >
        <Text style={[styles.buttonText, styles.secondaryButtonText, { color: activeTheme.titleColor, fontFamily: activeTheme.fontFamily }]}>
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
