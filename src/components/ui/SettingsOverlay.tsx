import { useState } from "react"
import { View, Text, StyleSheet, TouchableOpacity, Switch } from "react-native"
import { MaterialCommunityIcons } from "@expo/vector-icons"
import { useAppStore } from "../../state/appStore"
import { NameInputOverlay } from "./NameInputOverlay"

type Props = {
  visible: boolean
  onClose: () => void
}

const selectPlayerName = (s: ReturnType<typeof useAppStore.getState>) => s.playerName
const selectTouchControlsEnabled = (s: ReturnType<typeof useAppStore.getState>) => s.touchControlsEnabled
const selectGyroEnabled = (s: ReturnType<typeof useAppStore.getState>) => s.gyroEnabled
const selectGyroSensitivity = (s: ReturnType<typeof useAppStore.getState>) => s.gyroSensitivity
const selectToggleTouchControls = ( s: ReturnType<typeof useAppStore.getState>) => s.toggleTouchControls
const selectMusicVolume = (s: ReturnType<typeof useAppStore.getState>) => s.musicVolume
const selectSfxVolume = (s: ReturnType<typeof useAppStore.getState>) => s.sfxVolume
const selectToggleGyroEnabled = (s: ReturnType<typeof useAppStore.getState>) => s.toggleGyroEnabled
const selectSetSensitivity = (s: ReturnType<typeof useAppStore.getState>) => s.setSensitivity
const selectSetMusicVolume = (s: ReturnType<typeof useAppStore.getState>) => s.setMusicVolume
const selectSetSfxVolume = (s: ReturnType<typeof useAppStore.getState>) => s.setSfxVolume
const selectSetPlayerName = (s: ReturnType<typeof useAppStore.getState>) => s.setPlayerName

export function SettingsOverlay({ visible, onClose }: Props) {
  const playerName = useAppStore(selectPlayerName)
  const touchControlsEnabled = useAppStore(selectTouchControlsEnabled)
  const gyroEnabled = useAppStore(selectGyroEnabled)
  const gyroSensitivity = useAppStore(selectGyroSensitivity)
  const musicVolume = useAppStore(selectMusicVolume)
  const sfxVolume = useAppStore(selectSfxVolume)
  const toggleTouchControls = useAppStore(selectToggleTouchControls)
  const toggleGyroEnabled = useAppStore(selectToggleGyroEnabled)
  const setSensitivity = useAppStore(selectSetSensitivity)
  const setMusicVolume = useAppStore(selectSetMusicVolume)
  const setSfxVolume = useAppStore(selectSetSfxVolume)
  const setPlayerName = useAppStore(selectSetPlayerName)

  const [showNameInput, setShowNameInput] = useState(false)

  if (!visible) return null

  const handleNameChange = (newName: string) => {
    setPlayerName(newName)
    setShowNameInput(false)
  }

  const adjustSensitivity = (delta: number) => {
    const newValue = Math.max(0, Math.min(50, gyroSensitivity + delta))
    setSensitivity(newValue)
  }

  // Volume steps in increments of 0.1, clamped 0.0–1.0
  const adjustMusicVolume = (delta: number) => {
    const newValue = Math.round((musicVolume + delta) * 10) / 10
    setMusicVolume(Math.max(0, Math.min(1, newValue)))
  }

  const adjustSfxVolume = (delta: number) => {
    const newValue = Math.round((sfxVolume + delta) * 10) / 10
    setSfxVolume(Math.max(0, Math.min(1, newValue)))
  }

  const volumeLabel = (val: number) => Math.round(val * 10).toString()

  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <MaterialCommunityIcons name="cog-outline" size={42} color="#FFA000" />
        <Text style={styles.title}>Settings</Text>
      </View>

      {/* Change Name */}
      <TouchableOpacity
        style={styles.button}
        onPress={() => setShowNameInput(true)}
      >
        <Text style={styles.buttonText}>Change Name</Text>
        <Text style={styles.subText}>{playerName}</Text>
      </TouchableOpacity>

      {/* Music Volume */}
      <View style={styles.settingRow}>
        <Text style={styles.settingText}>
          Music Volume: {volumeLabel(musicVolume)}
        </Text>
        <View style={styles.sensitivityControls}>
          <TouchableOpacity
            style={styles.smallButton}
            onPress={() => adjustMusicVolume(-0.1)}
          >
            <Text style={styles.smallButtonText}>-</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.smallButton}
            onPress={() => adjustMusicVolume(0.1)}
          >
            <Text style={styles.smallButtonText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* SFX Volume */}
      <View style={styles.settingRow}>
        <Text style={styles.settingText}>
          SFX Volume: {volumeLabel(sfxVolume)}
        </Text>
        <View style={styles.sensitivityControls}>
          <TouchableOpacity
            style={styles.smallButton}
            onPress={() => adjustSfxVolume(-0.1)}
          >
            <Text style={styles.smallButtonText}>-</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.smallButton}
            onPress={() => adjustSfxVolume(0.1)}
          >
            <Text style={styles.smallButtonText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Touch Controls Toggle */}
      <View style={styles.settingRow}>
        <Text style={styles.settingText}>Touch Controls</Text>
        <Switch
          value={touchControlsEnabled}
          onValueChange={toggleTouchControls}
          trackColor={{ false: "#767577", true: "#FFA000" }}
          thumbColor={touchControlsEnabled ? "#1a1a2e" : "#f4f3f4"}
        />
      </View>

      {/* Gyro Enabled Toggle */}
      <View style={styles.settingRow}>
        <Text style={styles.settingText}>Gyro Tilting</Text>
        <Switch
          value={gyroEnabled}
          onValueChange={toggleGyroEnabled}
          trackColor={{ false: "#767577", true: "#FFA000" }}
          thumbColor={gyroEnabled ? "#1a1a2e" : "#f4f3f4"}
        />
      </View>

      {/* Gyro Sensitivity */}
      <View style={styles.settingRow}>
        <Text style={styles.settingText}>Gyro Sensitivity: {gyroSensitivity}</Text>
        <View style={styles.sensitivityControls}>
          <TouchableOpacity style={styles.smallButton} onPress={() => adjustSensitivity(-1)}>
            <Text style={styles.smallButtonText}>-</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.smallButton} onPress={() => adjustSensitivity(1)}>
            <Text style={styles.smallButtonText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity style={styles.closeButton} onPress={onClose}>
        <Text style={styles.closeText}>Close</Text>
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
    fontSize: 48,
    fontWeight: "bold",
    color: "#FFA000",
    textAlign: "center",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  button: {
    backgroundColor: "#FFA000",
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    width: "80%",
    maxWidth: 300,
    alignItems: "center",
  },
  buttonText: {
    color: "#1a1a2e",
    fontSize: 20,
    fontWeight: "bold",
  },
  subText: {
    color: "#1a1a2e",
    fontSize: 16,
    marginTop: 4,
  },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "80%",
    maxWidth: 300,
    paddingVertical: 8,
  },
  settingText: {
    color: "#FFFFFF",
    fontSize: 18,
  },
  sensitivityControls: {
    flexDirection: "row",
    gap: 8,
  },
  smallButton: {
    backgroundColor: "#FFA000",
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  smallButtonText: {
    color: "#1a1a2e",
    fontSize: 20,
    fontWeight: "bold",
  },
  closeButton: {
    marginTop: 12,
    backgroundColor: "transparent",
    borderWidth: 2,
    borderColor: "#FFA000",
    paddingVertical: 10,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  closeText: {
    color: "#FFA000",
    fontWeight: "bold",
    fontSize: 18,
  },
})
