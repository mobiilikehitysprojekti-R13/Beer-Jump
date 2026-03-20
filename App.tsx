import { NavigationContainer } from "@react-navigation/native"
import { createStackNavigator } from "@react-navigation/stack"
import { SafeAreaProvider } from "react-native-safe-area-context"
import GameScreen from "./src/screens/GameScreen"

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
// History of what was tried and why this structure is necessary:
//   See refactoring-plan-permanent-gamescreen.md in /docs.
//
// NavigationContainer and createStackNavigator are retained for Phase 3+
// screens (Leaderboard, Settings, Shop) which will be pushed on top of Game
// as normal stack screens.
// ---------------------------------------------------------------------------
export type RootStackParamList = {
  Game: undefined
}

const Stack = createStackNavigator<RootStackParamList>()

export default function App() {
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
