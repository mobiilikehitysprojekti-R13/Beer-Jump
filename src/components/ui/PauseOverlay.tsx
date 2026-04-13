import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { usePlayClick } from '../../hooks/usePlayClick'
import { MaterialCommunityIcons } from '@expo/vector-icons'

type Props = {
  visible: boolean
  onResume: () => void
  onOpenSettings: () => void
}

export function PauseOverlay({ visible, onResume, onOpenSettings }: Props) {
  const playClick = usePlayClick()
  if (!visible) return null

  return (
    <View style={styles.container} pointerEvents="auto">
      <View style={styles.backdrop} />
      <View style={styles.content}>
        <Text style={styles.title}>Paused</Text>
        <TouchableOpacity
          style={styles.resumeButton}
          onPress={() => {
            playClick()
            onResume()
          }}
        >
          <Text style={styles.resumeText}>▶ Resume</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.settingsButton}
        onPress={() => {
          playClick()
          onOpenSettings()
        }}
      >
        <MaterialCommunityIcons name='cog-outline' size={28} color='#FFFFFF' />
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
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  content: {
    width: '75%',
    padding: 24,
    borderRadius: 14,
    backgroundColor: 'rgba(26,26,46,0.9)',
    alignItems: 'center',
    borderColor: '#FFA000',
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
  },
})
