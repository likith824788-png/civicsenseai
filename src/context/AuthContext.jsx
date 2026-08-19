import { createContext, useContext, useEffect, useState } from 'react'
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from 'firebase/auth'
import { auth } from '../lib/firebase'

const AuthContext = createContext({})

export function checkIsAdmin(user, claimsAdmin = false) {
  if (claimsAdmin) return true
  if (!user || !user.email) return false
  const email = user.email.toLowerCase()
  const ADMIN_EMAILS = [
    '9924051040@klu.ac.in',
    'admin@civicsense.ai',
    'admin@gmail.com',
    'authority@civicsense.ai',
  ]
  return (
    ADMIN_EMAILS.includes(email) ||
    email.startsWith('admin') ||
    email.includes('admin') ||
    email.includes('+admin@')
  )
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Listen for auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser)

        let claimsAdmin = false
        try {
          const tokenResult = await firebaseUser.getIdTokenResult()
          claimsAdmin = tokenResult.claims.admin === true
        } catch (err) {
          console.warn('Could not fetch custom claims:', err.message)
        }

        // Allow access if user has server claims OR matches admin email criteria
        const adminStatus = checkIsAdmin(firebaseUser, claimsAdmin)
        setIsAdmin(adminStatus)
      } else {
        setUser(null)
        setIsAdmin(false)
      }

      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const signUp = async (email, password) => {
    const result = await createUserWithEmailAndPassword(auth, email, password)
    return result
  }

  const signIn = async (email, password) => {
    const result = await signInWithEmailAndPassword(auth, email, password)
    return result
  }

  const signOut = async () => {
    await firebaseSignOut(auth)
  }

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
