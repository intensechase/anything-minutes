import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  ConfirmationResult,
} from 'firebase/auth'
import { auth, googleProvider, setupRecaptcha, sendOTP, clearRecaptcha } from '../services/firebase'
import { User } from '../types'
import { api } from '../services/api'

interface AuthContextType {
  firebaseUser: FirebaseUser | null
  user: User | null
  loading: boolean
  signInWithGoogle: () => Promise<void>
  sendPhoneOTP: (phoneNumber: string, buttonId: string) => Promise<void>
  verifyPhoneOTP: (otp: string) => Promise<void>
  signOut: () => Promise<void>
  getIdToken: () => Promise<string | null>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null)

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

  const sendPhoneOTP = async (phoneNumber: string, buttonId: string) => {
    try {
      clearRecaptcha()
      const recaptcha = setupRecaptcha(buttonId)
      const result = await sendOTP(phoneNumber, recaptcha)
      setConfirmationResult(result)
    } catch (error) {
      console.error('Phone OTP error:', error)
      clearRecaptcha()
      throw error
    }
  }

  const verifyPhoneOTP = async (otp: string) => {
    if (!confirmationResult) {
      throw new Error('No confirmation result. Please request OTP first.')
    }
    try {
      const result = await confirmationResult.confirm(otp)
      const token = await result.user.getIdToken()

      const response = await api.createOrGetUser(token)
      if (response.success && response.data) {
        setUser(response.data)
      }
      setConfirmationResult(null)
      clearRecaptcha()
    } catch (error) {
      console.error('OTP verification error:', error)
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

  const refreshUser = async () => {
    if (firebaseUser) {
      try {
        const response = await api.getProfile()
        if (response.success && response.data) {
          setUser(response.data)
        }
      } catch (error) {
        console.error('Failed to refresh user:', error)
      }
    }
  }

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        user,
        loading,
        signInWithGoogle,
        sendPhoneOTP,
        verifyPhoneOTP,
        signOut,
        getIdToken,
        refreshUser,
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
