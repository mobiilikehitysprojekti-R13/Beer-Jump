import { useCallback, useRef, useEffect } from "react"
import { Audio } from "expo-av"
import { useAppStore } from "../state/appStore"

// ---------------------------------------------------------------------------
// usePlayClick
//
// Lightweight hook that gives any component a stable playClick() function
// without prop drilling through GameScreen.
//
// Each call site gets its own Audio.Sound instance so simultaneous clicks
// don't collide. 
// The instance is loaded once on mount and unloaded on unmount.
// 
// Rate is fixed at 1.0 click sounds play at normal pitch every time.
// Volume is read from the store at call time so it respects the SFX slider.
// ---------------------------------------------------------------------------
const SFX_CLICK = require("../../assets/audio/sfx/click.wav")

export function usePlayClick(): () => void {
  const sound = useRef(new Audio.Sound()).current
  const loaded = useRef(false)

  useEffect(() => {
    let mounted = true

    Audio.setAudioModeAsync({ playsInSilentModeIOS: true })
      .then(() => sound.loadAsync(SFX_CLICK))
      .then(() => {
        if (mounted) loaded.current = true
      })

    return () => {
      mounted = false
      sound.unloadAsync()
    }
  }, [sound])

  return useCallback(() => {
    const { sfxVolume } = useAppStore.getState()
    if (!loaded.current || sfxVolume === 0) return
    sound.setVolumeAsync(sfxVolume)
    sound.setRateAsync(1.0, false)
    sound.replayAsync()
  }, [sound])
}
