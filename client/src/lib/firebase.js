import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'demo-api-key',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'civicsense-demo.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'civicsense-demo',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'civicsense-demo.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '100000000000',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:100000000000:web:demo',
}

export const isFirebaseConfigured = !!(import.meta.env.VITE_FIREBASE_API_KEY && import.meta.env.VITE_FIREBASE_PROJECT_ID)

if (!isFirebaseConfigured) {
  console.warn(
    '⚠️ Missing Firebase env vars. Create a .env file in /client with:\n' +
    'VITE_FIREBASE_API_KEY=your-api-key\n' +
    'VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com\n' +
    'VITE_FIREBASE_PROJECT_ID=your-project-id\n' +
    'VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com\n' +
    'VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id\n' +
    'VITE_FIREBASE_APP_ID=your-app-id'
  )
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)
