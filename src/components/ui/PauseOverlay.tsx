import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useActiveTheme } from '../../hooks/useActiveTheme'

type Props = {
  visible: boolean
  onResume: () => void
  onOpenSettings: () => void
  onQuit: () => void
}

export function PauseOverlay({ visible, onResume, onOpenSettings, onQuit }: Props) {
  const activeTheme = useActiveTheme()

  if (!visible) return null

  return (
    <View style={styles.container} pointerEvents="auto">
      <View style={styles.backdrop} />
      <View style={[styles.content, { backgroundColor: activeTheme.cardBackground, borderColor: activeTheme.cardBorder }]}>
        <Text style={[styles.title, { color: activeTheme.titleColor, fontFamily: activeTheme.fontFamily }]}>Paused</Text>
        <TouchableOpacity style={[styles.resumeButton, { backgroundColor: activeTheme.buttonBackground }]} onPress={onResume}>
          <Text style={[styles.resumeText, { color: activeTheme.buttonTextColor, fontFamily: activeTheme.fontFamily }]}>▶ Resume</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.quitButton, { backgroundColor: activeTheme.buttonBackground }]} onPress={onQuit}>
          <Text style={[styles.resumeText, { color: activeTheme.buttonTextColor, fontFamily: activeTheme.fontFamily }]}>Quit</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={[styles.settingsButton, { backgroundColor: activeTheme.badgeBackground, borderColor: activeTheme.badgeBorder }]} onPress={onOpenSettings}>
        <MaterialCommunityIcons name='cog-outline' size={28} color={activeTheme.titleColor} />
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.24)',
  },
  content: {
    width: '75%',
    padding: 24,
    borderRadius: 14,
    backgroundColor: 'rgba(26,26,46,0.9)',
    alignItems: 'center',
    borderWidth: 2,
  },
  title: {
    color: '#FFA000',
    fontSize: 42,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  resumeButton: {
    backgroundColor: '#FFA000',
    paddingHorizontal: 36,
    paddingVertical: 12,
    borderRadius: 10,
    minWidth: 220,
    alignItems: 'center',
  },
  quitButton: {
    marginTop: 10,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    minWidth: 220,
    alignItems: 'center',
  },
  resumeText: {
    color: '#1a1a2e',
    fontSize: 18,
    fontWeight: '700',
  },
  settingsButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    padding: 12,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
  },
})