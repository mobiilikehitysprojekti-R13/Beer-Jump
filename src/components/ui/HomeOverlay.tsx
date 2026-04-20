import { useAppStore } from "../../state/appStore"
import { StyleSheet, View, Text, TouchableOpacity } from "react-native"
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useActiveTheme } from '../../hooks/useActiveTheme'
import { ThemeBackdrop } from './ThemeBackdrop'

// HomeOverlay
// Renders the home / main menu UI as a full-screen View overlay inside
// GameScreen. Previously this was a separate navigator screen (HomeScreen).
// It was moved to an overlay so GameScreen never unmounts — the root fix
// for BUG-9 (frame callback accumulation on remount).
// Props:
//   onPlay — called when the player presses Play. GameScreen transitions
//            game phase to "playing" and calls restartRun().
//   onShowLeaderboard — called when the player presses Leaderboard.
//   onShowSettings — called when the player presses Settings.
//   onShowShop — called when the player presses Shop.
//   onShowInventory — called when the player presses Inventory.
// personalBest is read directly from Zustand here — this overlay is
// purely presentational and not in the hot render path of the game loop.
// Visual design is identical to HomeScreen and will be replaced with
// pixel art assets in Phase 3.
type Props = {
  onPlay: () => void
  onShowLeaderboard: () => void
  onShowSettings: () => void
  onShowShop: () => void
  onShowInventory: () => void
}

const selectPersonalBest = (s: ReturnType<typeof useAppStore.getState>) =>
  s.personalBest
const selectCoins = (s: ReturnType<typeof useAppStore.getState>) =>
  s.coins

export function HomeOverlay({ onPlay, onShowLeaderboard, onShowSettings, onShowShop, onShowInventory }: Props) {
  const personalBest = useAppStore(selectPersonalBest)
  const coins = useAppStore(selectCoins)
  const activeTheme = useActiveTheme()
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.container, { backgroundColor: activeTheme.menuBackground }]}>
      <ThemeBackdrop scene={activeTheme.scene} />
      <View style={[styles.coinsBadge, { top: insets.top + 8, backgroundColor: activeTheme.badgeBackground, borderColor: activeTheme.badgeBorder }]}>
        <MaterialCommunityIcons name='cash-multiple' size={18} color='#FFD54F' />
        <Text style={[styles.coinsBadgeText, { color: activeTheme.titleColor, fontFamily: activeTheme.fontFamily }]}>{coins}</Text>
      </View>
      <Text style={[styles.title, { color: activeTheme.titleColor, fontFamily: activeTheme.fontFamily }]}>Beer Jump</Text>
      <Text style={[styles.best, { color: activeTheme.textColor, fontFamily: activeTheme.fontFamily }]}>Best: {personalBest}</Text>
      <TouchableOpacity style={[styles.button, { backgroundColor: activeTheme.buttonBackground }]} onPress={onPlay}>
        <Text style={[styles.buttonText, { color: activeTheme.buttonTextColor, fontFamily: activeTheme.fontFamily }]}>Play</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.button, { backgroundColor: activeTheme.buttonBackground }]} onPress={onShowLeaderboard}>
        <Text style={[styles.buttonText, { color: activeTheme.buttonTextColor, fontFamily: activeTheme.fontFamily }]}>Leaderboard</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.button, { backgroundColor: activeTheme.buttonBackground }]} onPress={onShowSettings}>
        <Text style={[styles.buttonText, { color: activeTheme.buttonTextColor, fontFamily: activeTheme.fontFamily }]}>Settings</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.button, { backgroundColor: activeTheme.buttonBackground }]} onPress={onShowShop}>
        <Text style={[styles.buttonText, { color: activeTheme.buttonTextColor, fontFamily: activeTheme.fontFamily }]}>Shop</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.button, { backgroundColor: activeTheme.buttonBackground }]} onPress={onShowInventory}>
        <Text style={[styles.buttonText, { color: activeTheme.buttonTextColor, fontFamily: activeTheme.fontFamily }]}>Inventory</Text>
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
    gap: 24,
  },
  coinsBadge: {
    position: "absolute",
    top: 18,
    right: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(26, 26, 46, 0.75)",
    borderWidth: 1,
    borderColor: "rgba(255, 213, 79, 0.5)",
  },
  coinsBadgeText: {
    color: "#FFD54F",
    fontSize: 18,
    fontWeight: "800",
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