import { useAppStore } from "../state/appStore"
import { getThemePalette } from "../constants/theme"

const selectActiveTheme = (s: ReturnType<typeof useAppStore.getState>) => s.activeTheme

export const useActiveTheme = () => {
  const activeTheme = useAppStore(selectActiveTheme)
  return getThemePalette(activeTheme)
}
