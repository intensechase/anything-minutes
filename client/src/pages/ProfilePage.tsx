import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { LogOut, Settings, Award, Receipt } from 'lucide-react'
import { api } from '../services/api'
import { useAuth } from '../context/AuthContext'
import IOUCard from '../components/IOUCard'

export default function ProfilePage() {
  const { userId } = useParams()
  const { user, signOut } = useAuth()
  const queryClient = useQueryClient()
  const [showSettings, setShowSettings] = useState(false)

  const isOwnProfile = !userId || userId === user?.id

  const { data: profileData } = useQuery({
    queryKey: ['profile', userId || user?.id],
    queryFn: () =>
      isOwnProfile ? api.getProfile() : api.getUserProfile(userId!),
    enabled: !!user,
  })

  const { data: streetCredData } = useQuery({
    queryKey: ['street-cred', userId || user?.id],
    queryFn: () => api.getStreetCred(userId || user!.id),
    enabled: !!user,
  })

  const { data: iousData } = useQuery({
    queryKey: ['ious'],
    queryFn: () => api.getIOUs(),
    enabled: isOwnProfile,
  })

  const updateMutation = useMutation({
    mutationFn: (visibility: 'private' | 'friends_only' | 'public') =>
      api.updateProfile({ street_cred_visibility: visibility }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] })
    },
  })

  const profile = profileData?.data
  const streetCred = streetCredData?.data
  const ious = iousData?.data || []

  const completedIOUs = ious.filter(
    (iou) => iou.status === 'paid' || iou.status === 'cancelled'
  )

  const credPercentage = streetCred
    ? streetCred.total_debts > 0
      ? Math.round((streetCred.debts_paid / streetCred.total_debts) * 100)
      : 100
    : 0

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <div className="bg-gradient-to-r from-primary to-secondary rounded-xl p-6 text-white">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center text-3xl font-bold">
              {profile?.username?.[0]?.toUpperCase() || '?'}
            </div>
            <div>
              <h1 className="text-2xl font-bold font-serif">
                {profile?.username || 'Loading...'}
              </h1>
              {profile?.email && (
                <p className="text-white/70 text-sm">{profile.email}</p>
              )}
              <p className="text-white/60 text-xs mt-1">
                Member since{' '}
                {profile?.created_at
                  ? new Date(profile.created_at).toLocaleDateString('en-US', {
                      month: 'long',
                      year: 'numeric',
                    })
                  : '...'}
              </p>
            </div>
          </div>
          {isOwnProfile && (
            <div className="flex gap-2">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
              >
                <Settings className="w-5 h-5" />
              </button>
              <button
                onClick={signOut}
                className="p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && isOwnProfile && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Settings</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Street Cred Visibility
            </label>
            <div className="flex gap-2">
              {(['private', 'friends_only', 'public'] as const).map((option) => (
                <button
                  key={option}
                  onClick={() => updateMutation.mutate(option)}
                  disabled={updateMutation.isPending}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    profile?.street_cred_visibility === option
                      ? 'bg-highlight text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {option === 'friends_only' ? 'Friends Only' : option.charAt(0).toUpperCase() + option.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Street Cred */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-highlight/10 rounded-lg">
            <Award className="w-6 h-6 text-highlight" />
          </div>
          <h2 className="text-lg font-semibold text-gray-800">Street Cred</h2>
        </div>

        {streetCred ? (
          <div className="space-y-4">
            {/* Score Display */}
            <div className="flex items-end gap-2">
              <span className="text-4xl font-bold text-gray-800">
                {streetCred.debts_paid}
              </span>
              <span className="text-2xl text-gray-400">/</span>
              <span className="text-2xl text-gray-500">
                {streetCred.total_debts}
              </span>
              <span className="text-gray-500 mb-1">debts paid</span>
            </div>

            {/* Progress Bar */}
            <div className="relative h-4 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="absolute left-0 top-0 h-full bg-gradient-to-r from-highlight to-success rounded-full transition-all duration-500"
                style={{ width: `${credPercentage}%` }}
              />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 pt-2">
              <div className="text-center">
                <p className="text-2xl font-bold text-success">
                  {streetCred.debts_paid}
                </p>
                <p className="text-xs text-gray-500">Paid</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-warning">
                  {streetCred.outstanding_debts}
                </p>
                <p className="text-xs text-gray-500">Outstanding</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-highlight">
                  {credPercentage}%
                </p>
                <p className="text-xs text-gray-500">Rate</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-4 text-gray-500">
            {isOwnProfile
              ? 'Complete IOUs to build your street cred!'
              : 'Street cred is private'}
          </div>
        )}
      </div>

      {/* Payment History */}
      {isOwnProfile && completedIOUs.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-success/10 rounded-lg">
              <Receipt className="w-5 h-5 text-success" />
            </div>
            <h2 className="text-lg font-semibold text-gray-800">
              Payment History
            </h2>
          </div>
          <div className="space-y-3">
            {completedIOUs.slice(0, 10).map((iou) => (
              <IOUCard key={iou.id} iou={iou} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
