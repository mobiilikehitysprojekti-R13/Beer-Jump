import { useState, useCallback, useEffect } from "react"
import { StyleSheet, View, AppState } from "react-native"
import { useAppStore } from "../state/appStore"
import { useGameLoop } from "../engine/useGameLoop"
import { useTiltInput } from "../hooks/useTiltInput"
import { useAudio } from "../hooks/useAudio"
import { GameCanvas } from "../components/game/GameCanvas"
import { HUD } from "../components/ui/HUD"
import { TouchZones } from "../components/ui/TouchZones"
import { HomeOverlay } from "../components/ui/HomeOverlay"
import { GameOverOverlay } from "../components/ui/GameOverOverlay"
import { NameInputOverlay } from "../components/ui/NameInputOverlay"
import { LeaderboardOverlay } from "../components/ui/LeaderboardOverlay"
import { SettingsOverlay } from "../components/ui/SettingsOverlay"
import { ShopOverlay } from "../components/ui/ShopOverlay"
import { InventoryOverlay } from "../components/ui/InventoryOverlay"
import { PauseOverlay } from "../components/ui/PauseOverlay"
import { ThemeBackdrop } from "../components/ui/ThemeBackdrop"
import { isPaused } from "../state/gameValues"
import { GamePhase } from "../state/types"
import { log } from "../utils/logger"
import { useActiveTheme } from "../hooks/useActiveTheme"
import { COINS_PER_SCORE_UNIT } from "../constants/gameConfig"

// ---------------------------------------------------------------------------
// Stable Zustand selectors — defined outside the component so their
// references never change across renders. Inline selectors create a new
// function on every render, causing useAppStore to re-subscribe and
// GameScreen to re-render on every store write, which was a contributing
// cause of BUG-9 (useFrameCallback re-registration).
// ---------------------------------------------------------------------------
const selectSetPersonalBest = (s: ReturnType<typeof useAppStore.getState>) =>
  s.setPersonalBest
const selectPersonalBest = (s: ReturnType<typeof useAppStore.getState>) =>
  s.personalBest
const selectSensitivity = (s: ReturnType<typeof useAppStore.getState>) =>
  s.gyroSensitivity
const selectHasSetName = (s: ReturnType<typeof useAppStore.getState>) =>
  s.hasSetName
const selectActiveSkin = (s: ReturnType<typeof useAppStore.getState>) =>
  s.activeSkin

// ---------------------------------------------------------------------------
// GameScreen
//
// The permanent root screen — mounts once at app start and NEVER unmounts.
// This is the architectural fix for BUG-9. All UI states are rendered as
// View overlays on top of the Skia canvas, not as separate navigator screens.
//
// Auth precondition: App.tsx awaits initAuth() before the navigator renders.
// By the time GameScreen mounts, Firebase auth is guaranteed settled.
// initAuth() must NOT be called here — it belongs in App.tsx only.
// See: firebase-auth-fix-plan.md §4 Fix 1 and architecture doc Rule 17.
//
// Rendering layers (bottom to top):
//   1. GameCanvas      — Skia canvas, always present
//   2. TouchZones      — transparent Pressable overlay, always present
//   3. HUD             — score + pause, visible during "playing"
//   4. HomeOverlay     — visible during "home"
//   5. GameOverOverlay — visible during "gameover"
//
// Phase transitions:
//   app start  → "home"
//   Play       → "playing" (calls restartRun())
//   die        → "gameover"
//   Play Again → "playing" (calls restartRun())
//   Home       → "home"    (does NOT call restartRun() — loop stays idle)
//
// restartRun() is called ONLY on explicit Play / Play Again — never on mount.
// ---------------------------------------------------------------------------
export default function GameScreen() {
  const setPersonalBest = useAppStore(selectSetPersonalBest)
  const personalBest = useAppStore(selectPersonalBest)
  const sensitivity = useAppStore(selectSensitivity)
  const hasSetName = useAppStore(selectHasSetName)
  const activeSkin = useAppStore(selectActiveSkin)
  const activeTheme = useActiveTheme()

  const [phase, setPhase] = useState<GamePhase>("home")
  const [finalScore, setFinalScore] = useState(0)

  // Overlay states
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [settingsOpenedFromPause, setSettingsOpenedFromPause] = useState(false)
  const [showShop, setShowShop] = useState(false)
  const [showInventory, setShowInventory] = useState(false)
  const [showPauseOverlay, setShowPauseOverlay] = useState(false)

  useTiltInput()

  const { playJump, playStomp, playDeath, playClick, startMusic, stopMusic } = useAudio()

  // onGameOver — called by the worklet via runOnJS on death.
  // Wrapped in useCallback: captured in the worklet closure via runOnJS.
  // Stable dep: setPersonalBest is a Zustand action (stable reference).
  const onGameOver = useCallback(
    async (score: number) => {
      stopMusic()
      playDeath()
      const earnedCoins = Math.max(1, Math.floor(score * COINS_PER_SCORE_UNIT))
      useAppStore.getState().addCoins(earnedCoins)
      await setPersonalBest(score)
      setFinalScore(score)
      setPhase("gameover")
      log.info("gameLoop", "onGameOver", { score })
    },
    [setPersonalBest, stopMusic, playDeath],
  )

  const {
    playerX,
    playerY,
    cameraY,
    platforms,
    enemies,
    score,
    globalTime,
    restartRun,
  } = useGameLoop(onGameOver, playJump, playStomp, sensitivity)

  // handlePlay — from HomeOverlay "Play" button.
  const handlePlay = useCallback(() => {
    playClick()
    isPaused.value = false
    setPhase("playing")
    restartRun()
    startMusic()
  }, [restartRun, playClick, startMusic])

  // handlePlayAgain — from GameOverOverlay "Play Again" button.
  const handlePlayAgain = useCallback(() => {
    playClick()
    isPaused.value = false
    setPhase("playing")
    restartRun()
    startMusic()
  }, [restartRun, playClick, startMusic])

  // handleHome — from GameOverOverlay "Home" button.
  // Does NOT call restartRun() — the loop stays idle.
  const handleHome = useCallback(() => {
    playClick()
    setPhase("home")
    stopMusic()
    isPaused.value = true
  }, [playClick, stopMusic])

  const handlePause = useCallback(() => {
    isPaused.value = true
    setShowPauseOverlay(true)
    log.info("gameLoop", "paused — HUD button")
  }, [])

  const handleResume = useCallback(() => {
    isPaused.value = false
    setShowPauseOverlay(false)
    log.info("gameLoop", "resumed — HUD button")
  }, [])

  const handleOpenSettings = useCallback(() => {
    setSettingsOpenedFromPause(true)
    setShowSettings(true)
    setShowPauseOverlay(false)
  }, [])

  const handleQuitToHomeFromPause = useCallback(() => {
    setShowPauseOverlay(false)
    setShowSettings(false)
    setSettingsOpenedFromPause(false)
    setPhase("home")
    isPaused.value = true
    log.info("gameLoop", "quit to home — pause overlay")
  }, [])

  const handleShowSettingsFromHome = useCallback(() => {
    setSettingsOpenedFromPause(false)
    setShowSettings(true)
  }, [])

  const handleCloseSettings = useCallback(() => {
    setShowSettings(false)

    if (settingsOpenedFromPause && phase === "playing") {
      isPaused.value = false
      log.info("gameLoop", "resumed — settings closed")
    }
    setSettingsOpenedFromPause(false)
  }, [phase, settingsOpenedFromPause])

  // AppState — pause on background, auto-resume only for background-caused pauses.
  useEffect(() => {
    let pausedByBackground = false

    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        if (!isPaused.value) {
          pausedByBackground = true
          isPaused.value = true
          log.info("gameLoop", "paused — app backgrounded")
        }
      } else {
        if (pausedByBackground) {
          pausedByBackground = false
          isPaused.value = false
          log.info("gameLoop", "resumed — app foregrounded")
        }
      }
    })

    return () => sub.remove()
  }, [])

  return (
    <View style={[styles.container, { backgroundColor: activeTheme.menuBackground }]}>
      <ThemeBackdrop scene={activeTheme.scene} />

      {/* Layer 1 — Skia game canvas (always present) */}
      <GameCanvas
        playerX={playerX}
        playerY={playerY}
        cameraY={cameraY}
        platforms={platforms}
        enemies={enemies}
        globalTime={globalTime}
        backgroundColor={activeTheme.gameBackground}
        backgroundScene={activeTheme.scene}
        characterTextureName={activeSkin}
      />

      {/* Layer 2 — Touch input zones (always present, zero visual footprint) */}
      <TouchZones />

      {/* Layer 3 — HUD: score + pause button */}
      {phase === "playing" && (
        <HUD
          score={score}
          isPaused={isPaused}
          onPause={handlePause}
          onResume={handleResume}
        />
      )}

      {/* Pause overlay, transparent over game where relevant */}
      <PauseOverlay
        visible={showPauseOverlay}
        onResume={handleResume}
        onOpenSettings={handleOpenSettings}
        onQuit={handleQuitToHomeFromPause}
      />

      {/* Layer 4 — Name input overlay (first start only) */}
      {phase === "home" && !hasSetName && (
        <NameInputOverlay
          onNameSubmit={(name) => {
            useAppStore.getState().setPlayerName(name)
            useAppStore.getState().setHasSetName(true)
          }}
        />
      )}

      {/* Layer 5 — Home overlay */}
      {phase === "home" && hasSetName && (
        <HomeOverlay
          onPlay={handlePlay}
          onShowLeaderboard={() => setShowLeaderboard(true)}
          onShowSettings={handleShowSettingsFromHome}
          onShowShop={() => setShowShop(true)}
          onShowInventory={() => setShowInventory(true)}
        />
      )}

      {/* Layer 6 — Game over overlay */}
      {phase === "gameover" && (
        <GameOverOverlay
          score={finalScore}
          personalBest={personalBest}
          onPlayAgain={handlePlayAgain}
          onHome={handleHome}
        />
      )}

      {/* Layer 7 — Fullscreen overlays */}
      {showLeaderboard && (
        <LeaderboardOverlay
          visible={true}
          onClose={() => setShowLeaderboard(false)}
        />
      )}
      {showSettings && (
        <SettingsOverlay visible={true} onClose={handleCloseSettings} />
      )}
      {showShop && (
        <ShopOverlay visible={true} onClose={() => setShowShop(false)} />
      )}
      {showInventory && (
        <InventoryOverlay
          visible={true}
          onClose={() => setShowInventory(false)}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a2e",
  },
})