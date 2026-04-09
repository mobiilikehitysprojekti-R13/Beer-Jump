import { Timestamp, collection, getDocs, query, orderBy, limit, doc, getDoc } from 'firebase/firestore'
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
