import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { LogOut, Settings, Award, Receipt, UserPlus, UserMinus, Clock, Check, X, FileText } from 'lucide-react'
import { api } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { User } from '../types'
import IOUCard from '../components/IOUCard'
import CreateIOUModal from '../components/CreateIOUModal'

export default function ProfilePage() {
  const { userId } = useParams()
  const { user, signOut } = useAuth()
  const queryClient = useQueryClient()
  const [showSettings, setShowSettings] = useState(false)
  const [showCreateIOU, setShowCreateIOU] = useState(false)

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
  })

  // Fetch friendship status when viewing another user's profile
  const { data: friendshipData } = useQuery({
    queryKey: ['friendship-status', userId],
    queryFn: () => api.getFriendshipStatus(userId!),
    enabled: !isOwnProfile && !!userId,
  })

  const updateMutation = useMutation({
    mutationFn: (visibility: 'private' | 'friends_only' | 'public') =>
      api.updateProfile({ street_cred_visibility: visibility }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] })
    },
  })

  const feedVisibleMutation = useMutation({
    mutationFn: (feed_visible: boolean) => api.updateProfile({ feed_visible }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] })
    },
  })

  // Friend action mutations
  const sendRequestMutation = useMutation({
    mutationFn: () => api.sendFriendRequest(userId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friendship-status', userId] })
    },
  })

  const cancelRequestMutation = useMutation({
    mutationFn: (friendshipId: string) => api.removeFriend(friendshipId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friendship-status', userId] })
    },
  })

  const acceptRequestMutation = useMutation({
    mutationFn: (friendshipId: string) => api.acceptFriendRequest(friendshipId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friendship-status', userId] })
      queryClient.invalidateQueries({ queryKey: ['friends'] })
    },
  })

  const declineRequestMutation = useMutation({
    mutationFn: (friendshipId: string) => api.declineFriendRequest(friendshipId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friendship-status', userId] })
    },
  })

  const removeFriendMutation = useMutation({
    mutationFn: (friendshipId: string) => api.removeFriend(friendshipId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friendship-status', userId] })
      queryClient.invalidateQueries({ queryKey: ['friends'] })
    },
  })

  const profile = profileData?.data
  const streetCred = streetCredData?.data
  const ious = iousData?.data || []
  const friendshipStatus = friendshipData?.data?.status || 'none'
  const friendshipId = friendshipData?.data?.friendship_id

  const completedIOUs = ious.filter(
    (iou) => iou.status === 'paid' || iou.status === 'cancelled'
  )

  // IOUs with this specific friend (when viewing another profile)
  const iousWithFriend = !isOwnProfile && userId
    ? ious.filter(
        (iou) => iou.debtor_id === userId || iou.creditor_id === userId
      )
    : []

  const activeIOUsWithFriend = iousWithFriend.filter(
    (iou) => iou.status === 'active' || iou.status === 'pending' || iou.status === 'payment_pending'
  )

  const youOweCount = activeIOUsWithFriend.filter(
    (iou) => iou.debtor_id === user?.id
  ).length

  const owesYouCount = activeIOUsWithFriend.filter(
    (iou) => iou.creditor_id === user?.id
  ).length

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
          {isOwnProfile ? (
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
          ) : (
            /* Friend action buttons for viewing other profiles */
            <div className="flex flex-col gap-2">
              {friendshipStatus === 'none' && (
                <button
                  onClick={() => sendRequestMutation.mutate()}
                  disabled={sendRequestMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 bg-white text-primary rounded-lg font-medium hover:bg-white/90 transition-colors disabled:opacity-50"
                >
                  <UserPlus className="w-4 h-4" />
                  {sendRequestMutation.isPending ? 'Sending...' : 'Add Friend'}
                </button>
              )}

              {friendshipStatus === 'request_sent' && (
                <button
                  onClick={() => friendshipId && cancelRequestMutation.mutate(friendshipId)}
                  disabled={cancelRequestMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 bg-white/20 text-white rounded-lg font-medium hover:bg-white/30 transition-colors disabled:opacity-50"
                >
                  <Clock className="w-4 h-4" />
                  {cancelRequestMutation.isPending ? 'Canceling...' : 'Request Sent (Cancel)'}
                </button>
              )}

              {friendshipStatus === 'request_received' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => friendshipId && acceptRequestMutation.mutate(friendshipId)}
                    disabled={acceptRequestMutation.isPending}
                    className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-colors disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                    {acceptRequestMutation.isPending ? '...' : 'Accept'}
                  </button>
                  <button
                    onClick={() => friendshipId && declineRequestMutation.mutate(friendshipId)}
                    disabled={declineRequestMutation.isPending}
                    className="flex items-center gap-2 px-4 py-2 bg-white/20 text-white rounded-lg font-medium hover:bg-white/30 transition-colors disabled:opacity-50"
                  >
                    <X className="w-4 h-4" />
                    {declineRequestMutation.isPending ? '...' : 'Decline'}
                  </button>
                </div>
              )}

              {friendshipStatus === 'friends' && (
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => setShowCreateIOU(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-white text-primary rounded-lg font-medium hover:bg-white/90 transition-colors"
                  >
                    <FileText className="w-4 h-4" />
                    Create IOU
                  </button>
                  <button
                    onClick={() => friendshipId && removeFriendMutation.mutate(friendshipId)}
                    disabled={removeFriendMutation.isPending}
                    className="flex items-center gap-2 px-4 py-2 bg-white/20 text-white rounded-lg font-medium hover:bg-red-500/80 transition-colors disabled:opacity-50"
                  >
                    <UserMinus className="w-4 h-4" />
                    {removeFriendMutation.isPending ? 'Removing...' : 'Remove Friend'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && isOwnProfile && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-6">
          <h2 className="text-lg font-semibold text-gray-800">Settings</h2>

          {/* Street Cred Visibility */}
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

          {/* Feed Visibility Toggle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Feed Visibility
            </label>
            <p className="text-xs text-gray-500 mb-3">
              When enabled, you can see your friends' public activity and your public activity will appear in their feeds.
            </p>
            <button
              onClick={() => feedVisibleMutation.mutate(!profile?.feed_visible)}
              disabled={feedVisibleMutation.isPending}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                profile?.feed_visible ? 'bg-highlight' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  profile?.feed_visible ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span className="ml-3 text-sm text-gray-600">
              {profile?.feed_visible ? 'Enabled' : 'Disabled'}
            </span>
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

      {/* IOUs with this friend */}
      {!isOwnProfile && friendshipStatus === 'friends' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-highlight/10 rounded-lg">
              <FileText className="w-5 h-5 text-highlight" />
            </div>
            <h2 className="text-lg font-semibold text-gray-800">
              IOUs with {profile?.username}
            </h2>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-red-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-danger">{youOweCount}</p>
              <p className="text-xs text-gray-600">You owe</p>
            </div>
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-success">{owesYouCount}</p>
              <p className="text-xs text-gray-600">Owes you</p>
            </div>
          </div>

          {/* IOU List */}
          {iousWithFriend.length > 0 ? (
            <div className="space-y-3">
              {iousWithFriend.slice(0, 10).map((iou) => (
                <IOUCard key={iou.id} iou={iou} />
              ))}
              {iousWithFriend.length > 10 && (
                <p className="text-center text-sm text-gray-500">
                  And {iousWithFriend.length - 10} more...
                </p>
              )}
            </div>
          ) : (
            <p className="text-center text-gray-500 py-4">
              No IOUs with {profile?.username} yet
            </p>
          )}
        </div>
      )}

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

      {/* Create IOU Modal - opens from profile with friend pre-selected */}
      {showCreateIOU && profile && (
        <CreateIOUModal
          onClose={() => setShowCreateIOU(false)}
          preselectedFriend={profile as User}
        />
      )}
    </div>
  )
}
