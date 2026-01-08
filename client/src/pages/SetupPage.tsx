import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { Check, X, Loader2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { api } from '../services/api'

export default function SetupPage() {
  const { user, refreshUser, signOut } = useAuth()
  const navigate = useNavigate()
  const [firstName, setFirstName] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [usernameStatus, setUsernameStatus] = useState<{
    checking: boolean
    available: boolean | null
    error?: string
    suggestions?: string[]
  }>({ checking: false, available: null })

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
    onSuccess: async (response) => {
      if (response.success) {
        await refreshUser()
        navigate('/')
      } else {
        setError(response.error?.message || 'Failed to complete setup')
      }
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
        setError(errorData?.message || 'Failed to complete setup')
      }
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validate first name
    const trimmedFirstName = firstName.trim()
    if (!trimmedFirstName) {
      setError('Please enter your first name')
      return
    }
    if (!/^[\p{L}]+$/u.test(trimmedFirstName)) {
      setError('First name can only contain letters')
      return
    }

    // Validate username
    const trimmedUsername = username.trim().toLowerCase()
    if (!trimmedUsername) {
      setError('Please choose a username')
      return
    }
    if (trimmedUsername.length < 3) {
      setError('Username must be at least 3 characters')
      return
    }
    if (trimmedUsername.length > 20) {
      setError('Username must be 20 characters or less')
      return
    }
    if (!/^[a-z0-9_.]+$/.test(trimmedUsername)) {
      setError('Username can only contain letters, numbers, periods, and underscores')
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
    <div className="min-h-screen flex items-center justify-center bg-dark p-4">
      <div className="w-full max-w-md">
        <div className="bg-card rounded-xl shadow-xl overflow-hidden">
          {/* Header */}
          <div className="bg-accent px-8 py-10 text-center">
            <h1 className="text-4xl font-display text-dark tracking-wide mb-2">
              Welcome!
            </h1>
            <p className="text-dark/70 text-sm">
              Let's set up your profile
            </p>
          </div>

          {/* Content */}
          <form onSubmit={handleSubmit} className="p-8 space-y-6">
            {/* First Name */}
            <div>
              <label className="block text-sm font-medium text-light mb-2">
                What's your first name?
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Enter your first name"
                maxLength={20}
                className="w-full px-4 py-3 bg-dark border border-light/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50 text-lg text-light placeholder-light/40"
                autoFocus
              />
              <p className="text-xs text-light/40 mt-2">
                This is how your friends will see you
              </p>
            </div>

            {/* Username */}
            <div>
              <label className="block text-sm font-medium text-light mb-2">
                Choose your username
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-light/40">@</span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => handleUsernameChange(e.target.value)}
                  placeholder="yourname"
                  maxLength={20}
                  className="w-full pl-8 pr-10 py-3 bg-dark border border-light/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50 text-lg text-light placeholder-light/40"
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
                <p className="text-xs text-danger mt-2">{usernameStatus.error}</p>
              )}
              {!usernameStatus.error && (
                <p className="text-xs text-light/40 mt-2">
                  3-20 characters. Letters, numbers, periods, and underscores.
                </p>
              )}

              {/* Suggestions */}
              {usernameStatus.suggestions && usernameStatus.suggestions.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs text-light/50 mb-2">Try one of these:</p>
                  <div className="flex flex-wrap gap-2">
                    {usernameStatus.suggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => selectSuggestion(suggestion)}
                        className="px-3 py-1 text-sm bg-accent/20 text-accent rounded-full hover:bg-accent/30 transition-colors"
                      >
                        @{suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div className="p-3 bg-danger/10 border border-danger/20 text-danger rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={completeMutation.isPending || !firstName.trim() || !username.trim() || usernameStatus.available === false}
              className="w-full bg-accent text-dark py-3 rounded-lg font-medium hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {completeMutation.isPending ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Setting up...
                </>
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

            {user?.email && (
              <p className="text-center text-xs text-light/40">
                Signed in as {user.email}
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}
