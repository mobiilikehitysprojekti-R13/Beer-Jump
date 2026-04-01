import { useState } from 'react'
import { StyleSheet, View, Text, TouchableOpacity, TextInput } from "react-native"
import { useAppStore } from "../../state/appStore"

// NameInputOverlay
// Renders the name input UI as a full-screen View overlay inside
// GameScreen. Shown on first start when hasSetName is false.
// Props:
//   onNameSubmit — called when the player enters a name and presses Submit.
//                  Sets playerName and hasSetName in store.
type Props = {
  onNameSubmit: () => void
}

export function NameInputOverlay({ onNameSubmit }: Props) {
  const [name, setName] = useState('')
  const setPlayerName = useAppStore((s) => s.setPlayerName)
  const setHasSetName = useAppStore((s) => s.setHasSetName)

  const handleSubmit = () => {
    if (name.trim()) {
      setPlayerName(name.trim())
      setHasSetName(true)
      onNameSubmit()
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to Beer Jump!</Text>
      <Text style={styles.subtitle}>Enter your player name:</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="Player Name"
        placeholderTextColor="#FFFFFF80"
        maxLength={20}
        autoFocus
      />
      <TouchableOpacity
        style={[styles.button, !name.trim() && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={!name.trim()}
      >
        <Text style={styles.buttonText}>Start Playing</Text>
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
  title: {
    color: "#FFA000",
    fontSize: 48,
    fontWeight: "bold",
    textAlign: "center",
  },
  subtitle: {
    color: "#FFFFFF",
    fontSize: 20,
    textAlign: "center",
  },
  input: {
    backgroundColor: "#FFFFFF20",
    color: "#FFFFFF",
    fontSize: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    width: 250,
    textAlign: "center",
  },
  button: {
    backgroundColor: "#FFA000",
    paddingHorizontal: 48,
    paddingVertical: 16,
    borderRadius: 8,
  },
  buttonDisabled: {
    backgroundColor: "#FFA00080",
  },
  buttonText: {
    color: "#1a1a2e",
    fontSize: 24,
    fontWeight: "bold",
  },
})