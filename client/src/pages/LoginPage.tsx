import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Phone, ArrowLeft } from 'lucide-react'

export default function LoginPage() {
  const { firebaseUser, loading, signInWithGoogle, sendPhoneOTP, verifyPhoneOTP } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [isSigningIn, setIsSigningIn] = useState(false)

  // Phone auth state
  const [showPhoneInput, setShowPhoneInput] = useState(false)
  const [phoneNumber, setPhoneNumber] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [otp, setOtp] = useState('')
  const [isSendingOTP, setIsSendingOTP] = useState(false)
  const [isVerifyingOTP, setIsVerifyingOTP] = useState(false)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
      </div>
    )
  }

  if (firebaseUser) {
    return <Navigate to="/" replace />
  }

  const handleGoogleSignIn = async () => {
    setError(null)
    setIsSigningIn(true)
    try {
      await signInWithGoogle()
    } catch (err) {
      setError('Failed to sign in with Google. Please try again.')
      console.error(err)
    } finally {
      setIsSigningIn(false)
    }
  }

  const formatPhoneNumber = (value: string) => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, '')
    // Format as +1 (XXX) XXX-XXXX for US numbers
    if (digits.length <= 1) return digits
    if (digits.length <= 4) return `+${digits.slice(0, 1)} (${digits.slice(1)}`
    if (digits.length <= 7) return `+${digits.slice(0, 1)} (${digits.slice(1, 4)}) ${digits.slice(4)}`
    return `+${digits.slice(0, 1)} (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 11)}`
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value)
    setPhoneNumber(formatted)
  }

  const getCleanPhoneNumber = () => {
    return '+' + phoneNumber.replace(/\D/g, '')
  }

  const handleSendOTP = async () => {
    setError(null)
    setIsSendingOTP(true)
    try {
      await sendPhoneOTP(getCleanPhoneNumber(), 'send-otp-button')
      setOtpSent(true)
    } catch (err: any) {
      if (err?.code === 'auth/invalid-phone-number') {
        setError('Invalid phone number. Please enter a valid number.')
      } else if (err?.code === 'auth/too-many-requests') {
        setError('Too many attempts. Please try again later.')
      } else {
        setError('Failed to send verification code. Please try again.')
      }
      console.error(err)
    } finally {
      setIsSendingOTP(false)
    }
  }

  const handleVerifyOTP = async () => {
    setError(null)
    setIsVerifyingOTP(true)
    try {
      await verifyPhoneOTP(otp)
    } catch (err: any) {
      if (err?.code === 'auth/invalid-verification-code') {
        setError('Invalid code. Please check and try again.')
      } else {
        setError('Verification failed. Please try again.')
      }
      console.error(err)
    } finally {
      setIsVerifyingOTP(false)
    }
  }

  const resetPhoneAuth = () => {
    setShowPhoneInput(false)
    setPhoneNumber('')
    setOtpSent(false)
    setOtp('')
    setError(null)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark p-4">
      <div className="w-full max-w-md">
        <div className="bg-card rounded-xl shadow-xl overflow-hidden">
          {/* Header */}
          <div className="bg-dark px-8 py-12 text-center">
            <h1 className="text-5xl font-display text-light tracking-wide mb-2">
              Anything Minutes
            </h1>
            <p className="text-light/60 text-sm">
              Track bets and IOUs with friends
            </p>
          </div>

          {/* Content */}
          <div className="p-8">
            <h2 className="text-xl font-semibold text-light mb-6 text-center">
              Welcome Back
            </h2>

            {error && (
              <div className="mb-4 p-3 bg-danger/20 border border-danger/30 text-danger rounded-lg text-sm">
                {error}
              </div>
            )}

            {!showPhoneInput ? (
              // Main login options
              <div className="space-y-3">
                {/* Google Sign In */}
                <button
                  onClick={handleGoogleSignIn}
                  disabled={isSigningIn}
                  className="w-full flex items-center justify-center gap-3 bg-light text-dark rounded-lg px-4 py-3 font-medium hover:bg-light/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSigningIn ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-dark"></div>
                  ) : (
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                  )}
                  Continue with Google
                </button>

                {/* Divider */}
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-light/20"></div>
                  <span className="text-light/40 text-sm">or</span>
                  <div className="flex-1 h-px bg-light/20"></div>
                </div>

                {/* Phone Sign In */}
                <button
                  onClick={() => setShowPhoneInput(true)}
                  className="w-full flex items-center justify-center gap-3 bg-card text-light border border-light/20 rounded-lg px-4 py-3 font-medium hover:bg-card/80 transition-colors"
                >
                  <Phone className="w-5 h-5" />
                  Continue with Phone
                </button>
              </div>
            ) : (
              // Phone auth flow
              <div className="space-y-4">
                {/* Back button */}
                <button
                  onClick={resetPhoneAuth}
                  className="flex items-center gap-1 text-light/60 hover:text-light text-sm transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to login options
                </button>

                {!otpSent ? (
                  // Phone number input
                  <>
                    <div>
                      <label className="block text-sm text-light/70 mb-2">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        value={phoneNumber}
                        onChange={handlePhoneChange}
                        placeholder="+1 (555) 123-4567"
                        className="w-full px-4 py-3 bg-dark border border-light/20 rounded-lg text-light placeholder-light/40 focus:outline-none focus:ring-2 focus:ring-accent/50"
                      />
                      <p className="mt-2 text-xs text-light/50">
                        We'll send you a verification code via SMS
                      </p>
                    </div>
                    <button
                      id="send-otp-button"
                      onClick={handleSendOTP}
                      disabled={isSendingOTP || phoneNumber.replace(/\D/g, '').length < 10}
                      className="w-full flex items-center justify-center gap-2 bg-accent text-dark rounded-lg px-4 py-3 font-medium hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSendingOTP ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-dark"></div>
                      ) : (
                        'Send Code'
                      )}
                    </button>
                  </>
                ) : (
                  // OTP verification
                  <>
                    <div>
                      <label className="block text-sm text-light/70 mb-2">
                        Verification Code
                      </label>
                      <input
                        type="text"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="Enter 6-digit code"
                        maxLength={6}
                        className="w-full px-4 py-3 bg-dark border border-light/20 rounded-lg text-light text-center text-2xl tracking-widest placeholder-light/40 focus:outline-none focus:ring-2 focus:ring-accent/50"
                      />
                      <p className="mt-2 text-xs text-light/50">
                        Code sent to {phoneNumber}
                      </p>
                    </div>
                    <button
                      onClick={handleVerifyOTP}
                      disabled={isVerifyingOTP || otp.length !== 6}
                      className="w-full flex items-center justify-center gap-2 bg-accent text-dark rounded-lg px-4 py-3 font-medium hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isVerifyingOTP ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-dark"></div>
                      ) : (
                        'Verify'
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setOtpSent(false)
                        setOtp('')
                      }}
                      className="w-full text-sm text-light/60 hover:text-light transition-colors"
                    >
                      Didn't receive code? Try again
                    </button>
                  </>
                )}
              </div>
            )}

            <p className="mt-6 text-center text-xs text-light/50">
              By signing in, you agree to our Terms of Service and Privacy Policy
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
