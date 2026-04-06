import { Dimensions } from "react-native"

const { width, height } = Dimensions.get("window")

export const SCREEN_WIDTH = width
export const SCREEN_HEIGHT = height

// TUNING GUIDE
//
// All gameplay-feel values live in this file. To tune, change only the values here
// never put magic numbers in physics.ts, PlatformGenerator.ts, or the game loop.
// Each section below is self-contained and labelled.
//
// Current profile: PLAYTEST-EASY
//   Floaty physics, wide paired platforms, generous pool, responsive gyro.
//   Dial back toward NORMAL once difficulty scaling is implemented in the future
//
// JUMP PHYSICS
//
// Peak height formula:  JUMP_VELOCITY² / (2 × GRAVITY)
// Hang time formula:    (2 × |JUMP_VELOCITY|) / GRAVITY  (ms, full arc)
//
// PLAYTEST-EASY values (current):
//   GRAVITY = 0.020        (normal fast snappy upswing)
//   JUMP_VELOCITY = -3.8   (normal takeoff speed)
//   MAX_FALL_SPEED = 1.0   (reduced from 3.5 slow drift down = "floaty" feel)
//
//   Peak height = 3.8² / (2 × 0.020) = 361px  (~45% screen height)  ← unchanged
//   Time to peak = 190ms  ← fast, snappy
//   Time to fall from peak at cap = 361ms  ← slow drift down
//   Total arc ≈ 551ms  (vs 380ms normal 45% longer, all in the descent)
//
//   "Floaty" here means slow descent, not higher jumps.
//   The upswing is unchanged. Only the fall feels drifty.
//
// NORMAL values (restore for Phase 2):
//   MAX_FALL_SPEED = 3.5  (fast fall, tighter arc)
//
// Tuning order: adjust MAX_FALL_SPEED to control how floaty the descent feels.
//   Lower = driftier. Minimum practical value is ~0.5 (very slow fall).
//   GRAVITY controls overall arc shape. JUMP_VELOCITY controls peak height.
export const GRAVITY = 0.02 // units/ms²  normal gravity, snappy upswing
export const JUMP_VELOCITY = -3.8 // units/ms   negative = upward
export const MAX_FALL_SPEED = 1.0 // units/ms   PLAYTEST: slow drift down = floaty feel

// PLATFORM LAYOUT
//
// Row-based generation model:
//   Floor row: FLOOR_PLATFORMS side-by-side platforms, full screen width
//   Regular rows: PLATFORMS_PER_ROW platforms per row, PLATFORM_ROW_HEIGHT apart
//   Platforms in a row occupy consecutive adjacent columns.
//
// PLATFORM_POOL_SIZE must satisfy:
//   PLATFORM_POOL_SIZE >= FLOOR_PLATFORMS + (rows × PLATFORMS_PER_ROW)
//   Changing PLATFORMS_PER_ROW also requires updating PlatformGenerator.ts.
//
// PLAYTEST-EASY values (current):
//   PLATFORM_POOL_SIZE = 120  (double original 60)
//   PLATFORMS_PER_ROW  = 2    (paired = wider landing surface, easier to land on)
//   Pool maths: regular slots = 120−6 = 114, rows = 114/2 = 57 rows ahead
//
// NORMAL values (restore for Phase 2):
//   PLATFORM_POOL_SIZE = 60, PLATFORMS_PER_ROW = 1
export const PLATFORM_POOL_SIZE = 120 // total platform objects in pool
export const PLATFORM_COLUMNS = 6 // number of equal-width columns across the screen
export const FLOOR_PLATFORMS = 6 // platforms in the starting floor row (= PLATFORM_COLUMNS)
export const PLATFORMS_PER_ROW = 2 // platforms placed per regular row PLAYTEST: paired
export const PLATFORM_ROW_HEIGHT = 200 // px between rows fits within playtest jump peak of 722px

//PLATFORM_WIDTH_APPROX is an approximation for GameCanvas rendering only.
// Collision and generation always use the exact runtime value SCREEN_WIDTH / PLATFORM_COLUMNS.
export const PLATFORM_WIDTH_APPROX = 65 // px approximate never use for collision math
export const PLATFORM_HEIGHT = 18 // px platform thickness (visual)

// Legacy gap constants reserved for DifficultyScaler in Phase 2
export const PLATFORM_MIN_GAP = 10
export const PLATFORM_MAX_GAP = 20

// TILT INPUT (Accelerometer)
//
// Input is now driven by the Accelerometer X axis, not the Gyroscope.
// See useTiltInput.ts for the full reasoning.
//
// Accelerometer X range (portrait, device upright):
//   0g   = phone perfectly vertical, no tilt
//   1g   = phone fully horizontal (lying flat to one side)
//   Comfortable play range: ~0.2g–0.6g (gentle to strong tilt)
//
// Mapping (direct, not accumulation):
//   vx = clamp(tiltVal × GYRO_SENSITIVITY, ±MAX_HORIZONTAL_SPEED)
//
// Because the accelerometer reflects held tilt angle (not rotation rate),
// holding a tilt produces a constant vx exactly like holding a direction key.
//
// PLAYTEST-EASY values (current):
//   GYRO_SENSITIVITY    = 1.2   (comfortable tilt at ~0.3g → vx ≈ 0.36 → good speed)
//   MAX_HORIZONTAL_SPEED = 1.2  (full tilt or more → caps here → crosses screen ~300ms)
//   Effect: gentle 20° tilt → ~0.33g → vx ≈ 0.4 units/ms, responsive but not twitchy
//           strong tilt (>45°) hits max speed immediately
//
// NORMAL values (restore for Phase 2 when difficulty scaling arrives):
//   GYRO_SENSITIVITY = 0.8, MAX_HORIZONTAL_SPEED = 0.8
//
// GYRO_DEADZONE filters out the small accelerometer noise when phone is held
// near-vertical. Set to 0.05g any tilt less than ~3° is ignored.
export const GYRO_SENSITIVITY = 1.2 // units/ms per g PLAYTEST: responsive tilt
export const GYRO_SENSITIVITY_MIN = 0.5 // Settings slider lower bound
export const GYRO_SENSITIVITY_MAX = 2.0 // Settings slider upper bound
export const GYRO_DEADZONE = 0.05 // g noise floor filter (~3° of tilt)

// TOUCH INPUT
// Acceleration model (unlike gyro's direct mapping):
//   Holding a zone accelerates vx toward ±MAX_HORIZONTAL_SPEED.
//   Releasing decelerates back to zero at TOUCH_DECEL rate.
//   When gyro is active, touch decel is suppressed so they don't fight.
// At 60fps (dt ≈ 16ms):
//   TOUCH_ACCELERATION = 0.06 → adds ~0.96 units/ms per second of holding
//   TOUCH_DECEL        = 0.12 → stops from max speed in ~500ms after release
// Touch response felt fine at original values unchanged.
// MAX_HORIZONTAL_SPEED is shared with gyro (Section 3).
export const TOUCH_ACCELERATION = 0.06 // units/ms² acceleration while zone is held
export const TOUCH_DECEL = 0.12 // units/ms² deceleration after release
export const MAX_HORIZONTAL_SPEED = 1.2 // units/ms  shared cap for gyro and touch

// STARTUP TIMING
// Input is suppressed at run start so stale gyro tilt from the previous run
// does not immediately send BeerGuy sideways at the moment grace ends.
export const INPUT_GRACE_MS = 500 // ms input suppressed at each run start
// Must equal GAME_START_DELAY_MS (Section 10) so tilt input
// activates at the same moment the game starts moving.
// SCORE
export const SCORE_PER_UNIT = 10 // camera units scrolled per score point

// PLAYER DIMENSIONS
export const PLAYER_WIDTH = 48 // px
export const PLAYER_HEIGHT = 48 // px

// LOOP TIMING
//
// Cap on per-frame dt to prevent physics explosion on lag spikes.
// Set to 2× target frame time (2 × 16ms). Never set below 16.
export const MAX_DELTA_TIME = 32 // ms per-frame deltaTime cap

// GAME START DELAY
//
// How long to wait after restartRun() is called before the frame callback
// activates and BeerGuy starts moving. This gives the React Navigation
// screen transition animation time to complete so the player can see the
// game before it starts.
//
// Without this delay, BeerGuy can bounce several platforms high before the
// transition animation finishes, which is disorienting.
//
// The navigation transition duration is ~300ms by default in
// @react-navigation/stack. Set GAME_START_DELAY_MS to cover that plus a
// small buffer so the player sees a static frame before BeerGuy moves.
//
// Note: INPUT_GRACE_MS (Section 5) still applies after the game starts
// the two delays are additive. Total time before player has input control:
//   GAME_START_DELAY_MS + INPUT_GRACE_MS
//   = 500 + 800 = 1300ms from Play/Play Again press.
export const GAME_START_DELAY_MS = 500 // ms wait for screen transition before starting

// PLATFORM ANIMATION
//
// Platforms are rendered procedurally as colored rectangles with Skia.
// No sprite files required. Animations are continuous math, not frame steps.
//
// DISAPPEARING — sine wave opacity (all instances in unison via globalTime):
//   opacity = 0.5 + 0.5 × sin(globalTime × 2π / DISAPPEAR_PERIOD_MS)
//   Oscillates smoothly between 0.0 and 1.0 every DISAPPEAR_PERIOD_MS ms.
//   Collision always active — the cycle is purely visual.
//   Tune DISAPPEAR_PERIOD_MS to control how fast the platform fades in/out.
//
// BREAKABLE — linear alpha drain after first landing:
//   opacity = 1.0 - (crumbleTimer / CRUMBLE_DELAY_MS)
//   Fades from fully opaque to transparent over CRUMBLE_DELAY_MS ms,
//   then deactivates. One bounce guaranteed before it disappears.
//
// FAKE — constant semi-transparent (FAKE_PLATFORM_ALPHA).
//   Visually distinct from static — looks "ghostly". No animation.
//
// PLATFORM COLORS (hardcoded hex — game world colors, must not invert in dark mode):
//   static:       #4CAF50  green
//   moving:       #2196F3  blue
//   fake:         #9E9E9E  grey
//   disappearing: #FF9800  amber
//   breakable:    #F44336  red
export const DISAPPEAR_PERIOD_MS = 2000 // ms for one full opacity sine cycle
export const FAKE_PLATFORM_ALPHA = 0.45 // constant opacity for fake platforms

// (stubs, not yet active in gameplay)
export const MAX_ENEMIES = 8
export const MAX_POWER_UPS_ON_SCREEN = 3
export const CRUMBLE_DELAY_MS = 300
export const JETPACK_DURATION_MS = 5000
export const PRETZEL_JUMP_MULTIPLIER = 3
export const ROCKET_VELOCITY = -40
export const XP_PER_SCORE_UNIT = 0.1
export const COINS_PER_SCORE_UNIT = 0.01
