import { Timestamp } from 'firebase/firestore'
import { getUser, initAuth } from './auth'
import { getDocument, setDocument, updateDocument } from './firestore'
import { log } from '../../utils/logger'

const COLLECTION = 'leaderboard'

export const submitScore = async (score: number, extra: {
    level: number
    xp: number
    coins: number
    platform: 'ios' | 'android'
}) => {
    const user = getUser()
    if (!user) throw new Error('User not authenticated')

    log.info("firebase", "submitScore called", { score })

    const existing = await getDocument(COLLECTION, user.uid)

    const data = {
        playerName: 'Player',
        score,
        timestamp: Timestamp.now(),
        ...extra,
    }

    if (!user) {
        log.warn("firebase", "no user, initializing auth...")
        const newUser = await initAuth()
    }

    if (!existing) {
        log.info("firebase", "creating new leaderboard entry", {
            uid: user.uid,
            score,
        })

        return setDocument(COLLECTION, user.uid, data)
    }

    if (score > existing.score) {
        log.info("firebase", "new high score", {
            oldScore: existing.score,
            newScore: score,
        })

        return updateDocument(COLLECTION, user.uid, data)
    }

    log.info("firebase", "score not higher, skipping update", {
        score,
        best: existing.score,
    })
}

export const getPlayerData = async () => {
    const user = getUser()
    if (!user) return null

    return getDocument(COLLECTION, user.uid)
}