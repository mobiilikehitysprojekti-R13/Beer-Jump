import { collection, getDocs, query } from 'firebase/firestore'
import { db } from './config'
import { log } from '../../utils/logger'

export type ShopItem = {
  id: string
  textureName: string
  itemName: string
  type: 'theme' | 'character'
  price: number
}

const SHOP_COLLECTION = 'shopItems'

export const getShopItems = async (): Promise<ShopItem[]> => {
  log.info('firebase', 'getShopItems: start')

  try {
    const shopQuery = query(collection(db, SHOP_COLLECTION))
    const snapshot = await getDocs(shopQuery)

    const items: ShopItem[] = snapshot.docs.map((docSnapshot) => {
      const data = docSnapshot.data() as Omit<ShopItem, 'id'>
      return {
        id: docSnapshot.id,
        textureName: data.textureName,
        itemName: data.itemName,
        type: data.type,
        price: data.price,
      }
    })

    log.info('firebase', 'getShopItems: success', { count: items.length })
    return items
  } catch (error) {
    // Network error or offline - log but return empty gracefully
    log.warn('firebase', 'getShopItems: network error or offline', { error: String(error) })
    return []
  }
}
