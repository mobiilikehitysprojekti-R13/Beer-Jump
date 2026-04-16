import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, type ImageSourcePropType } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { getShopItems, ShopItem } from '../../services/firebase/shop'
import { useActiveTheme } from '../../hooks/useActiveTheme'
import {
  addItemToInventory,
  ensureDefaultInventoryForPlayer,
  getPlayerInventory,
} from '../../services/firebase/inventory'
import { useAppStore } from '../../state/appStore'
import { isKnownTheme } from '../../constants/theme'
import { ThemeBackdrop } from './ThemeBackdrop'

type Props = {
  visible: boolean
  onClose: () => void
}

const selectCoins = (s: ReturnType<typeof useAppStore.getState>) => s.coins
const selectSpendCoins = (s: ReturnType<typeof useAppStore.getState>) => s.spendCoins
const selectAddCoins = (s: ReturnType<typeof useAppStore.getState>) => s.addCoins

const getTexturePreviewSource = (textureName: string): ImageSourcePropType | null => {
  if (textureName === 'corona_bottle' || textureName === 'beer_bottle') {
    return require('../../../assets/textures/characters/corona_bottle_1.png')
  }

  if (textureName === 'cartoon_sunrise') {
    return require('../../../assets/textures/themes/cartoon_sunrise.png')
  }

  return null
}

export function ShopOverlay({ visible, onClose }: Props) {
  const [items, setItems] = useState<ShopItem[]>([])
  const [ownedItemKeys, setOwnedItemKeys] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const activeTheme = useActiveTheme()
  const coins = useAppStore(selectCoins)
  const spendCoins = useAppStore(selectSpendCoins)
  const addCoins = useAppStore(selectAddCoins)
  const insets = useSafeAreaInsets()

  const toOwnedKey = (item: Pick<ShopItem, 'type' | 'textureName'>) => `${item.type}:${item.textureName}`

  const syncOwnedThemeToStore = (textureName: string) => {
    const action = (useAppStore.getState() as { addOwnedTheme?: (themeTextureName: string) => void }).addOwnedTheme
    if (typeof action === 'function') {
      action(textureName)
    }
  }

  const syncOwnedCharacterToStore = (textureName: string) => {
    const action = (useAppStore.getState() as { addOwnedSkin?: (skinTextureName: string) => void }).addOwnedSkin
    if (typeof action === 'function') {
      action(textureName)
    }
  }

  useEffect(() => {
    if (!visible) {
      return
    }

    const fetchShop = async () => {
      setLoading(true)
      setError(null)

      try {
        await ensureDefaultInventoryForPlayer()
        const shopItems = await getShopItems()
        const inventory = await getPlayerInventory()
        const ownedKeys = inventory.map((inventoryItem) => `${inventoryItem.type}:${inventoryItem.textureName}`)

        inventory
          .filter((inventoryItem) => inventoryItem.type === 'theme')
          .forEach((inventoryTheme) => syncOwnedThemeToStore(inventoryTheme.textureName))
        inventory
          .filter((inventoryItem) => inventoryItem.type === 'character')
          .forEach((inventoryCharacter) => syncOwnedCharacterToStore(inventoryCharacter.textureName))

        setItems(shopItems)
        setOwnedItemKeys(ownedKeys)
      } catch (err) {
        console.error('ShopOverlay: failed to load shop items', err)
        setError('Failed to load shop')
      } finally {
        setLoading(false)
      }
    }

    fetchShop()
  }, [visible])

  const handleBuy = async (item: ShopItem) => {
    const ownedKey = toOwnedKey(item)

    if (coins < item.price) {
      setFeedback(`You need ${item.price - coins} more coins to buy ${item.itemName}.`)
      return
    }

    if (ownedItemKeys.includes(ownedKey)) {
      setFeedback(`${item.itemName} is already owned.`)
      return
    }

    if (!spendCoins(item.price)) {
      setFeedback(`Not enough coins to buy ${item.itemName}.`)
      return
    }

    const savedItem = await addItemToInventory({
      itemName: item.itemName,
      textureName: item.textureName,
      type: item.type,
    })

    if (!savedItem) {
      useAppStore.getState().addCoins(item.price)
      setFeedback(`Could not buy ${item.itemName}. Check your connection and try again.`)
      return
    }

    setOwnedItemKeys((prev) => [...prev, ownedKey])
    if (item.type === 'theme' && isKnownTheme(item.textureName)) {
      syncOwnedThemeToStore(item.textureName)
    }
    if (item.type === 'character') {
      syncOwnedCharacterToStore(item.textureName)
    }
    setFeedback(`Bought ${item.itemName}!`)
  }

  const handleBuyCoins = (amount: number) => {
    addCoins(amount)
    setFeedback(`Added ${amount} coins.`)
  }

  if (!visible) return null

  const characters = items.filter((item) => item.type === 'character')
  const themes = items.filter((item) => item.type === 'theme')

  return (
    <View style={[styles.container, { backgroundColor: activeTheme.menuBackground }]}>
      <ThemeBackdrop scene={activeTheme.scene} />
      <View style={[styles.coinsBadge, { top: insets.top + 8, backgroundColor: activeTheme.badgeBackground, borderColor: activeTheme.badgeBorder }]}>
        <MaterialCommunityIcons name='cash-multiple' size={18} color='#FFD54F' />
        <Text style={[styles.coinsBadgeText, { color: activeTheme.titleColor, fontFamily: activeTheme.fontFamily }]}>{coins}</Text>
      </View>
      <View style={styles.titleRow}>
        <MaterialCommunityIcons name='storefront-outline' size={42} color='#FFA000' />
        <Text style={[styles.title, { color: activeTheme.titleColor, fontFamily: activeTheme.fontFamily }]}>Shop</Text>
      </View>

      {loading ? (
        <Text style={styles.infoText}>Loading shop...</Text>
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name='account-circle-outline' size={22} color={activeTheme.textColor} />
            <Text style={[styles.sectionTitle, { color: activeTheme.textColor, fontFamily: activeTheme.fontFamily }]}>Characters</Text>
          </View>
          {characters.length === 0 ? (
            <Text style={styles.infoText}>No characters available.</Text>
          ) : (
            characters.map((item) => {
              const owned = ownedItemKeys.includes(toOwnedKey(item))
              const previewSource = getTexturePreviewSource(item.textureName)
              return (
              <TouchableOpacity key={item.id} style={[styles.itemRow, { backgroundColor: activeTheme.cardBackground, borderColor: activeTheme.cardBorder, borderWidth: 1 }]} onPress={() => handleBuy(item)}>
                <View style={styles.itemHeader}>
                  <View style={styles.itemHeaderRow}>
                    {previewSource ? (
                      <Image source={previewSource} style={styles.previewImage} resizeMode='cover' />
                    ) : (
                      <View style={styles.previewPlaceholder} />
                    )}
                    <Text style={[styles.itemText, { color: activeTheme.textColor, fontFamily: activeTheme.fontFamily }]}>{item.itemName}</Text>
                  </View>
                  <View style={styles.priceRow}>
                    <MaterialCommunityIcons name='cash-multiple' size={16} color='#FFD54F' />
                    <Text style={[styles.priceText, { color: activeTheme.titleColor, fontFamily: activeTheme.fontFamily }]}>{item.price}</Text>
                  </View>
                </View>
                <Text style={[styles.subText, { color: activeTheme.mutedTextColor, fontFamily: activeTheme.fontFamily }]}>{item.textureName}</Text>
                <TouchableOpacity
                  style={[styles.buyButton, { backgroundColor: activeTheme.buttonBackground }, owned && styles.ownedButton]}
                  disabled={owned}
                  onPress={() => handleBuy(item)}
                >
                  <Text style={[styles.buyButtonText, { color: activeTheme.buttonTextColor, fontFamily: activeTheme.fontFamily }]}>{owned ? 'Owned' : 'Buy'}</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            )})
          )}

          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name='palette-outline' size={22} color={activeTheme.textColor} />
            <Text style={[styles.sectionTitle, { color: activeTheme.textColor, fontFamily: activeTheme.fontFamily }]}>Themes</Text>
          </View>
          {themes.length === 0 ? (
            <Text style={styles.infoText}>No themes available.</Text>
          ) : (
            themes.map((item) => {
              const owned = ownedItemKeys.includes(toOwnedKey(item))
              const unsupportedTheme = !isKnownTheme(item.textureName)
              const previewSource = getTexturePreviewSource(item.textureName)
              return (
              <TouchableOpacity key={item.id} style={[styles.itemRow, { backgroundColor: activeTheme.cardBackground, borderColor: activeTheme.cardBorder, borderWidth: 1 }]} onPress={() => handleBuy(item)}>
                <View style={styles.itemHeader}>
                  <View style={styles.itemHeaderRow}>
                    {previewSource ? (
                      <Image source={previewSource} style={styles.previewImage} resizeMode='cover' />
                    ) : (
                      <View style={styles.previewPlaceholder} />
                    )}
                    <Text style={[styles.itemText, { color: activeTheme.textColor, fontFamily: activeTheme.fontFamily }]}>{item.itemName}</Text>
                  </View>
                  <View style={styles.priceRow}>
                    <MaterialCommunityIcons name='cash-multiple' size={16} color='#FFD54F' />
                    <Text style={[styles.priceText, { color: activeTheme.titleColor, fontFamily: activeTheme.fontFamily }]}>{item.price}</Text>
                  </View>
                </View>
                <Text style={[styles.subText, { color: activeTheme.mutedTextColor, fontFamily: activeTheme.fontFamily }]}>{item.textureName}</Text>
                {unsupportedTheme && (
                  <Text style={[styles.warningText, { color: activeTheme.titleColor, fontFamily: activeTheme.fontFamily }]}>Theme key not configured in app yet.</Text>
                )}
                <TouchableOpacity
                  style={[styles.buyButton, { backgroundColor: activeTheme.buttonBackground }, owned && styles.ownedButton]}
                  disabled={owned}
                  onPress={() => handleBuy(item)}
                >
                  <Text style={[styles.buyButtonText, { color: activeTheme.buttonTextColor, fontFamily: activeTheme.fontFamily }]}>{owned ? 'Owned' : 'Buy'}</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            )})
          )}

          <View style={[styles.coinPackCard, { backgroundColor: activeTheme.cardBackground, borderColor: activeTheme.cardBorder }]}>
            <Text style={[styles.coinPackTitle, { color: activeTheme.textColor, fontFamily: activeTheme.fontFamily }]}>Coin Packs (Free)</Text>
            <Text style={[styles.coinPackSubtitle, { color: activeTheme.mutedTextColor, fontFamily: activeTheme.fontFamily }]}>Pick a pack to add coins instantly.</Text>
            <View style={styles.coinPackRow}>
              <TouchableOpacity
                style={[styles.coinPackButton, { backgroundColor: activeTheme.buttonBackground }]}
                onPress={() => handleBuyCoins(100)}
              >
                <Text style={[styles.coinPackButtonText, { color: activeTheme.buttonTextColor, fontFamily: activeTheme.fontFamily }]}>Get 100</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.coinPackButton, { backgroundColor: activeTheme.buttonBackground }]}
                onPress={() => handleBuyCoins(500)}
              >
                <Text style={[styles.coinPackButtonText, { color: activeTheme.buttonTextColor, fontFamily: activeTheme.fontFamily }]}>Get 500</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.coinPackButton, { backgroundColor: activeTheme.buttonBackground }]}
                onPress={() => handleBuyCoins(1000)}
              >
                <Text style={[styles.coinPackButtonText, { color: activeTheme.buttonTextColor, fontFamily: activeTheme.fontFamily }]}>Get 1000</Text>
              </TouchableOpacity>
            </View>
          </View>
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
  coinPackCard: {
    width: '100%',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 12,
    marginBottom: 8,
  },
  coinPackTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
  },
  coinPackSubtitle: {
    fontSize: 12,
    marginBottom: 10,
    textAlign: 'center',
  },
  coinPackRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'center',
    gap: 8,
  },
  coinPackButton: {
    width: '31%',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coinPackButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  coinsBadge: {
    position: 'absolute',
    top: 18,
    right: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(26, 26, 46, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255, 213, 79, 0.5)',
  },
  coinsBadgeText: {
    color: '#FFD54F',
    fontSize: 18,
    fontWeight: '800',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
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
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  itemHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
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
  itemText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  priceText: {
    color: '#FFA000',
    fontSize: 18,
    fontWeight: 'bold',
  },
  subText: {
    color: '#CCCCCC',
    fontSize: 14,
    marginBottom: 8,
  },
  buyButton: {
    backgroundColor: '#FFA000',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 4,
    alignItems: 'center',
  },
  buyButtonText: {
    color: '#1a1a2e',
    fontSize: 14,
    fontWeight: 'bold',
  },
  ownedButton: {
    backgroundColor: '#6b7280',
  },
  warningText: {
    color: '#ffcf70',
    fontSize: 12,
    marginBottom: 6,
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