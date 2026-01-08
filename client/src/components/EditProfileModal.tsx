import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Check, Loader2, AlertCircle } from 'lucide-react'
import { api } from '../services/api'
import { useAuth } from '../context/AuthContext'

interface EditProfileModalProps {
  onClose: () => void
}

export default function EditProfileModal({ onClose }: EditProfileModalProps) {
  const { user, refreshUser } = useAuth()
  const queryClient = useQueryClient()

  const [firstName, setFirstName] = useState(user?.first_name || '')
  const [username, setUsername] = useState(user?.username || '')
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const [usernameStatus, setUsernameStatus] = useState<{
    checking: boolean
    available: boolean | null
    error?: string
    suggestions?: string[]
  }>({ checking: false, available: null })

  // Check if username can be changed (30-day limit)
  const canChangeUsername = !user?.username_changed_at ||
    new Date(user.username_changed_at).getTime() < Date.now() - 30 * 24 * 60 * 60 * 1000

  const getNextChangeDate = () => {
    if (!user?.username_changed_at) return null
    const nextDate = new Date(user.username_changed_at)
    nextDate.setDate(nextDate.getDate() + 30)
    return nextDate
  }

  // Debounced username check
  useEffect(() => {
    // Don't check if username hasn't changed
    if (!username || username === user?.username || username.length < 3) {
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
  }, [username, user?.username])

  const updateMutation = useMutation({
    mutationFn: (updates: { first_name?: string; username?: string }) =>
      api.updateProfile(updates),
    onSuccess: async () => {
      await refreshUser()
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      setSuccessMessage('Profile updated successfully!')
      setTimeout(() => onClose(), 1500)
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
      } else if (errorData?.code === 'USERNAME_CHANGE_LIMIT') {
        setError(errorData.message)
      } else {
        setError(errorData?.message || 'Failed to update profile')
      }
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const updates: { first_name?: string; username?: string } = {}

    // Check first name
    const trimmedFirstName = firstName.trim()
    if (trimmedFirstName !== user?.first_name) {
      if (!trimmedFirstName) {
        setError('First name is required')
        return
      }
      if (!/^[\p{L}]+$/u.test(trimmedFirstName)) {
        setError('First name can only contain letters')
        return
      }
      updates.first_name = trimmedFirstName
    }

    // Check username
    const trimmedUsername = username.trim().toLowerCase()
    if (trimmedUsername !== user?.username) {
      if (!canChangeUsername) {
        setError(`You can change your username again on ${getNextChangeDate()?.toLocaleDateString()}`)
        return
      }
      if (trimmedUsername.length < 3) {
        setError('Username must be at least 3 characters')
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
      updates.username = trimmedUsername
    }

    if (Object.keys(updates).length === 0) {
      setError('No changes to save')
      return
    }

    updateMutation.mutate(updates)
  }

  const handleUsernameChange = (value: string) => {
    const cleaned = value.toLowerCase().replace(/[^a-z0-9_.]/g, '')
    setUsername(cleaned)
  }

  const selectSuggestion = (suggestion: string) => {
    setUsername(suggestion)
  }

  const hasChanges = firstName.trim() !== user?.first_name || username !== user?.username

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-light/10">
          <h2 className="text-lg font-semibold text-light">Edit Profile</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-dark rounded-lg transition-colors text-light/60 hover:text-light"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-5">
          {error && (
            <div className="p-3 bg-danger/20 border border-danger/30 text-danger rounded-lg text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-success/20 border border-success/30 text-success rounded-lg text-sm flex items-center gap-2">
              <Check className="w-4 h-4 flex-shrink-0" />
              {successMessage}
            </div>
          )}

          {/* First Name */}
          <div>
            <label className="block text-sm font-medium text-light mb-2">
              First Name
            </label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Enter your first name"
              maxLength={20}
              className="w-full px-4 py-3 bg-dark border border-light/20 rounded-lg text-light placeholder-light/40 focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
            <p className="text-xs text-light/50 mt-1">
              This is how your friends see you
            </p>
          </div>

          {/* Username */}
          <div>
            <label className="block text-sm font-medium text-light mb-2">
              Username
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-light/40">@</span>
              <input
                type="text"
                value={username}
                onChange={(e) => handleUsernameChange(e.target.value)}
                placeholder="username"
                maxLength={20}
                disabled={!canChangeUsername}
                className="w-full pl-8 pr-10 py-3 bg-dark border border-light/20 rounded-lg text-light placeholder-light/40 focus:outline-none focus:ring-2 focus:ring-accent/50 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              {/* Status indicator */}
              {username !== user?.username && (
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
              )}
            </div>

            {/* Username feedback */}
            {!canChangeUsername && (
              <p className="text-xs text-warning mt-1">
                You can change your username again on {getNextChangeDate()?.toLocaleDateString()}
              </p>
            )}
            {canChangeUsername && usernameStatus.error && (
              <p className="text-xs text-danger mt-1">{usernameStatus.error}</p>
            )}
            {canChangeUsername && !usernameStatus.error && (
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

          {/* Email (read-only for now) */}
          <div>
            <label className="block text-sm font-medium text-light mb-2">
              Email
            </label>
            <input
              type="email"
              value={user?.email || ''}
              disabled
              className="w-full px-4 py-3 bg-dark border border-light/20 rounded-lg text-light/50 cursor-not-allowed"
            />
            <p className="text-xs text-light/50 mt-1">
              Email editing coming soon
            </p>
          </div>

          {/* Phone (read-only for now) */}
          <div>
            <label className="block text-sm font-medium text-light mb-2">
              Phone
            </label>
            <input
              type="tel"
              value={user?.phone || 'Not set'}
              disabled
              className="w-full px-4 py-3 bg-dark border border-light/20 rounded-lg text-light/50 cursor-not-allowed"
            />
            <p className="text-xs text-light/50 mt-1">
              Phone editing coming soon
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-dark text-light rounded-lg font-medium hover:bg-dark/70 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateMutation.isPending || !hasChanges || (username !== user?.username && usernameStatus.available === false)}
              className="flex-1 flex items-center justify-center gap-2 bg-accent text-dark py-3 rounded-lg font-medium hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {updateMutation.isPending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
