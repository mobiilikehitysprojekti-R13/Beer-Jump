// babel.config.js
//
// SETUP: if bundling fails with "Cannot find module 'babel-preset-expo'",
// install the package first:
//   npx expo install babel-preset-expo
// Then restart Metro with cache clear:
//   npx expo start --clear
//
// React Compiler is enabled by default in Expo SDK 54 and applies a dev-mode
// double-mount behaviour (same as React StrictMode) that causes Reanimated's
// useFrameCallback to register callbacks twice per mount.
// This produces 2–3 active game loop callbacks instead of 1, visibly doubling
// or tripling game speed in Expo Go (BUG-9).
//
// Disabling React Compiler here eliminates the double-mount in dev and makes
// Expo Go behaviour match the production build exactly.
//
// No performance or correctness cost for Beer Jump:
//   - The game loop runs entirely in Reanimated worklets React Compiler
//     never touched it.
//   - Screens are too simple for compiler memoisation to be measurable.
//   - All manual useCallback / useRef patterns added during development
//     remain in place and continue to work correctly.
//
// Re-enable when upgrading to a Reanimated version that fixes the Strict Mode
// double-registration issue (tracked: reanimated#8228).
//
// After changing this file, always restart Metro with cache clear:
//   npx expo start --clear

module.exports = function (api) {
  api.cache(true)
  return {
    presets: [
      [
        "babel-preset-expo",
        {
          "react-compiler": false,
        },
      ],
    ],
  }
}
