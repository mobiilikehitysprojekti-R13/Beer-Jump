import {
  collection,
  getDocs,
  doc,
  getDoc,
  addDoc,
  CollectionReference,
  DocumentData,
} from 'firebase/firestore'
import { db } from './config'
import { getUser } from './auth'
import { log } from '../../utils/logger'

type ItemBase = {
  textureName: string
  itemName: string
  type: 'theme' | 'character'
}

export type InventoryItem = ItemBase & {
  id: string
}

const PLAYER_INVENTORY_COLLECTION = 'playerInventory'
const PLAYER_INVENTORY_SUBCOLLECTION = 'items'

const DEFAULT_CHARACTER: ItemBase = {
  textureName: 'default_character',
  itemName: 'Default Character',
  type: 'character',
}

const DEFAULT_THEME: ItemBase = {
  textureName: 'default_theme',
  itemName: 'Default Theme',
  type: 'theme',
}

const DEFAULT_ITEMS: ItemBase[] = [DEFAULT_CHARACTER, DEFAULT_THEME]

const getUserUid = (): string | null => {
  const user = getUser()
  return user ? user.uid : null
}

export const getPlayerInventory = async (uid?: string): Promise<InventoryItem[]> => {
  const userUid = uid || getUserUid()
  if (!userUid) {
    log.error('firebase', 'getPlayerInventory: missing uid and user not signed-in')
    return []
  }

  log.info('firebase', 'getPlayerInventory: start', { uid: userUid })

  try {
    const inventoryDocRef = doc(db, PLAYER_INVENTORY_COLLECTION, userUid)
    const inventoryDoc = await getDoc(inventoryDocRef)

    if (!inventoryDoc.exists()) {
      log.info('firebase', 'getPlayerInventory: inventory document does not exist (expected for new user)', { uid: userUid })
      // no parent document required for subcollection reads, proceed to read items
    }

    const itemsCollection = collection(
      db,
      PLAYER_INVENTORY_COLLECTION,
      userUid,
      PLAYER_INVENTORY_SUBCOLLECTION,
    ) as CollectionReference<DocumentData>

    const itemsSnapshot = await getDocs(itemsCollection)
    const items: InventoryItem[] = itemsSnapshot.docs.map((itemDoc) => {
      const data = itemDoc.data() as ItemBase
      return {
        id: itemDoc.id,
        textureName: data.textureName,
        itemName: data.itemName,
        type: data.type,
      }
    })

    log.info('firebase', 'getPlayerInventory: success', {
      uid: userUid,
      count: items.length,
    })

    return items
  } catch (error) {
    // Network error or offline - log but return empty gracefully
    log.warn('firebase', 'getPlayerInventory: network error or offline', { error: String(error), uid: userUid })
    return []
  }
}

export const addItemToInventory = async (
  item: ItemBase,
  uid?: string,
): Promise<InventoryItem | null> => {
  const userUid = uid || getUserUid()
  if (!userUid) {
    log.error('firebase', 'addItemToInventory: missing uid and user not signed-in')
    return null
  }

  log.info('firebase', 'addItemToInventory: start', { uid: userUid, item })

  try {
    const itemsCollection = collection(
      db,
      PLAYER_INVENTORY_COLLECTION,
      userUid,
      PLAYER_INVENTORY_SUBCOLLECTION,
    ) as CollectionReference<DocumentData>

    const addedDoc = await addDoc(itemsCollection, {
      textureName: item.textureName,
      itemName: item.itemName,
      type: item.type,
    })

    const savedItem: InventoryItem = {
      id: addedDoc.id,
      ...item,
    }

    log.info('firebase', 'addItemToInventory: success', { uid: userUid, item: savedItem })
    return savedItem
  } catch (error) {
    // Network error or offline - log but don't crash
    log.warn('firebase', 'addItemToInventory: network error or offline', { error: String(error), uid: userUid })
    return null
  }
}

export const ensureDefaultInventoryForPlayer = async (uid?: string): Promise<void> => {
  const userUid = uid || getUserUid()
  if (!userUid) {
    log.error('firebase', 'ensureDefaultInventoryForPlayer: missing uid and user not signed-in')
    return
  }

  log.info('firebase', 'ensureDefaultInventoryForPlayer: start', { uid: userUid })

  try {
    const itemsCollection = collection(
      db,
      PLAYER_INVENTORY_COLLECTION,
      userUid,
      PLAYER_INVENTORY_SUBCOLLECTION,
    ) as CollectionReference<DocumentData>

    const itemsSnapshot = await getDocs(itemsCollection)

    if (itemsSnapshot.empty) {
      log.info('firebase', 'ensureDefaultInventoryForPlayer: empty inventory; creating defaults', { uid: userUid })
      await Promise.all(DEFAULT_ITEMS.map((item) => addItemToInventory(item, userUid)))
      return
    }

    const existingNames = itemsSnapshot.docs.map((doc) => (doc.data() as ItemBase).itemName)
    const requiredAdds: ItemBase[] = []

    DEFAULT_ITEMS.forEach((defaultItem) => {
      if (!existingNames.includes(defaultItem.itemName)) {
        requiredAdds.push(defaultItem)
      }
    })

    if (requiredAdds.length > 0) {
      log.info('firebase', 'ensureDefaultInventoryForPlayer: adding missing defaults', {
        uid: userUid,
        missing: requiredAdds.map((item) => item.itemName),
      })
      await Promise.all(requiredAdds.map((item) => addItemToInventory(item, userUid)))
    } else {
      log.info('firebase', 'ensureDefaultInventoryForPlayer: default items already present', { uid: userUid })
    }
  } catch (error) {
    // Network error or offline - log but don't crash
    log.warn('firebase', 'ensureDefaultInventoryForPlayer: network error or offline', { error: String(error), uid: userUid })
  }
}
