import { signInAnonymously, onAuthStateChanged, User } from 'firebase/auth'
import { auth } from './config'
import { log } from '../../utils/logger'

let currentUser: User | null = null

export const initAuth = () => {
    log.info("firebase", "initAuth start")

    return new Promise<User>((resolve, reject) => {
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                log.info("firebase", "existing user restored", { uid: user.uid })
                currentUser = user
                resolve(user)
            } else {
                try {
                    log.info("firebase", "signing in anonymously")

                    const result = await signInAnonymously(auth)

                    log.info("firebase", "anonymous sign-in success", {
                        uid: result.user.uid,
                    })

                    currentUser = result.user
                    resolve(result.user)
                } catch (err) {
                    log.error("firebase", "anonymous sign-in failed", {
                        error: String(err),
                    })
                    reject(err)
                }
            }
        })
    })
}

export const getUser = () => currentUser