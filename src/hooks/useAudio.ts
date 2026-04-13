import { useEffect, useRef, useCallback } from "react"
import { Audio } from "expo-av"
import { useAppStore } from "../state/appStore"

// Assets
const MUSIC_SOURCE = require("../../assets/audio/music/moodmode-level-vii-short-258782.wav")
const SFX_JUMP = require("../../assets/audio/sfx/jump.wav")
const SFX_STOMP = require("../../assets/audio/sfx/pickupCoin.wav")
const SFX_DEATH = require("../../assets/audio/sfx/death.wav")
const SFX_CLICK = require("../../assets/audio/sfx/click.wav")

// Pitch variation
const JUMP_RATE_MIN = 0.88
const JUMP_RATE_MAX = 1.15
const STOMP_RATE_MIN = 0.92
const STOMP_RATE_MAX = 1.1

function randomRate(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

type UseAudioReturn = {
  playJump: () => void
  playStomp: () => void
  playDeath: () => void
  playClick: () => void
  startMusic: () => void
  stopMusic: () => void
}

export function useAudio(): UseAudioReturn {
  // Sound instances (persist across renders)
  const music = useRef(new Audio.Sound()).current
  const jump = useRef(new Audio.Sound()).current
  const stomp = useRef(new Audio.Sound()).current
  const death = useRef(new Audio.Sound()).current
  const click = useRef(new Audio.Sound()).current

  const musicPlaying = useRef(false)
  const loaded = useRef(false)

  // Load / unload sounds once
  useEffect(() => {
    let mounted = true

    async function load() {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      })

      await Promise.all([
        music.loadAsync(MUSIC_SOURCE, { isLooping: true }),
        jump.loadAsync(SFX_JUMP),
        stomp.loadAsync(SFX_STOMP),
        death.loadAsync(SFX_DEATH),
        click.loadAsync(SFX_CLICK),
      ])

      if (!mounted) return

      const { musicVolume } = useAppStore.getState()
      await music.setVolumeAsync(musicVolume)

      loaded.current = true
    }

    load()

    return () => {
      mounted = false
      // Cleanup
      music.unloadAsync()
      jump.unloadAsync()
      stomp.unloadAsync()
      death.unloadAsync()
      click.unloadAsync()
    }
  }, [music, jump, stomp, death, click])

  // Sync music volume (Zustand subscription)
  useEffect(() => {
    const unsub = useAppStore.subscribe(async (state) => {
      if (!loaded.current) return
      await music.setVolumeAsync(state.musicVolume)
    })
    return unsub
  }, [music])

  // Music controls
  const startMusic = useCallback(async () => {
    if (!loaded.current || musicPlaying.current) return
    const { musicVolume } = useAppStore.getState()

    await music.setVolumeAsync(musicVolume)
    await music.playAsync()

    musicPlaying.current = true
  }, [music])

  const stopMusic = useCallback(async () => {
    if (!musicPlaying.current) return
    await music.pauseAsync()
    musicPlaying.current = false
  }, [music])

  // SFX helpers (no await → fire-and-forget)
  const playJump = useCallback(() => {
    const { sfxVolume } = useAppStore.getState()
    if (sfxVolume === 0 || !loaded.current) return

    jump.setVolumeAsync(sfxVolume)
    jump.setRateAsync(randomRate(JUMP_RATE_MIN, JUMP_RATE_MAX), false)
    jump.replayAsync()
  }, [jump])

  const playStomp = useCallback(() => {
    const { sfxVolume } = useAppStore.getState()
    if (sfxVolume === 0 || !loaded.current) return

    stomp.setVolumeAsync(sfxVolume)
    stomp.setRateAsync(randomRate(STOMP_RATE_MIN, STOMP_RATE_MAX), false)
    stomp.replayAsync()
  }, [stomp])

  const playDeath = useCallback(() => {
    const { sfxVolume } = useAppStore.getState()
    if (sfxVolume === 0 || !loaded.current) return

    death.setVolumeAsync(sfxVolume)
    death.setRateAsync(1.0, false)
    death.replayAsync()
  }, [death])

  const playClick = useCallback(() => {
    const { sfxVolume } = useAppStore.getState()
    if (sfxVolume === 0 || !loaded.current) return

    click.setVolumeAsync(sfxVolume)
    click.setRateAsync(1.0, false)
    click.replayAsync()
  }, [click])

  return { playJump, playStomp, playDeath, playClick, startMusic, stopMusic }
}
