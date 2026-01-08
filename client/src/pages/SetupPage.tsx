import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { api } from '../services/api'

export default function SetupPage() {
  const { user, refreshUser } = useAuth()
  const navigate = useNavigate()
  const [alias, setAlias] = useState('')
  const [error, setError] = useState<string | null>(null)

  const updateMutation = useMutation({
    mutationFn: (username: string) => api.updateProfile({ username }),
    onSuccess: async (response) => {
      if (response.success) {
        await refreshUser()
        navigate('/')
      } else {
        setError(response.error?.message || 'Failed to set alias')
      }
    },
    onError: () => {
      setError('Failed to set alias. It may already be taken.')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const trimmedAlias = alias.trim().toLowerCase()

    if (!trimmedAlias) {
      setError('Please enter an alias')
      return
    }

    if (trimmedAlias.length < 3) {
      setError('Alias must be at least 3 characters')
      return
    }

    if (trimmedAlias.length > 20) {
      setError('Alias must be 20 characters or less')
      return
    }

    if (!/^[a-z0-9_]+$/.test(trimmedAlias)) {
      setError('Alias can only contain letters, numbers, and underscores')
      return
    }

    updateMutation.mutate(trimmedAlias)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark p-4">
      <div className="w-full max-w-md">
        <div className="bg-card rounded-xl shadow-xl overflow-hidden">
          {/* Header */}
          <div className="bg-accent px-8 py-10 text-center">
            <h1 className="text-4xl font-display text-dark tracking-wide mb-2">
              Welcome to Anything Minutes!
            </h1>
            <p className="text-dark/70 text-sm">
              Let's set up your profile
            </p>
          </div>

          {/* Content */}
          <form onSubmit={handleSubmit} className="p-8">
            <div className="mb-6">
              <label className="block text-sm font-medium text-light mb-2">
                Choose your alias
              </label>
              <p className="text-xs text-light/50 mb-3">
                This is how friends will find and recognize you. Choose something memorable!
              </p>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-light/40">@</span>
                <input
                  type="text"
                  value={alias}
                  onChange={(e) => setAlias(e.target.value.toLowerCase())}
                  placeholder="yourname"
                  className="w-full pl-8 pr-4 py-3 bg-dark border border-light/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50 text-lg text-light placeholder-light/40"
                  autoFocus
                />
              </div>
              <p className="text-xs text-light/40 mt-2">
                3-20 characters. Letters, numbers, and underscores only.
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-danger/10 border border-danger/20 text-danger rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={updateMutation.isPending || !alias.trim()}
              className="w-full bg-accent text-dark py-3 rounded-lg font-medium hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {updateMutation.isPending ? 'Setting up...' : 'Continue'}
            </button>

            {user?.email && (
              <p className="mt-4 text-center text-xs text-light/40">
                Signed in as {user.email}
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}
