import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { Platform } from "react-native"
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
  setPersonalBest: (score: number) => Promise<void>

  // Settings (persisted to AsyncStorage)
  soundEnabled: boolean
  touchControlsEnabled: boolean // default: true
  gyroEnabled: boolean // default: true
  gyroSensitivity: number // default: GYRO_SENSITIVITY (18)
  toggleSound: () => void
  toggleTouchControls: () => void
  toggleGyroEnabled: () => void
  setSensitivity: (val: number) => void

  // Auth stubs
  authUID: string | null
  googleUID: string | null
  playerName: string
  hasSetName: boolean
  setAuthUID: (uid: string) => void
  setPlayerName: (name: string) => void
  setHasSetName: (hasSet: boolean) => void
  loadBestScoreFromFirestore: () => Promise<void>

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
      setPersonalBest: async (score) => {
        console.log("appStore", "setPersonalBest called", { score })
        set((s) => {
          if (score > s.personalBest) {
            console.log("appStore", "new personal best", { old: s.personalBest, new: score })
            // Submit to Firestore in the background
            import("../services/firebase/leaderboard").then(({ submitScore }) => {
              submitScore(score, {
                level: s.playerLevel,
                xp: s.xp,
                coins: s.coins,
                platform: Platform.OS as 'ios' | 'android',
              }).catch((error) => {
                console.warn("Failed to submit score to Firestore:", error)
              })
            })
            return { personalBest: score }
          }
          console.log("appStore", "score not higher than personalBest", { currentBest: s.personalBest })
          return {}
        })
      },

      // Settings
      soundEnabled: true,
      touchControlsEnabled: true,
      gyroEnabled: true,
      gyroSensitivity: 1, // initial value set to 1 on first app start as requested

      toggleSound: () => {
        console.log("appStore", "toggleSound")
        return set((s) => ({ soundEnabled: !s.soundEnabled }))
      },

      toggleTouchControls: () =>
        set((s) => {
          const next = !s.touchControlsEnabled
          console.log("appStore", "toggleTouchControls", { next })
          touchControlsEnabled.value = next // sync to shared value so worklet reads it immediately
          return { touchControlsEnabled: next }
        }),

      toggleGyroEnabled: () => {
        return set((s) => {
          const next = !s.gyroEnabled
          console.log("appStore", "toggleGyroEnabled", { next })
          return { gyroEnabled: next }
        })
      },

      setSensitivity: (val) => {
        console.log("appStore", "setSensitivity", { val })
        return set({ gyroSensitivity: val })
      },

      // Auth stubs
      authUID: null,
      googleUID: null,
      playerName: "Player",
      hasSetName: false,
      setAuthUID: (uid) => set({ authUID: uid }),
      setPlayerName: (name) => set({ playerName: name }),
      setHasSetName: (hasSet) => set({ hasSetName: hasSet }),
      loadBestScoreFromFirestore: async () => {
        console.log("appStore", "loadBestScoreFromFirestore called")
        try {
          // Dynamic import to avoid circular dependency
          const { getPlayerBestScore } = await import("../services/firebase/leaderboard")
          const firestoreBest = await getPlayerBestScore()
          console.log("appStore", "loaded best score from Firestore", { firestoreBest })
          if (firestoreBest > 0) {
            set({ personalBest: firestoreBest })
          }
        } catch (error) {
          console.warn("Failed to load best score from Firestore:", error)
        }
      },

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
        gyroEnabled: s.gyroEnabled,
        gyroSensitivity: s.gyroSensitivity,
        hasSetName: s.hasSetName,
        playerName: s.playerName,
      }),
    },
  ),
)
