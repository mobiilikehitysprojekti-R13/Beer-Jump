import { ImageBackground, StyleSheet, View } from "react-native"

type Props = {
  scene: "plain" | "sunrise"
}

const sunriseBackground = require("../../../assets/textures/themes/cartoon_sunrise.png")

export function ThemeBackdrop({ scene }: Props) {
  if (scene !== "sunrise") {
    return null
  }

  return (
    <View pointerEvents="none" style={styles.container}>
      <ImageBackground
        source={sunriseBackground}
        resizeMode="cover"
        style={styles.image}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  image: {
    ...StyleSheet.absoluteFillObject,
  },
})
