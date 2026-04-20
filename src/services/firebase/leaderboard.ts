import { Timestamp, collection, getDocs, query, orderBy, limit, doc, getDoc } from 'firebase/firestore'
import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { getUser } from './auth'
import { getDocument, setDocument, updateDocument } from './firestore'
import { db } from './config'
import { log } from '../../utils/logger'

// -------------------------
// Types
// -------------------------
export type LeaderboardEntry = {
  id: string
  playerName: string
  score: number
  level: number
  xp: number
  coins: number
  platform: 'ios' | 'android'
  timestamp: any
}

const COLLECTION = 'leaderboard'
const GUEST_COLLECTION = 'guestProgress'
const GUEST_ID_KEY = 'beer-jump-guest-id'

const getGuestId = async (): Promise<string> => {
  const existing = await AsyncStorage.getItem(GUEST_ID_KEY)
  if (existing) {
    return existing
  }

  const generated = `guest_${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`
  await AsyncStorage.setItem(GUEST_ID_KEY, generated)
  return generated
}

// -------------------------
// Submit a score
// -------------------------
export const submitScore = async (
  score: number,
  extra: { level: number; xp: number; coins: number; platform: 'ios' | 'android' }
) => {
  const user = getUser()
  if (!user) {
    log.error("firebase", "submitScore: getUser() returned null — auth bootstrap may not have completed", { score })
    return
  }

  log.info("firebase", "submitScore called", { uid: user.uid, score })

  try {
    const existing = await getDocument(COLLECTION, user.uid)
    // Get playerName from store
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useAppStore } = require("../../state/appStore")
    const playerName = useAppStore.getState().playerName
    const data = {
      playerName,
      score,
      timestamp: Timestamp.now(),
      ...extra,
    }

    if (!existing) {
      log.info("firebase", "creating new leaderboard entry", { uid: user.uid, score })
      return await setDocument(COLLECTION, user.uid, data)
    }

    if (score > existing.score) {
      log.info("firebase", "new high score", { oldScore: existing.score, newScore: score })
      return await updateDocument(COLLECTION, user.uid, data)
    }

    log.info("firebase", "score not higher, skipping update", { score, best: existing.score })
  } catch (err) {
    // Network error or offline - log but don't crash
    log.warn("firebase", "submitScore: network error or offline", { error: String(err) })
  }
}

// -------------------------
// Get the current player's best score
// -------------------------
export const getPlayerBestScore = async (): Promise<number> => {
  const user = getUser()
  if (!user) {
    log.warn("firebase", "getPlayerBestScore: no signed-in user")
    return 0
  }

  log.info("firebase", "getPlayerBestScore: start", { uid: user.uid })

  try {
    const docRef = doc(db, COLLECTION, user.uid)
    const docSnap = await getDoc(docRef)

    if (docSnap.exists()) {
      const data = docSnap.data() as LeaderboardEntry
      log.info("firebase", "getPlayerBestScore: user has score", { score: data.score })
      return data.score || 0
    }

    log.info("firebase", "getPlayerBestScore: no score document for user", { uid: user.uid })
  } catch (error) {
    // Network error or offline - log but don't crash
    log.warn("firebase", "getPlayerBestScore: network error or offline", { error: String(error) })
  }

  return 0
}

export const getPlayerProgress = async (): Promise<{ bestScore: number; coins: number }> => {
  const user = getUser()
  if (!user) {
    try {
      const guestId = await getGuestId()
      const guestProgress = await getDocument(GUEST_COLLECTION, guestId)
      if (guestProgress) {
        return {
          bestScore: guestProgress.bestScore || 0,
          coins: guestProgress.coins || 0,
        }
      }
    } catch (error) {
      log.warn("firebase", "getPlayerProgress: failed to load guest progress", { error: String(error) })
    }

    return { bestScore: 0, coins: 0 }
  }

  try {
    const docRef = doc(db, COLLECTION, user.uid)
    const docSnap = await getDoc(docRef)

    if (docSnap.exists()) {
      const data = docSnap.data() as LeaderboardEntry
      return {
        bestScore: data.score || 0,
        coins: data.coins || 0,
      }
    }
  } catch (error) {
    log.warn("firebase", "getPlayerProgress: network error or offline", { error: String(error) })
  }

  return { bestScore: 0, coins: 0 }
}

export const updatePlayerCoins = async (coins: number): Promise<void> => {
  const user = getUser()
  const safeCoins = Math.max(0, Math.floor(coins))

  if (!user) {
    try {
      const guestId = await getGuestId()
      const existingGuest = await getDocument(GUEST_COLLECTION, guestId)
      const payload = {
        coins: safeCoins,
        bestScore: existingGuest?.bestScore || 0,
        timestamp: Timestamp.now(),
      }

      if (!existingGuest) {
        await setDocument(GUEST_COLLECTION, guestId, payload)
      } else {
        await updateDocument(GUEST_COLLECTION, guestId, payload)
      }
    } catch (error) {
      log.warn("firebase", "updatePlayerCoins: failed guest coin sync", { error: String(error) })
    }
    return
  }

  try {
    const existing = await getDocument(COLLECTION, user.uid)
    const payload = {
      coins: safeCoins,
      timestamp: Timestamp.now(),
    }

    if (!existing) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { useAppStore } = require("../../state/appStore")
      const playerName = useAppStore.getState().playerName

      await setDocument(COLLECTION, user.uid, {
        playerName,
        score: 0,
        level: 1,
        xp: 0,
        platform: Platform.OS as 'ios' | 'android',
        ...payload,
      })
      return
    }

    await updateDocument(COLLECTION, user.uid, payload)
  } catch (error) {
    log.warn("firebase", "updatePlayerCoins: network error or offline", { error: String(error) })
  }
}

// -------------------------
// Get top N leaderboard players
// -------------------------
export const getTopPlayers = async (top = 10): Promise<LeaderboardEntry[]> => {
  try {
    log.info("firebase", "fetching top players", { top })
    const q = query(collection(db, COLLECTION), orderBy('score', 'desc'), limit(top))
    const snap = await getDocs(q)

    const entries: LeaderboardEntry[] = snap.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<LeaderboardEntry, 'id'>),
    }))

    log.info("firebase", "getTopPlayers fetched", { count: entries.length })
    return entries
  } catch (err) {
    // Network error or offline - log but return empty gracefully
    log.warn("firebase", "getTopPlayers: network error or offline", { error: String(err) })
    return []
  }
}
