import { useEffect, useState } from "react"
import { View, Text, StyleSheet } from "react-native"
import { NavigationContainer } from "@react-navigation/native"
import { createStackNavigator } from "@react-navigation/stack"
import { SafeAreaProvider } from "react-native-safe-area-context"
import GameScreen from "./src/screens/GameScreen"
import { auth } from "./src/services/firebase/config"
import { initAuth } from "./src/services/firebase/auth"
import { log } from "./src/utils/logger"

// ---------------------------------------------------------------------------
// RootStackParamList
//
// GameScreen is the only navigator screen. It mounts once at app start and
// never unmounts this is the architectural fix for BUG-9.
//
// HomeScreen and GameOverScreen are rendered as View overlays inside
// GameScreen, not as separate navigator screens. This guarantees that
// useFrameCallback registers exactly once per app session and is never
// re-registered regardless of game state transitions.
//
// See: docs/beer-jump-architecture-v1-0.md §3 (BUG-9) and Rule 17/18.
//
// NavigationContainer and createStackNavigator are retained for Phase 3+
// screens (Settings, Shop) which will be pushed on top of Game as overlays.
// ---------------------------------------------------------------------------
export type RootStackParamList = {
  Game: undefined
}

const Stack = createStackNavigator<RootStackParamList>()

// ---------------------------------------------------------------------------
// Auth initialisation sequence
//
// Step 1: auth.authStateReady()
//   SDK promise that resolves once the persisted auth session has been
//   restored from AsyncStorage (or determined not to exist). This is the
//   correct replacement for relying on auth.currentUser synchronously,
//   which is null for several hundred ms after app boot.
//
// Step 2: initAuth()
//   After authStateReady(), onAuthStateChanged fires exactly once with the
//   restored user (or null). initAuth() either returns the existing user or
//   calls signInAnonymously() — and writes the UID to Zustand.
//
// The navigator only renders after both steps complete. By the time
// GameScreen mounts, auth is guaranteed to be settled and getUser() will
// never return null during gameplay.
// ---------------------------------------------------------------------------
type AuthState = "loading" | "ready" | "error"

export default function App() {
  const [authState, setAuthState] = useState<AuthState>("loading")

  useEffect(() => {
    let cancelled = false

    const bootstrap = async () => {
      try {
        log.info("app", "auth bootstrap: awaiting authStateReady()")

        // Step 1: wait for SDK to restore persisted session.
        await auth.authStateReady()

        log.info(
          "app",
          "auth bootstrap: authStateReady resolved, calling initAuth()",
        )

        // Step 2: sign in anonymously if no session, write UID to Zustand.
        await initAuth()

        log.info("app", "auth bootstrap: complete, rendering navigator")

        if (!cancelled) setAuthState("ready")
      } catch (err) {
        log.error("app", "auth bootstrap: failed", { error: String(err) })
        if (!cancelled) setAuthState("error")
      }
    }

    bootstrap()

    return () => {
      cancelled = true
    }
  }, [])

  // Show a minimal splash while auth resolves (~100–400ms on device).
  // This is intentionally plain — it is replaced by the HomeOverlay the
  // moment GameScreen renders, so the user barely sees it.
  if (authState === "loading") {
    return (
      <View style={styles.splash}>
        <Text style={styles.splashTitle}>Beer Jump</Text>
        <Text style={styles.splashSub}>Loading…</Text>
      </View>
    )
  }

  // Auth failed (network error on first-ever launch, etc.). Show a minimal
  // retry prompt. In practice this is extremely rare — signInAnonymously()
  // succeeds even offline on subsequent launches because the session is
  // cached by the Firebase SDK.
  if (authState === "error") {
    return (
      <View style={styles.splash}>
        <Text style={styles.splashTitle}>Beer Jump</Text>
        <Text style={styles.splashError}>
          Could not connect. Please check your connection and restart.
        </Text>
      </View>
    )
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name='Game' component={GameScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: "#1a1a2e",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  splashTitle: {
    color: "#FFA000",
    fontSize: 48,
    fontWeight: "bold",
  },
  splashSub: {
    color: "#FFFFFF",
    fontSize: 16,
    opacity: 0.6,
  },
  splashError: {
    color: "#FF6B6B",
    fontSize: 16,
    textAlign: "center",
    paddingHorizontal: 32,
  },
})
