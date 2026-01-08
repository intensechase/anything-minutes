import { useState, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { User, Check, X, Loader2 } from 'lucide-react'
import { api } from '../services/api'
import { useAuth } from '../context/AuthContext'

interface CompleteProfileModalProps {
  onComplete: () => void
}

export default function CompleteProfileModal({ onComplete }: CompleteProfileModalProps) {
  const { user, signOut, refreshUser } = useAuth()
  const [firstName, setFirstName] = useState('')
  const [username, setUsername] = useState('')
  const [usernameStatus, setUsernameStatus] = useState<{
    checking: boolean
    available: boolean | null
    error?: string
    suggestions?: string[]
  }>({ checking: false, available: null })
  const [error, setError] = useState<string | null>(null)

  // Pre-fill username from existing if available
  useEffect(() => {
    if (user?.username && !user.username.startsWith('user_')) {
      setUsername(user.username)
    }
  }, [user])

  // Debounced username check
  useEffect(() => {
    if (!username || username.length < 3) {
      setUsernameStatus({ checking: false, available: null })
      return
    }

    const timer = setTimeout(async () => {
      setUsernameStatus({ checking: true, available: null })
      try {
        const response = await api.checkUsername(username)
        if (response.success && response.data) {
          setUsernameStatus({
            checking: false,
            available: response.data.available,
            error: response.data.error,
            suggestions: response.data.suggestions
          })
        }
      } catch {
        setUsernameStatus({ checking: false, available: null })
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [username])

  const completeMutation = useMutation({
    mutationFn: () => api.completeProfile({ first_name: firstName, username }),
    onSuccess: async () => {
      await refreshUser()
      onComplete()
    },
    onError: (err: any) => {
      const errorData = err?.response?.data?.error
      if (errorData?.code === 'USERNAME_TAKEN') {
        setUsernameStatus({
          checking: false,
          available: false,
          error: errorData.message,
          suggestions: errorData.suggestions
        })
      } else {
        setError(errorData?.message || 'Failed to complete profile')
      }
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validate first name
    if (!firstName.trim()) {
      setError('First name is required')
      return
    }
    if (!/^[\p{L}]+$/u.test(firstName.trim())) {
      setError('First name can only contain letters')
      return
    }

    // Validate username
    if (!username.trim() || username.length < 3) {
      setError('Username must be at least 3 characters')
      return
    }
    if (usernameStatus.available === false) {
      setError('Please choose an available username')
      return
    }

    completeMutation.mutate()
  }

  const handleUsernameChange = (value: string) => {
    // Convert to lowercase and remove invalid characters
    const cleaned = value.toLowerCase().replace(/[^a-z0-9_.]/g, '')
    setUsername(cleaned)
  }

  const selectSuggestion = (suggestion: string) => {
    setUsername(suggestion)
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-dark px-6 py-8 text-center">
          <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8 text-accent" />
          </div>
          <h2 className="text-2xl font-bold text-light">Complete Your Profile</h2>
          <p className="text-light/60 text-sm mt-2">
            Just a couple more things before you get started
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-danger/20 border border-danger/30 text-danger rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* First Name */}
          <div>
            <label className="block text-sm font-medium text-light mb-2">
              First Name <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Enter your first name"
              maxLength={20}
              className="w-full px-4 py-3 bg-dark border border-light/20 rounded-lg text-light placeholder-light/40 focus:outline-none focus:ring-2 focus:ring-accent/50"
              autoFocus
            />
            <p className="text-xs text-light/50 mt-1">
              This is how your friends will see you
            </p>
          </div>

          {/* Username */}
          <div>
            <label className="block text-sm font-medium text-light mb-2">
              Username <span className="text-danger">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-light/40">@</span>
              <input
                type="text"
                value={username}
                onChange={(e) => handleUsernameChange(e.target.value)}
                placeholder="choose_a_username"
                maxLength={20}
                className="w-full pl-8 pr-10 py-3 bg-dark border border-light/20 rounded-lg text-light placeholder-light/40 focus:outline-none focus:ring-2 focus:ring-accent/50"
              />
              {/* Status indicator */}
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {usernameStatus.checking && (
                  <Loader2 className="w-5 h-5 text-light/40 animate-spin" />
                )}
                {!usernameStatus.checking && usernameStatus.available === true && (
                  <Check className="w-5 h-5 text-success" />
                )}
                {!usernameStatus.checking && usernameStatus.available === false && (
                  <X className="w-5 h-5 text-danger" />
                )}
              </div>
            </div>

            {/* Username feedback */}
            {usernameStatus.error && (
              <p className="text-xs text-danger mt-1">{usernameStatus.error}</p>
            )}
            {!usernameStatus.error && (
              <p className="text-xs text-light/50 mt-1">
                3-20 characters, lowercase letters, numbers, periods, underscores
              </p>
            )}

            {/* Suggestions */}
            {usernameStatus.suggestions && usernameStatus.suggestions.length > 0 && (
              <div className="mt-2">
                <p className="text-xs text-light/50 mb-1">Try one of these:</p>
                <div className="flex flex-wrap gap-2">
                  {usernameStatus.suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => selectSuggestion(suggestion)}
                      className="px-2 py-1 text-xs bg-accent/20 text-accent rounded hover:bg-accent/30 transition-colors"
                    >
                      @{suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={completeMutation.isPending || !firstName.trim() || !username.trim() || usernameStatus.available === false}
            className="w-full flex items-center justify-center gap-2 bg-accent text-dark py-3 rounded-lg font-medium hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {completeMutation.isPending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              'Continue'
            )}
          </button>

          {/* Sign out option */}
          <button
            type="button"
            onClick={signOut}
            className="w-full text-sm text-light/50 hover:text-light transition-colors"
          >
            Sign out and use a different account
          </button>
        </form>
      </div>
    </div>
  )
}
