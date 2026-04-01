import { useState, useEffect } from 'react'
import { StyleSheet, View, Text, TouchableOpacity, TextInput } from "react-native"
import { useAppStore } from "../../state/appStore"

// NameInputOverlay
// Renders the name input UI as a full-screen View overlay inside
// GameScreen. Can be used for first-time setup or changing name.
// Props:
//   initialName — the current name to pre-fill (optional)
//   onNameSubmit — called when the player enters a name and presses Submit.
//                  Receives the new name as parameter.
//   title — custom title (optional)
//   subtitle — custom subtitle (optional)
//   buttonText — custom button text (optional)
type Props = {
  initialName?: string
  onNameSubmit: (name: string) => void
  title?: string
  subtitle?: string
  buttonText?: string
}

export function NameInputOverlay({
  initialName = '',
  onNameSubmit,
  title = 'Welcome to Beer Jump!',
  subtitle = 'Enter your player name:',
  buttonText = 'Start Playing'
}: Props) {
  const [name, setName] = useState(initialName)

  useEffect(() => {
    setName(initialName)
  }, [initialName])

  const handleSubmit = () => {
    if (name.trim()) {
      onNameSubmit(name.trim())
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
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
        <Text style={styles.buttonText}>{buttonText}</Text>
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