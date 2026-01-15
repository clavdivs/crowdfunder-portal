import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app"
import { getAuth, Auth } from "firebase/auth"
import { getFirestore, Firestore } from "firebase/firestore"

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
}

// Initialize Firebase (prevent multiple initializations)
// Uses a getter pattern to defer initialization and allow build to pass
let _app: FirebaseApp | null = null
let _auth: Auth | null = null
let _db: Firestore | null = null
let _initialized = false
let _initError: Error | null = null

function initFirebase() {
  if (_initialized) return
  _initialized = true

  try {
    _app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp()
    _auth = getAuth(_app)
    _db = getFirestore(_app)
  } catch (e) {
    _initError = e instanceof Error ? e : new Error("Firebase init failed")
    console.warn("Firebase initialization failed:", _initError.message)
  }
}

// Getter that initializes on first access (client-side only)
export const db: Firestore = new Proxy({} as Firestore, {
  get(_, prop) {
    if (typeof window !== "undefined") {
      initFirebase()
    }
    if (!_db) {
      throw new Error("Firebase Firestore not initialized")
    }
    return (_db as unknown as Record<string | symbol, unknown>)[prop]
  },
})

export const auth: Auth = new Proxy({} as Auth, {
  get(_, prop) {
    if (typeof window !== "undefined") {
      initFirebase()
    }
    if (!_auth) {
      throw new Error("Firebase Auth not initialized")
    }
    return (_auth as unknown as Record<string | symbol, unknown>)[prop]
  },
})

export default null
