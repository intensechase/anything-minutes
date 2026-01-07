import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth'
import { auth, googleProvider } from '../services/firebase'
import { User } from '../types'
import { api } from '../services/api'

interface AuthContextType {
  firebaseUser: FirebaseUser | null
  user: User | null
  loading: boolean
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  getIdToken: () => Promise<string | null>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser)
      if (fbUser) {
        try {
          const response = await api.getProfile()
          if (response.success && response.data) {
            setUser(response.data)
          }
        } catch (error) {
          console.error('Failed to fetch user profile:', error)
        }
      } else {
        setUser(null)
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const signInWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider)
      const token = await result.user.getIdToken()

      const response = await api.createOrGetUser(token)
      if (response.success && response.data) {
        setUser(response.data)
      }
    } catch (error) {
      console.error('Google sign-in error:', error)
      throw error
    }
  }

  const signOut = async () => {
    await firebaseSignOut(auth)
    setUser(null)
  }

  const getIdToken = async () => {
    if (firebaseUser) {
      return firebaseUser.getIdToken()
    }
    return null
  }

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        user,
        loading,
        signInWithGoogle,
        signOut,
        getIdToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
