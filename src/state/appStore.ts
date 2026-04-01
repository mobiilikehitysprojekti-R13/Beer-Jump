import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { GamePhase } from "./types"
import { touchControlsEnabled } from "./gameValues"
import { GYRO_SENSITIVITY } from "../constants/gameConfig"

// Store type
type AppStore = {
  // Game phase
  gamePhase: GamePhase
  setGamePhase: (phase: GamePhase) => void

  // Scores
  personalBest: number
  setPersonalBest: (score: number) => void

  // Settings (persisted to AsyncStorage)
  soundEnabled: boolean
  touchControlsEnabled: boolean // default: true
  gyroSensitivity: number // default: GYRO_SENSITIVITY (18)
  toggleSound: () => void
  toggleTouchControls: () => void
  setSensitivity: (val: number) => void

  // Auth stubs
  authUID: string | null
  googleUID: string | null
  playerName: string
  hasSetName: boolean
  setAuthUID: (uid: string) => void
  setPlayerName: (name: string) => void
  setHasSetName: (hasSet: boolean) => void

  // Progression stubs
  coins: number
  xp: number
  playerLevel: number
  ownedSkins: string[]
  ownedThemes: string[]
  activeSkin: string
  activeTheme: string
}

// Store
export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      // Game phase
      gamePhase: "home",
      setGamePhase: (phase) => set({ gamePhase: phase }),

      // Scores
      personalBest: 0,
      setPersonalBest: (score) =>
        set((s) => (score > s.personalBest ? { personalBest: score } : {})),

      // Settings
      soundEnabled: true,
      touchControlsEnabled: true,
      gyroSensitivity: GYRO_SENSITIVITY,

      toggleSound: () => set((s) => ({ soundEnabled: !s.soundEnabled })),

      toggleTouchControls: () =>
        set((s) => {
          const next = !s.touchControlsEnabled
          touchControlsEnabled.value = next // sync to shared value so worklet reads it immediately
          return { touchControlsEnabled: next }
        }),

      setSensitivity: (val) => set({ gyroSensitivity: val }),

      // Auth stubs
      authUID: null,
      googleUID: null,
      playerName: "Player",
      hasSetName: false,
      setAuthUID: (uid) => set({ authUID: uid }),
      setPlayerName: (name) => set({ playerName: name }),
      setHasSetName: (hasSet) => set({ hasSetName: hasSet }),

      // Progression stubs
      coins: 0,
      xp: 0,
      playerLevel: 1,
      ownedSkins: [],
      ownedThemes: [],
      activeSkin: "default",
      activeTheme: "default",
    }),
    {
      name: "beer-jump-app-state",
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist values that should survive app restarts.
      // gamePhase, auth, and progression stubs are excluded —
      // they are either transient (gamePhase) or not yet wired (auth/progression).
      partialize: (s) => ({
        personalBest: s.personalBest,
        soundEnabled: s.soundEnabled,
        touchControlsEnabled: s.touchControlsEnabled,
        gyroSensitivity: s.gyroSensitivity,
        hasSetName: s.hasSetName,
        playerName: s.playerName,
      }),
    },
  ),
)
