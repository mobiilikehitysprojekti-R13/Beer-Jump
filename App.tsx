import { Canvas, Circle } from "@shopify/react-native-skia"
import { useSharedValue, useFrameCallback } from "react-native-reanimated"
import { View } from "react-native"

export default function App() {
  const x = useSharedValue(100)

  useFrameCallback(() => {
    "worklet"
    x.value = (x.value + 2) % 350
  })

  return (
    <View style={{ flex: 1, backgroundColor: "brown" }}>
      <Canvas style={{ flex: 1 }}>
        <Circle cx={x} cy={200} r={30} color='gold' />
      </Canvas>
    </View>
  )
}
