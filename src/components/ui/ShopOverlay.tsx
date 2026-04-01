import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native'
import { getShopItems, ShopItem } from '../../services/firebase/shop'

type Props = {
  visible: boolean
  onClose: () => void
}

export function ShopOverlay({ visible, onClose }: Props) {
  const [items, setItems] = useState<ShopItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!visible) {
      return
    }

    const fetchShop = async () => {
      setLoading(true)
      setError(null)

      try {
        const shopItems = await getShopItems()
        setItems(shopItems)
      } catch (err) {
        console.error('ShopOverlay: failed to load shop items', err)
        setError('Failed to load shop')
      } finally {
        setLoading(false)
      }
    }

    fetchShop()
  }, [visible])

  if (!visible) return null

  const characters = items.filter((item) => item.type === 'character')
  const themes = items.filter((item) => item.type === 'theme')

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🛒 Shop</Text>

      {loading ? (
        <Text style={styles.infoText}>Loading shop...</Text>
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : (
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
          <Text style={styles.sectionTitle}>Characters</Text>
          {characters.length === 0 ? (
            <Text style={styles.infoText}>No characters available.</Text>
          ) : (
            characters.map((item) => (
              <TouchableOpacity key={item.id} style={styles.itemRow} onPress={() => console.log('Buy character:', item.itemName)}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemText}>{item.itemName}</Text>
                  <Text style={styles.priceText}>${item.price}</Text>
                </View>
                <Text style={styles.subText}>{item.textureName}</Text>
                <TouchableOpacity style={styles.buyButton}>
                  <Text style={styles.buyButtonText}>Buy</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            ))
          )}

          <Text style={styles.sectionTitle}>Themes</Text>
          {themes.length === 0 ? (
            <Text style={styles.infoText}>No themes available.</Text>
          ) : (
            themes.map((item) => (
              <TouchableOpacity key={item.id} style={styles.itemRow} onPress={() => console.log('Buy theme:', item.itemName)}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemText}>{item.itemName}</Text>
                  <Text style={styles.priceText}>${item.price}</Text>
                </View>
                <Text style={styles.subText}>{item.textureName}</Text>
                <TouchableOpacity style={styles.buyButton}>
                  <Text style={styles.buyButtonText}>Buy</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}

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
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFA000',
    textAlign: 'center',
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
    marginTop: 12,
    marginBottom: 6,
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