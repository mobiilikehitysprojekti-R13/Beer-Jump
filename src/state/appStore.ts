import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { Platform } from "react-native"
import { GamePhase } from "./types"
import { touchControlsEnabled } from "./gameValues"
import { GYRO_SENSITIVITY } from "../constants/gameConfig"

const syncCoinsToFirestore = (coins: number) => {
  import("../services/firebase/leaderboard")
    .then(({ updatePlayerCoins }) => updatePlayerCoins(coins))
    .catch((error) => {
      console.warn("Failed to sync coins to Firestore:", error)
    })
}

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
  setCoins: (amount: number) => void
  addCoins: (amount: number) => void
  spendCoins: (amount: number) => boolean
  xp: number
  playerLevel: number
  ownedSkins: string[]
  ownedThemes: string[]
  activeSkin: string
  activeTheme: string
  addOwnedSkin: (skinTextureName: string) => void
  setActiveSkin: (skinTextureName: string) => void
  addOwnedTheme: (themeTextureName: string) => void
  setActiveTheme: (themeTextureName: string) => void
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
          const { getPlayerProgress } = await import("../services/firebase/leaderboard")
          const progress = await getPlayerProgress()
          console.log("appStore", "loaded progress from Firestore", progress)
          if (progress.bestScore > 0) {
            set({ personalBest: progress.bestScore })
          }
          set({ coins: Math.max(0, Math.floor(progress.coins || 0)) })
        } catch (error) {
          console.warn("Failed to load best score from Firestore:", error)
        }
      },

      // Progression stubs
      coins: 0,
      setCoins: (amount) =>
        set(() => {
          const nextCoins = Math.max(0, Math.floor(amount))
          syncCoinsToFirestore(nextCoins)
          return { coins: nextCoins }
        }),
      addCoins: (amount) =>
        set((s) => {
          const nextCoins = Math.max(0, s.coins + Math.max(0, Math.floor(amount)))
          syncCoinsToFirestore(nextCoins)
          return { coins: nextCoins }
        }),
      spendCoins: (amount) => {
        let spent = false
        set((s) => {
          const cost = Math.max(0, Math.floor(amount))
          if (s.coins < cost) {
            return {}
          }

          spent = true
          const nextCoins = s.coins - cost
          syncCoinsToFirestore(nextCoins)
          return { coins: nextCoins }
        })
        return spent
      },
      xp: 0,
      playerLevel: 1,
      ownedSkins: ["default_character"],
      ownedThemes: ["default_theme"],
      activeSkin: "default_character",
      activeTheme: "default_theme",
      addOwnedSkin: (skinTextureName) =>
        set((s) => {
          if (s.ownedSkins.includes(skinTextureName)) {
            return {}
          }

          return { ownedSkins: [...s.ownedSkins, skinTextureName] }
        }),
      setActiveSkin: (skinTextureName) => set({ activeSkin: skinTextureName }),
      addOwnedTheme: (themeTextureName) =>
        set((s) => {
          if (s.ownedThemes.includes(themeTextureName)) {
            return {}
          }

          return { ownedThemes: [...s.ownedThemes, themeTextureName] }
        }),
      setActiveTheme: (themeTextureName) => set({ activeTheme: themeTextureName }),
    }),
    {
      name: "beer-jump-app-state",
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        if (state) {
          touchControlsEnabled.value = state.touchControlsEnabled
        }
      },
      // Only persist values that should survive app restarts.
      // gamePhase, auth, and progression stubs are excluded —
      // they are either transient (gamePhase) or not yet wired (auth/progression).
      partialize: (s) => ({
        personalBest: s.personalBest,
        soundEnabled: s.soundEnabled,
        touchControlsEnabled: s.touchControlsEnabled,
        gyroEnabled: s.gyroEnabled,
        gyroSensitivity: s.gyroSensitivity,
        coins: s.coins,
        hasSetName: s.hasSetName,
        playerName: s.playerName,
        ownedSkins: s.ownedSkins,
        activeSkin: s.activeSkin,
        ownedThemes: s.ownedThemes,
        activeTheme: s.activeTheme,
      }),
    },
  ),
)
