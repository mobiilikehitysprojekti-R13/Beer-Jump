import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
    apiKey: "AIzaSyBqryERpm0KSFTb112bZZBsYTMFpDAx540",
    authDomain: "beer-jump.firebaseapp.com",
    projectId: "beer-jump",
    storageBucket: "beer-jump.firebasestorage.app",
    messagingSenderId: "785455957709",
    appId: "1:785455957709:web:4a2d334c38e9c2f1ba0b84",
    measurementId: "G-4N77XCNYNJ"
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)