import { db } from './config'
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'

export const getDocument = async (collection: string, id: string) => {
  const ref = doc(db, collection, id)
  const snap = await getDoc(ref)
  return snap.exists() ? snap.data() : null
}

export const setDocument = async (
  collection: string,
  id: string,
    data: any
) => {
  const ref = doc(db, collection, id)
  return setDoc(ref, data)
}

export const updateDocument = async (
  collection: string,
  id: string,
    data: any
) => {
  const ref = doc(db, collection, id)
  return updateDoc(ref, data)
}