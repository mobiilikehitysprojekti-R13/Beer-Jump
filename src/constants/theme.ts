export type ThemePalette = {
  id: string
  displayName: string
  menuBackground: string
  gameBackground: string
  scene: "plain" | "sunrise"
  fontFamily: string
  titleColor: string
  textColor: string
  mutedTextColor: string
  cardBackground: string
  cardBorder: string
  buttonBackground: string
  buttonTextColor: string
  badgeBackground: string
  badgeBorder: string
  inputBackground: string
}

const DEFAULT_THEME_ID = "default_theme"

const THEME_PALETTES: Record<string, ThemePalette> = {
  [DEFAULT_THEME_ID]: {
    id: DEFAULT_THEME_ID,
    displayName: "Default",
    menuBackground: "#1a1a2e",
    gameBackground: "#1a1a2e",
    scene: "plain",
    fontFamily: "System",
    titleColor: "#FFA000",
    textColor: "#FFFFFF",
    mutedTextColor: "#CCCCCC",
    cardBackground: "#2a2a44",
    cardBorder: "rgba(255,255,255,0.12)",
    buttonBackground: "#FFA000",
    buttonTextColor: "#1a1a2e",
    badgeBackground: "rgba(26, 26, 46, 0.75)",
    badgeBorder: "rgba(255, 213, 79, 0.5)",
    inputBackground: "#FFFFFF20",
  },
  cartoon_sunrise: {
    id: "cartoon_sunrise",
    displayName: "Cartoon Sunrise",
    menuBackground: "#163f66",
    gameBackground: "#75c9ff",
    scene: "sunrise",
    fontFamily: "serif",
    titleColor: "#7A4300",
    textColor: "#1B1B1B",
    mutedTextColor: "#4B3420",
    cardBackground: "#FFF2C6",
    cardBorder: "rgba(122, 67, 0, 0.35)",
    buttonBackground: "#FFCC4D",
    buttonTextColor: "#3C2200",
    badgeBackground: "rgba(255, 244, 214, 0.8)",
    badgeBorder: "rgba(122, 67, 0, 0.25)",
    inputBackground: "#FFF8E7",
  },
}

export const getThemePalette = (themeTextureName: string): ThemePalette => {
  return THEME_PALETTES[themeTextureName] || THEME_PALETTES[DEFAULT_THEME_ID]
}

export const isKnownTheme = (themeTextureName: string): boolean => {
  return Boolean(THEME_PALETTES[themeTextureName])
}

export const DEFAULT_THEME_TEXTURE_NAME = DEFAULT_THEME_ID
