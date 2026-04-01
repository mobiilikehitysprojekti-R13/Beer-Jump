import { useEffect } from "react"
import { Accelerometer } from "expo-sensors"
import { Platform } from "react-native"
import { gyroX } from "../state/gameValues"
import { useAppStore } from "../state/appStore"

// ---------------------------------------------------------------------------
// useTiltInput
//
// Replaces useGyroInput. Reads the Accelerometer X axis instead of the
// Gyroscope Y axis to drive left/right movement.
//
// WHY ACCELEROMETER INSTEAD OF GYROSCOPE:
//   The Gyroscope measures angular velocity — how fast the device is rotating
//   in rad/s. This means you have to keep actively tilting to produce a signal.
//   Hold the phone at a fixed angle and the gyro reads near-zero because no
//   rotation is happening. This makes it feel sluggish and unresponsive compared
//   to a direction key, which stays active as long as it is held.
//
//   The Accelerometer measures the gravitational force on each axis, which
//   directly reflects the current tilt angle of the device. Hold the phone
//   tilted left and the X value stays at a constant negative value. This is
//   exactly the "held tilt = constant speed" behaviour that matches touch keys.
//
// AXIS MAPPING (portrait mode, device upright):
//   Accelerometer X axis:
//     0     = phone perfectly vertical (upright, no tilt)
//     ~-1g  = phone tilted fully to the left  (left side down)
//     ~+1g  = phone tilted fully to the right (right side down)
//
//   Platform-specific handling:
//     Android: negate the X value (x is inverted relative to game convention)
//     iOS: use X value directly
//   If tilt direction feels wrong on a specific device, check platform handling.
//
// UPDATE RATE:
//   Accelerometer.setUpdateInterval(16) requests 60fps updates.
//   Android 12+ in Expo Go caps sensor updates at 200ms (5fps) for the
//   Gyroscope, but the Accelerometer is NOT subject to this cap at the same
//   level — it updates significantly more frequently under normal conditions.
//   This is another reason to prefer the Accelerometer for this use case.
//
// SHARED VALUE:
//   Still writes to gyroX (shared value name retained for compatibility with
//   the existing game loop — the worklet reads GV.gyroX.value every frame).
//   The name is slightly misleading now; it holds tilt position, not gyro rate.
//   Rename to tiltX in a future cleanup pass if desired.
//
// GRACEFUL DEGRADATION:
//   If the device has no accelerometer, gyroX stays 0 and touch controls
//   remain fully functional.
// ---------------------------------------------------------------------------
export function useTiltInput() {
  useEffect(() => {
    let sub: ReturnType<typeof Accelerometer.addListener> | null = null

    const gyroEnabled = useAppStore.getState().gyroEnabled

    if (!gyroEnabled) {
      console.log("useTiltInput", "gyro disabled in settings, skipping accelerometer listener")
      return
    }

    try {
      console.log("useTiltInput", "initializing accelerometer listener", { platform: Platform.OS })
      Accelerometer.setUpdateInterval(16) // request ~60fps — not capped like gyro
      sub = Accelerometer.addListener(({ x }) => {
        // Handle platform-specific tilt inversion
        // iOS accelerometer X axis needs different handling than Android
        const tiltValue = Platform.OS === 'ios' ? x : -x
        gyroX.value = tiltValue
      })
    } catch (err) {
      // Device has no accelerometer — gyroX stays 0, touch controls still work
      console.warn("useTiltInput: Accelerometer not available on this device", err)
    }

    return () => {
      sub?.remove()
    }
  }, [])
}
