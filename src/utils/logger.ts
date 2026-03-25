import { runOnJS } from "react-native-reanimated"

// Logger
// Worklet-safe debug logger for Beer Jump.
//
// USAGE JS thread:
//   import { log } from "../utils/logger"
//   log.info("appStore", "personalBest updated", { score: 4200 })
//   log.warn("gameLoop", "deltaTime spike", { dt: 48 })
//   log.error("firebase", "write failed", { uid, error })
//
// USAGE inside a worklet (UI thread):
//   import { logFromWorklet } from "../utils/logger"
//   logFromWorklet("physics", "collision hit", { px, py })
//
// TOGGLE disable all logging for a build:
//   Set LOGGING_ENABLED = false below.
//
// FILTER log only specific categories:
//   Set ACTIVE_CATEGORIES to a subset, or leave empty to log everything.
//   e.g. ["physics", "gameLoop"] to focus on the game tick.
//
// CATEGORIES used in Phase 1:
//   "gameLoop"    frame tick events (deltaTime spikes, death trigger)
//   "physics"     collision detection, bounce, wrap
//   "platforms"   pool recycling, spawn positions
//   "input"       gyro values, touch state changes
//   "appStore"    Zustand state transitions
//   "navigation"  screen transitions
//   "firebase"    auth and Firestore ops (Phase 4+)
const LOGGING_ENABLED = __DEV__ // automatically off in production builds

// Leave empty to log all categories, or specify a subset to filter:
// e.g. const ACTIVE_CATEGORIES: string[] = ["gameLoop", "physics"]
const ACTIVE_CATEGORIES: string[] = []

// Internal
type Level = "INFO" | "WARN" | "ERROR"

const LEVEL_COLOURS: Record<Level, string> = {
  INFO: "\x1b[36m", // cyan
  WARN: "\x1b[33m", // yellow
  ERROR: "\x1b[31m", // red
}
const RESET = "\x1b[0m"

function shouldLog(category: string): boolean {
  if (!LOGGING_ENABLED) return false
  if (ACTIVE_CATEGORIES.length === 0) return true
  return ACTIVE_CATEGORIES.includes(category)
}

function formatMessage(
  level: Level,
  category: string,
  message: string,
  data?: Record<string, unknown>,
): string {
  const colour = LEVEL_COLOURS[level]
  const prefix = `${colour}[${level}]${RESET} [${category}]`
  const dataStr = data ? " " + JSON.stringify(data) : ""
  return `${prefix} ${message}${dataStr}`
}

function _log(
  level: Level,
  category: string,
  message: string,
  data?: Record<string, unknown>,
): void {
  if (!shouldLog(category)) return
  const formatted = formatMessage(level, category, message, data)
  if (level === "ERROR") {
    console.error(formatted)
  } else if (level === "WARN") {
    console.warn(formatted)
  } else {
    console.log(formatted)
  }
}

// JS-thread logger use anywhere outside worklets
export const log = {
  info: (category: string, message: string, data?: Record<string, unknown>) =>
    _log("INFO", category, message, data),

  warn: (category: string, message: string, data?: Record<string, unknown>) =>
    _log("WARN", category, message, data),

  error: (category: string, message: string, data?: Record<string, unknown>) =>
    _log("ERROR", category, message, data),
}


// Worklet-safe logger use inside useFrameCallback and other worklets.
// Bridges the UI thread → JS thread via runOnJS. This adds a small async
// delay and should only be used for debugging never in hot paths during
// normal play. Wrap in a condition so it fires rarely:
//
//   if (hit) logFromWorklet("physics", "platform bounce", { px, py })
//   if (dt > 32) logFromWorklet("gameLoop", "deltaTime capped", { raw: rawDelta })
//
// logFromWorklet always logs at INFO level. For errors detected in worklets,
// use runOnJS(log.error)("category", "message") directly.
function _logFromJS(category: string, message: string, dataJson: string): void {
  _log("INFO", category, message, dataJson ? JSON.parse(dataJson) : undefined)
}

export function logFromWorklet(
  category: string,
  message: string,
  data?: Record<string, number | boolean | string>,
): void {
  "worklet"
  if (!LOGGING_ENABLED) return
  // Serialise data to JSON string only primitives cross the thread boundary cleanly
  const dataJson = data ? JSON.stringify(data) : ""
  runOnJS(_logFromJS)(category, message, dataJson)
}
