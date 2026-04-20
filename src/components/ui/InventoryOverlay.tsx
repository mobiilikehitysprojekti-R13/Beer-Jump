import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, type ImageSourcePropType } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import {
  ensureDefaultInventoryForPlayer,
  getPlayerInventory,
  InventoryItem,
} from '../../services/firebase/inventory'
import { useAppStore } from '../../state/appStore'
import { useActiveTheme } from '../../hooks/useActiveTheme'
import { isKnownTheme } from '../../constants/theme'
import { ThemeBackdrop } from './ThemeBackdrop'

const getTexturePreviewSource = (textureName: string): ImageSourcePropType | null => {
  if (textureName === 'corona_bottle' || textureName === 'beer_bottle') {
    return require('../../../assets/textures/characters/corona_bottle_1.png')
  }

  if (textureName === 'cartoon_sunrise') {
    return require('../../../assets/textures/themes/cartoon_sunrise.png')
  }

  return null
}

type Props = {
  visible: boolean
  onClose: () => void
}

export function InventoryOverlay({ visible, onClose }: Props) {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const activeThemePalette = useActiveTheme()
  const activeThemeTextureName = useAppStore((s) => s.activeTheme)
  const activeCharacterTextureName = useAppStore((s) => s.activeSkin)

  const syncOwnedCharacterToStore = (textureName: string) => {
    const action = (useAppStore.getState() as { addOwnedSkin?: (skinTextureName: string) => void }).addOwnedSkin
    if (typeof action === 'function') {
      action(textureName)
    }
  }

  const equipCharacterInStore = (textureName: string) => {
    const action = (useAppStore.getState() as { setActiveSkin?: (skinTextureName: string) => void }).setActiveSkin
    if (typeof action === 'function') {
      action(textureName)
    }
  }

  const syncOwnedThemeToStore = (textureName: string) => {
    const action = (useAppStore.getState() as { addOwnedTheme?: (themeTextureName: string) => void }).addOwnedTheme
    if (typeof action === 'function') {
      action(textureName)
    }
  }

  const equipThemeInStore = (textureName: string) => {
    const action = (useAppStore.getState() as { setActiveTheme?: (themeTextureName: string) => void }).setActiveTheme
    if (typeof action === 'function') {
      action(textureName)
    }
  }

  useEffect(() => {
    if (!visible) {
      return
    }

    const fetchInventory = async () => {
      setLoading(true)
      setError(null)

      try {
        await ensureDefaultInventoryForPlayer()
        const playerInventory = await getPlayerInventory()
        playerInventory
          .filter((item) => item.type === 'theme' && isKnownTheme(item.textureName))
          .forEach((item) => syncOwnedThemeToStore(item.textureName))
        playerInventory
          .filter((item) => item.type === 'character')
          .forEach((item) => syncOwnedCharacterToStore(item.textureName))
        setItems(playerInventory)
      } catch (err) {
        setError('Failed to load inventory')
      } finally {
        setLoading(false)
      }
    }

    fetchInventory()
  }, [visible])

  const handleEquipTheme = (item: InventoryItem) => {
    if (!isKnownTheme(item.textureName)) {
      setFeedback(`Theme ${item.itemName} is not configured in this app build.`)
      return
    }

    equipThemeInStore(item.textureName)
    syncOwnedThemeToStore(item.textureName)
    setFeedback(`Equipped ${item.itemName}.`)
  }

  const handleEquipCharacter = (item: InventoryItem) => {
    equipCharacterInStore(item.textureName)
    syncOwnedCharacterToStore(item.textureName)
    setFeedback(`Equipped ${item.itemName}.`)
  }

  if (!visible) return null

  const characters = items.filter((item) => item.type === 'character')
  const themes = items.filter((item) => item.type === 'theme')

  return (
    <View style={[styles.container, { backgroundColor: activeThemePalette.menuBackground }]}>
      <ThemeBackdrop scene={activeThemePalette.scene} />
      <View style={styles.titleRow}>
        <MaterialCommunityIcons name='bag-personal-outline' size={42} color='#FFA000' />
        <Text style={[styles.title, { color: activeThemePalette.titleColor, fontFamily: activeThemePalette.fontFamily }]}>Inventory</Text>
      </View>

      {loading ? (
        <Text style={styles.infoText}>Loading inventory...</Text>
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name='account-circle-outline' size={22} color={activeThemePalette.textColor} />
            <Text style={[styles.sectionTitle, { color: activeThemePalette.textColor, fontFamily: activeThemePalette.fontFamily }]}>Characters</Text>
          </View>
          {characters.length === 0 ? (
            <Text style={styles.infoText}>No characters owned yet.</Text>
          ) : (
            characters.map((item) => (
              <TouchableOpacity
                key={item.id}
                onPress={() => handleEquipCharacter(item)}
                style={[
                  styles.itemRow,
                  { backgroundColor: activeThemePalette.cardBackground, borderColor: activeThemePalette.cardBorder, borderWidth: 1 },
                  activeCharacterTextureName === item.textureName && { borderColor: activeThemePalette.titleColor, borderWidth: 2, backgroundColor: activeThemePalette.badgeBackground },
                ]}
              >
                <View style={styles.itemHeaderRow}>
                  {getTexturePreviewSource(item.textureName) ? (
                    <Image
                      source={getTexturePreviewSource(item.textureName)!}
                      style={styles.previewImage}
                      resizeMode='cover'
                    />
                  ) : (
                    <View style={styles.previewPlaceholder} />
                  )}
                  <Text style={[styles.itemText, { color: activeThemePalette.textColor, fontFamily: activeThemePalette.fontFamily }]}>{item.itemName}</Text>
                </View>
                <Text style={[styles.subText, { color: activeThemePalette.mutedTextColor, fontFamily: activeThemePalette.fontFamily }]}>{item.textureName}</Text>
                <Text style={[styles.statusText, { color: activeCharacterTextureName === item.textureName ? activeThemePalette.titleColor : activeThemePalette.mutedTextColor, fontFamily: activeThemePalette.fontFamily }]}>
                  {activeCharacterTextureName === item.textureName ? 'Equipped' : 'Tap to equip'}
                </Text>
              </TouchableOpacity>
            ))
          )}

          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name='palette-outline' size={22} color={activeThemePalette.textColor} />
            <Text style={[styles.sectionTitle, { color: activeThemePalette.textColor, fontFamily: activeThemePalette.fontFamily }]}>Themes</Text>
          </View>
          {themes.length === 0 ? (
            <Text style={styles.infoText}>No themes owned yet.</Text>
          ) : (
            themes.map((item) => (
              <TouchableOpacity
                key={item.id}
                onPress={() => handleEquipTheme(item)}
                style={[
                  styles.itemRow,
                  { backgroundColor: activeThemePalette.cardBackground, borderColor: activeThemePalette.cardBorder, borderWidth: 1 },
                  activeThemeTextureName === item.textureName && { borderColor: activeThemePalette.titleColor, borderWidth: 2, backgroundColor: activeThemePalette.badgeBackground },
                ]}
              >
                <View style={styles.itemHeaderRow}>
                  {getTexturePreviewSource(item.textureName) ? (
                    <Image
                      source={getTexturePreviewSource(item.textureName)!}
                      style={styles.previewImage}
                      resizeMode='cover'
                    />
                  ) : (
                    <View style={styles.previewPlaceholder} />
                  )}
                  <Text style={[styles.itemText, { color: activeThemePalette.textColor, fontFamily: activeThemePalette.fontFamily }]}>{item.itemName}</Text>
                </View>
                <Text style={[styles.subText, { color: activeThemePalette.mutedTextColor, fontFamily: activeThemePalette.fontFamily }]}>{item.textureName}</Text>
                <Text style={[styles.statusText, { color: activeThemeTextureName === item.textureName ? activeThemePalette.titleColor : activeThemePalette.mutedTextColor, fontFamily: activeThemePalette.fontFamily }]}>
                  {activeThemeTextureName === item.textureName ? 'Equipped' : 'Tap to equip'}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}

      {feedback && <Text style={styles.infoText}>{feedback}</Text>}

      <TouchableOpacity style={styles.closeButton} onPress={onClose}>
        <Text style={styles.closeText}>Close</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#1a1a2e",
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFA000',
    textAlign: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    marginBottom: 6,
  },
  scrollView: {
    width: '100%',
    maxHeight: '60%',
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  itemRow: {
    width: '100%',
    backgroundColor: '#2a2a44',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  itemText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  itemHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  previewImage: {
    width: 34,
    height: 34,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  previewPlaceholder: {
    width: 34,
    height: 34,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  subText: {
    color: '#CCCCCC',
    fontSize: 14,
  },
  statusText: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: '700',
  },
  infoText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginVertical: 8,
  },
  errorText: {
    color: '#FF5A5F',
    fontSize: 16,
    marginVertical: 8,
  },
  closeButton: {
    marginTop: 12,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#FFA000',
    paddingVertical: 10,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  closeText: {
    color: '#FFA000',
    fontWeight: 'bold',
    fontSize: 18,
  },
})