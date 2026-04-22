import { useState } from "react"
import { StyleSheet, TouchableOpacity, Text, View } from "react-native"
import {
  useAnimatedReaction,
  runOnJS,
  SharedValue,
} from "react-native-reanimated"
import { useActiveTheme } from "../../hooks/useActiveTheme"
import { ActivePowerUpState } from "../../state/types"
import {
  FOAM_HAT_DURATION_MS,
  JETPACK_DURATION_MS,
  ROCKET_DURATION_MS,
  COLOR_POWER_UP_FOAM_HAT,
  COLOR_POWER_UP_JETPACK,
  COLOR_POWER_UP_ROCKET,
  COLOR_POWER_UP_PRETZEL,
} from "../../constants/gameConfig"

// ---------------------------------------------------------------------------
// Power-up display helpers
// ---------------------------------------------------------------------------
const POWER_UP_LABELS: Record<string, string> = {
  foamHat: "FOAM HAT",
  jetpack: "JETPACK",
  bottleRocket: "ROCKET",
  pretzelBoots: "BOOTS",
}

const POWER_UP_COLORS: Record<string, string> = {
  foamHat: COLOR_POWER_UP_FOAM_HAT,
  jetpack: COLOR_POWER_UP_JETPACK,
  bottleRocket: COLOR_POWER_UP_ROCKET,
  pretzelBoots: COLOR_POWER_UP_PRETZEL,
}

// Max duration per type for the timer bar fill ratio.
const POWER_UP_MAX_DURATION: Record<string, number> = {
  foamHat: FOAM_HAT_DURATION_MS,
  jetpack: JETPACK_DURATION_MS,
  bottleRocket: ROCKET_DURATION_MS,
}

// ---------------------------------------------------------------------------
// HUD
//
// Score + pause button during gameplay.
//
// Power-up indicator:
//   When a timed power-up is active (activePowerUpState.type !== "none"),
//   a badge appears below the score showing:
//     - Power-up name
//     - A shrinking timer bar (width = remaining / max * 100%)
//     - The accent color matching the power-up type
//
//   useAnimatedReaction watches activePowerUpState on the UI thread and
//   bridges the entire state object to React via runOnJS — one re-render
//   per timer update (capped by dt ≈ 16ms, so ~60 re-renders/s while active).
//   This is acceptable for a small badge; the canvas is unaffected.
//
//   pretzelBoots have no timed state so they never show in the HUD —
//   their effect is instant (single boosted bounce).
// ---------------------------------------------------------------------------
type Props = {
  score: SharedValue<number>
  isPaused: SharedValue<boolean>
  activePowerUpState: SharedValue<ActivePowerUpState>
  onPause: () => void
  onResume: () => void
}

export function HUD({ score, isPaused, activePowerUpState, onPause, onResume }: Props) {
  const [displayScore, setDisplayScore] = useState(0)
  const [displayPaused, setDisplayPaused] = useState(false)
  const [displayPowerUp, setDisplayPowerUp] = useState<ActivePowerUpState>({ type: "none", timerMs: 0, invincible: false })
  const activeTheme = useActiveTheme()

  useAnimatedReaction(
    () => score.value,
    (current, previous) => {
      if (current !== previous) {
        runOnJS(setDisplayScore)(current)
      }
    },
  )

  useAnimatedReaction(
    () => isPaused.value,
    (current, previous) => {
      if (current !== previous) {
        runOnJS(setDisplayPaused)(current)
      }
    },
  )

  // Bridge power-up state to React. We compare type + a rounded timer bucket
  // (every 50ms) to avoid a re-render on every single frame.
  useAnimatedReaction(
    () => {
      const s = activePowerUpState.value
      return {
        type: s.type,
        // Round to nearest 50ms bucket to reduce render frequency
        timerBucket: Math.ceil(s.timerMs / 50),
        timerMs: s.timerMs,
        invincible: s.invincible,
      }
    },
    (current, previous) => {
      if (
        current.type !== previous?.type ||
        current.timerBucket !== previous?.timerBucket
      ) {
        runOnJS(setDisplayPowerUp)({
          type: current.type,
          timerMs: current.timerMs,
          invincible: current.invincible,
        })
      }
    },
  )

  const isPowerUpActive =
    displayPowerUp.type !== "none" && displayPowerUp.type !== "pretzelBoots"
  const maxDuration = isPowerUpActive
    ? (POWER_UP_MAX_DURATION[displayPowerUp.type] ?? 1)
    : 1
  const timerFraction = isPowerUpActive
    ? Math.max(0, Math.min(1, displayPowerUp.timerMs / maxDuration))
    : 0
  const powerUpColor = isPowerUpActive
    ? (POWER_UP_COLORS[displayPowerUp.type] ?? "#FFA000")
    : "#FFA000"
  const powerUpLabel = isPowerUpActive
    ? (POWER_UP_LABELS[displayPowerUp.type] ??
      displayPowerUp.type.toUpperCase())
    : ""

  return (
    <View style={styles.container} pointerEvents='box-none'>
      {/* Top bar — always visible */}
      <View style={styles.topBar}>
        <View>
          <Text style={[styles.scoreText, { color: activeTheme.textColor, fontFamily: activeTheme.fontFamily }]}>Score: {displayScore}</Text>

          {/* Power-up indicator badge — shown only when a timed power-up is active */}
          {isPowerUpActive && (
            <View style={[styles.powerUpBadge, { borderColor: powerUpColor }]}>
              <Text style={[styles.powerUpLabel, { color: powerUpColor }]}>
                {powerUpLabel}
                {displayPowerUp.invincible ? " ★" : ""}
              </Text>
              {/* Timer bar */}
              <View style={styles.timerBarTrack}>
                <View
                  style={[
                    styles.timerBarFill,
                    {
                      width: `${Math.round(timerFraction * 100)}%` as any,
                      backgroundColor: powerUpColor,
                    },
                  ]}
                />
              </View>
            </View>
          )}
        </View>

        {!displayPaused && (
          <TouchableOpacity
            onPress={onPause}
            style={[styles.pauseButton, { borderColor: activeTheme.textColor }]}
          >
            <View style={styles.pauseGlyph}>
              <View style={[styles.pauseBar, { backgroundColor: activeTheme.textColor }]} />
              <View style={[styles.pauseBar, { backgroundColor: activeTheme.textColor }]} />
            </View>
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-start",
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 8,
  },
  scoreText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "bold",
  },
  // Power-up indicator
  powerUpBadge: {
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1.5,
    backgroundColor: "rgba(0,0,0,0.35)",
    minWidth: 110,
  },
  powerUpLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  timerBarTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.15)",
    overflow: "hidden",
  },
  timerBarFill: {
    height: 4,
    borderRadius: 2,
  },
  // Pause button
  pauseButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  pauseGlyph: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  pauseBar: {
    width: 5,
    height: 18,
    borderRadius: 2,
  },

  // Pause overlay — sits above everything, semi-transparent dark fill
  pauseOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    alignItems: "center",
    justifyContent: "center",
    gap: 32,
  },
  pauseTitle: {
    color: "#FFFFFF",
    fontSize: 42,
    fontWeight: "bold",
    letterSpacing: 2,
  },
  resumeButton: {
    backgroundColor: "#FFA000",
    paddingHorizontal: 48,
    paddingVertical: 16,
    borderRadius: 8,
  },
  resumeText: {
    color: "#1a1a2e",
    fontSize: 22,
    fontWeight: "bold",
  },
})
