import { Timestamp, collection, getDocs, query, orderBy, limit } from 'firebase/firestore'
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
  // Auth is guaranteed settled by App.tsx bootstrap before GameScreen mounts.
  // If getUser() somehow returns null here it means the bootstrap sequence
  // was bypassed — log and bail rather than attempting a broken sign-in.
  const user = getUser()
  if (!user) {
    log.error("firebase", "submitScore: getUser() returned null — auth bootstrap may not have completed", { score })
    return
  }

  log.info("firebase", "submitScore called", { uid: user.uid, score })

  const existing = await getDocument(COLLECTION, user.uid)
  const data = {
    playerName: 'Player', // you can replace this with a customizable name
    score,
    timestamp: Timestamp.now(),
    ...extra,
  }

  if (!existing) {
    log.info("firebase", "creating new leaderboard entry", { uid: user.uid, score })
    return setDocument(COLLECTION, user.uid, data)
  }

  if (score > existing.score) {
    log.info("firebase", "new high score", { oldScore: existing.score, newScore: score })
    return updateDocument(COLLECTION, user.uid, data)
  }

  log.info("firebase", "score not higher, skipping update", { score, best: existing.score })
}

// -------------------------
// Get the current player's leaderboard data
// -------------------------
export const getPlayerData = async (): Promise<LeaderboardEntry | null> => {
  const user = getUser()
  if (!user) return null

  const docData = await getDocument(COLLECTION, user.uid)
  if (!docData) return null

  return { id: user.uid, ...(docData as Omit<LeaderboardEntry, 'id'>) }
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
    log.error("firebase", "getTopPlayers failed", { error: String(err) })
    return []
  }
}
