import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native'
import { getPlayerInventory, InventoryItem } from '../../services/firebase/inventory'

type Props = {
  visible: boolean
  onClose: () => void
}

export function InventoryOverlay({ visible, onClose }: Props) {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!visible) {
      return
    }

    const fetchInventory = async () => {
      setLoading(true)
      setError(null)

      try {
        const playerInventory = await getPlayerInventory()
        setItems(playerInventory)
      } catch (err) {
        setError('Failed to load inventory')
      } finally {
        setLoading(false)
      }
    }

    fetchInventory()
  }, [visible])

  if (!visible) return null

  const characters = items.filter((item) => item.type === 'character')
  const themes = items.filter((item) => item.type === 'theme')

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🎒 Inventory</Text>

      {loading ? (
        <Text style={styles.infoText}>Loading inventory...</Text>
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : (
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
          <Text style={styles.sectionTitle}>Characters</Text>
          {characters.length === 0 ? (
            <Text style={styles.infoText}>No characters owned yet.</Text>
          ) : (
            characters.map((item) => (
              <View key={item.id} style={styles.itemRow}>
                <Text style={styles.itemText}>{item.itemName}</Text>
                <Text style={styles.subText}>{item.textureName}</Text>
              </View>
            ))
          )}

          <Text style={styles.sectionTitle}>Themes</Text>
          {themes.length === 0 ? (
            <Text style={styles.infoText}>No themes owned yet.</Text>
          ) : (
            themes.map((item) => (
              <View key={item.id} style={styles.itemRow}>
                <Text style={styles.itemText}>{item.itemName}</Text>
                <Text style={styles.subText}>{item.textureName}</Text>
              </View>
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
  itemText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  subText: {
    color: '#CCCCCC',
    fontSize: 14,
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