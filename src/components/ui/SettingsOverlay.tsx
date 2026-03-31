import { View, Text, StyleSheet, TouchableOpacity } from "react-native"

type Props = {
  visible: boolean
  onClose: () => void
}

export function SettingsOverlay({ visible, onClose }: Props) {
  if (!visible) return null

  return (
    <View style={styles.overlay}>
      <View style={styles.container}>
        <Text style={styles.title}>⚙️ Settings</Text>

        {/* Lisää haluamasi asetukset napit tähän */}
        <TouchableOpacity style={styles.button} onPress={() => { /* esim. ääni päälle/pois */ }}>
          <Text style={styles.buttonText}>Sound</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={() => { /* esim. värimaailma */ }}>
          <Text style={styles.buttonText}>Theme</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeText}>Close</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '80%',
    backgroundColor: '#222',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFD700',
    textAlign: 'center',
    marginBottom: 12,
  },
  button: {
    backgroundColor: '#FFA000',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    color: '#1a1a2e',
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    marginTop: 12,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#FFA000',
    paddingVertical: 10,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  closeText: {
    color: '#FFA000',
    fontWeight: 'bold',
    fontSize: 18,
  },
})