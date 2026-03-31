import { signInAnonymously, onAuthStateChanged, User } from 'firebase/auth'
import { auth } from './config'
import { log } from '../../utils/logger'

// ---------------------------------------------------------------------------
// Auth module — Beer Jump
//
// Design rules (see firebase-auth-fix-plan.md):
//
//   1. authStateReady() is awaited in App.tsx before any screen renders.
//      By the time any game code runs, currentUser is guaranteed non-null.
//
//   2. initAuth() is a singleton — calling it concurrently always returns the
//      same Promise. No duplicate signInAnonymously() calls possible.
//
//   3. onAuthStateChanged listener is unsubscribed immediately after the
//      first event fires. No listener leak across multiple calls.
//
//   4. On successful sign-in, the resolved UID is written to Zustand so
//      overlays can read it reactively (architecture doc §7).
//
// Bug history: Bug A (currentUser null race), Bug B (listener leak),
// Bug C (concurrent duplicate sign-ins) — all fixed here.
// ---------------------------------------------------------------------------

let currentUser: User | null = null

// Singleton promise — module-level so concurrent callers share one flight.
let authPromise: Promise<User> | null = null

// ---------------------------------------------------------------------------
// initAuth
//
// Call once from App.tsx after auth.authStateReady() has resolved.
// authStateReady() guarantees the SDK has restored any persisted session,
// so onAuthStateChanged fires exactly once synchronously with either a
// restored User or null — no async race window.
// ---------------------------------------------------------------------------
export const initAuth = (): Promise<User> => {
  if (authPromise) {
    log.info("firebase", "initAuth: returning existing singleton promise")
    return authPromise
  }

  log.info("firebase", "initAuth: start")

  authPromise = new Promise<User>((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      // Stop listening immediately we only need the initial state.
      unsubscribe()

      if (user) {
        log.info("firebase", "initAuth: existing session restored", {
          uid: user.uid,
        })
        currentUser = user
        writeUIDToStore(user.uid)
        resolve(user)
      } else {
        log.info("firebase", "initAuth: no session, signing in anonymously")
        try {
          const result = await signInAnonymously(auth)

          log.info("firebase", "initAuth: anonymous sign-in success", {
            uid: result.user.uid,
          })

          currentUser = result.user
          writeUIDToStore(result.user.uid)
          resolve(result.user)
        } catch (err) {
          log.error("firebase", "initAuth: anonymous sign-in failed", {
            error: String(err),
          })
          authPromise = null
          reject(err)
        }
      }
    })
  })

  return authPromise
}

// ---------------------------------------------------------------------------
// getUser
//
// Returns the resolved User or null. Will only be null if called before
// initAuth() has resolved — which should not happen in normal operation
// because App.tsx awaits initAuth() before rendering any game screen.
// ---------------------------------------------------------------------------
export const getUser = (): User | null => currentUser

// ---------------------------------------------------------------------------
// writeUIDToStore — lazy import to avoid circular dependency
//
// appStore imports nothing from firebase/. firebase/ imports appStore only
// here, after sign-in, so the dependency graph stays acyclic.
// ---------------------------------------------------------------------------
const writeUIDToStore = (uid: string) => {
  // Dynamic require keeps the import lazy and avoids a circular dep at
  // module evaluation time. appStore is always initialised before initAuth
  // resolves because App.tsx creates the store tree first.
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useAppStore } = require("../../state/appStore")
    useAppStore.getState().setAuthUID(uid)
    log.info("firebase", "initAuth: authUID written to Zustand store", { uid })
  } catch (err) {
    log.error("firebase", "initAuth: failed to write authUID to store", {
      error: String(err),
    })
  }
}
