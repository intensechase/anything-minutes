import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { LogOut, Settings, Award, Receipt, UserPlus, UserMinus, Clock, Check, X, FileText, Sun, Moon, Edit, Shield, ChevronRight, Eye, EyeOff } from 'lucide-react'
import { api } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { User } from '../types'
import IOUCard from '../components/IOUCard'
import CreateIOUModal from '../components/CreateIOUModal'
import EditProfileModal from '../components/EditProfileModal'
import BlockedUsersModal from '../components/BlockedUsersModal'

export default function ProfilePage() {
  const { userId } = useParams()
  const { user, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const queryClient = useQueryClient()
  const [showSettings, setShowSettings] = useState(false)
  const [showCreateIOU, setShowCreateIOU] = useState(false)
  const [showEditProfile, setShowEditProfile] = useState(false)
  const [showBlockedUsers, setShowBlockedUsers] = useState(false)
  const [showEmail, setShowEmail] = useState(false)

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

  const settingsMutation = useMutation({
    mutationFn: (updates: Partial<User>) => api.updateProfile(updates),
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

  const blockUserMutation = useMutation({
    mutationFn: (blockUserId: string) => api.blockUser(blockUserId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friendship-status', userId] })
      queryClient.invalidateQueries({ queryKey: ['friends'] })
      queryClient.invalidateQueries({ queryKey: ['blocked-users'] })
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

  // Mask email: show first char, asterisks, then domain
  const maskEmail = (email: string) => {
    const [localPart, domain] = email.split('@')
    if (!domain) return email
    const maskedLocal = localPart[0] + '*'.repeat(Math.min(localPart.length - 1, 4))
    return `${maskedLocal}@${domain}`
  }

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <div className="bg-card rounded-xl p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-accent/30 flex items-center justify-center text-3xl font-bold text-accent">
              {(profile?.first_name?.[0] || profile?.username?.[0])?.toUpperCase() || '?'}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-light">
                {profile?.first_name || profile?.username || 'Loading...'}
              </h1>
              <p className="text-light/50 text-sm">@{profile?.username}</p>
              {isOwnProfile && profile?.email && (
                <button
                  onClick={() => setShowEmail(!showEmail)}
                  className="flex items-center gap-1 text-light/40 text-xs mt-1 hover:text-light/60 transition-colors"
                >
                  {showEmail ? profile.email : maskEmail(profile.email)}
                  {showEmail ? (
                    <EyeOff className="w-3 h-3" />
                  ) : (
                    <Eye className="w-3 h-3" />
                  )}
                </button>
              )}
              {isOwnProfile && profile?.phone && (
                <p className="text-light/40 text-xs mt-1">{profile.phone}</p>
              )}
              <p className="text-light/40 text-xs mt-1">
                Member since{' '}
                {profile?.created_at
                  ? new Date(profile.created_at).toLocaleDateString('en-US', {
                      month: 'long',
                      year: 'numeric',
                    })
                  : '...'}
              </p>
              {isOwnProfile && profile?.venmo_handle && (
                <p className="text-accent text-xs mt-1">@{profile.venmo_handle}</p>
              )}
            </div>
          </div>
          {isOwnProfile ? (
            <div className="flex gap-2">
              <button
                onClick={() => setShowEditProfile(true)}
                className="p-2 bg-dark rounded-lg hover:bg-dark/70 transition-colors text-light"
                title="Edit Profile"
              >
                <Edit className="w-5 h-5" />
              </button>
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 bg-dark rounded-lg hover:bg-dark/70 transition-colors text-light"
                title="Settings"
              >
                <Settings className="w-5 h-5" />
              </button>
              <button
                onClick={signOut}
                className="p-2 bg-dark rounded-lg hover:bg-dark/70 transition-colors text-light"
                title="Sign Out"
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
                  className="flex items-center gap-2 px-4 py-2 bg-accent text-dark rounded-lg font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
                >
                  <UserPlus className="w-4 h-4" />
                  {sendRequestMutation.isPending ? 'Sending...' : 'Add Friend'}
                </button>
              )}

              {friendshipStatus === 'request_sent' && (
                <button
                  onClick={() => friendshipId && cancelRequestMutation.mutate(friendshipId)}
                  disabled={cancelRequestMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 bg-dark text-light rounded-lg font-medium hover:bg-dark/70 transition-colors disabled:opacity-50"
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
                    className="flex items-center gap-2 px-4 py-2 bg-success text-white rounded-lg font-medium hover:bg-success/90 transition-colors disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                    {acceptRequestMutation.isPending ? '...' : 'Accept'}
                  </button>
                  <button
                    onClick={() => friendshipId && declineRequestMutation.mutate(friendshipId)}
                    disabled={declineRequestMutation.isPending}
                    className="flex items-center gap-2 px-4 py-2 bg-dark text-light rounded-lg font-medium hover:bg-dark/70 transition-colors disabled:opacity-50"
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
                    className="flex items-center gap-2 px-4 py-2 bg-accent text-dark rounded-lg font-medium hover:bg-accent/90 transition-colors"
                  >
                    <FileText className="w-4 h-4" />
                    Create IOU
                  </button>
                  <button
                    onClick={() => friendshipId && removeFriendMutation.mutate(friendshipId)}
                    disabled={removeFriendMutation.isPending}
                    className="flex items-center gap-2 px-4 py-2 bg-dark text-light rounded-lg font-medium hover:bg-danger/80 transition-colors disabled:opacity-50"
                  >
                    <UserMinus className="w-4 h-4" />
                    {removeFriendMutation.isPending ? 'Removing...' : 'Remove Friend'}
                  </button>
                </div>
              )}

              {/* Block User - always available */}
              <button
                onClick={() => {
                  if (confirm('Are you sure you want to block this user? They will be removed from your friends and won\'t be able to contact you.')) {
                    blockUserMutation.mutate(userId!)
                  }
                }}
                disabled={blockUserMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-dark text-danger/70 rounded-lg font-medium hover:bg-danger/20 transition-colors disabled:opacity-50 text-sm"
              >
                <Shield className="w-4 h-4" />
                {blockUserMutation.isPending ? 'Blocking...' : 'Block User'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Street Cred */}
      <div className="bg-card rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-accent/10 rounded-lg">
            <Award className="w-6 h-6 text-accent" />
          </div>
          <h2 className="text-lg font-semibold text-light">Street Cred</h2>
        </div>

        {streetCred ? (
          <div className="space-y-4">
            {/* Score Display */}
            <div className="flex items-end gap-2">
              <span className="text-4xl font-bold text-accent">
                {streetCred.debts_paid}
              </span>
              <span className="text-2xl text-light/40">/</span>
              <span className="text-2xl text-light/60">
                {streetCred.total_debts}
              </span>
              <span className="text-light/50 mb-1">debts paid</span>
            </div>

            {/* Progress Bar */}
            <div className="relative h-4 bg-dark rounded-full overflow-hidden">
              <div
                className="absolute left-0 top-0 h-full bg-gradient-to-r from-accent to-success rounded-full transition-all duration-500"
                style={{ width: `${credPercentage}%` }}
              />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 pt-2">
              <div className="text-center">
                <p className="text-2xl font-bold text-success">
                  {streetCred.debts_paid}
                </p>
                <p className="text-xs text-light/50">Paid</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-warning">
                  {streetCred.outstanding_debts}
                </p>
                <p className="text-xs text-light/50">Outstanding</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-accent">
                  {credPercentage}%
                </p>
                <p className="text-xs text-light/50">Rate</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-4 text-light/50">
            {isOwnProfile
              ? 'Complete IOUs to build your street cred!'
              : 'Street cred is private'}
          </div>
        )}
      </div>

      {/* Settings Panel */}
      {showSettings && isOwnProfile && (
        <div className="bg-card rounded-xl p-4 space-y-6">
          <h2 className="text-lg font-semibold text-light">Settings</h2>

          {/* Venmo Handle */}
          <div>
            <label className="block text-sm font-medium text-light mb-2">
              Venmo Handle
            </label>
            <p className="text-xs text-light/50 mb-2">
              Your friends can use this to pay you back easily.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="@your-venmo"
                defaultValue={profile?.venmo_handle || ''}
                className="flex-1 bg-dark border border-light/20 rounded-lg px-3 py-2 text-sm text-light placeholder:text-light/40 focus:outline-none focus:border-accent"
                onBlur={(e) => {
                  const value = e.target.value.trim().replace(/^@/, '')
                  if (value !== (profile?.venmo_handle || '')) {
                    settingsMutation.mutate({ venmo_handle: value })
                  }
                }}
              />
            </div>
          </div>

          {/* Privacy Settings Section */}
          <div className="border-t border-light/10 pt-4">
            <h3 className="text-sm font-semibold text-light/70 mb-4 uppercase tracking-wide">Privacy</h3>

            {/* Street Cred Visibility */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-light mb-2">
                Street Cred Visibility
              </label>
              <div className="flex flex-wrap gap-2">
                {(['private', 'friends_only', 'public'] as const).map((option) => (
                  <button
                    key={option}
                    onClick={() => updateMutation.mutate(option)}
                    disabled={updateMutation.isPending}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      profile?.street_cred_visibility === option
                        ? 'bg-accent text-dark'
                        : 'bg-dark text-light/70 hover:bg-dark/70'
                    }`}
                  >
                    {option === 'friends_only' ? 'Friends Only' : option.charAt(0).toUpperCase() + option.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Profile Visibility */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-light mb-2">
                Profile Visibility
              </label>
              <p className="text-xs text-light/50 mb-2">
                Who can view your full profile.
              </p>
              <div className="flex gap-2">
                {(['everyone', 'friends_only'] as const).map((option) => (
                  <button
                    key={option}
                    onClick={() => settingsMutation.mutate({ profile_visibility: option })}
                    disabled={settingsMutation.isPending}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      profile?.profile_visibility === option
                        ? 'bg-accent text-dark'
                        : 'bg-dark text-light/70 hover:bg-dark/70'
                    }`}
                  >
                    {option === 'friends_only' ? 'Friends Only' : 'Everyone'}
                  </button>
                ))}
              </div>
            </div>

            {/* Friend Request Setting */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-light mb-2">
                Who Can Send Friend Requests
              </label>
              <div className="flex flex-wrap gap-2">
                {(['everyone', 'friends_of_friends', 'no_one'] as const).map((option) => (
                  <button
                    key={option}
                    onClick={() => settingsMutation.mutate({ friend_request_setting: option })}
                    disabled={settingsMutation.isPending}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      profile?.friend_request_setting === option
                        ? 'bg-accent text-dark'
                        : 'bg-dark text-light/70 hover:bg-dark/70'
                    }`}
                  >
                    {option === 'friends_of_friends' ? 'Friends of Friends' : option === 'no_one' ? 'No One' : 'Everyone'}
                  </button>
                ))}
              </div>
            </div>

            {/* Hide from Search */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-light mb-2">
                Hide from Search
              </label>
              <p className="text-xs text-light/50 mb-2">
                When enabled, others won't find you when searching.
              </p>
              <button
                onClick={() => settingsMutation.mutate({ hide_from_search: !profile?.hide_from_search })}
                disabled={settingsMutation.isPending}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  profile?.hide_from_search ? 'bg-accent' : 'bg-dark'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-light transition-transform ${
                    profile?.hide_from_search ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
              <span className="ml-3 text-sm text-light/70">
                {profile?.hide_from_search ? 'Hidden' : 'Visible'}
              </span>
            </div>

            {/* Feed Visibility Toggle */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-light mb-2">
                Feed Visibility
              </label>
              <p className="text-xs text-light/50 mb-2">
                When enabled, you can see your friends' public activity and your public activity will appear in their feeds.
              </p>
              <button
                onClick={() => feedVisibleMutation.mutate(!profile?.feed_visible)}
                disabled={feedVisibleMutation.isPending}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  profile?.feed_visible ? 'bg-accent' : 'bg-dark'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-light transition-transform ${
                    profile?.feed_visible ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
              <span className="ml-3 text-sm text-light/70">
                {profile?.feed_visible ? 'Enabled' : 'Disabled'}
              </span>
            </div>

            {/* Blocked Users */}
            <button
              onClick={() => setShowBlockedUsers(true)}
              className="w-full flex items-center justify-between px-4 py-3 bg-dark rounded-lg hover:bg-dark/70 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-light/70" />
                <span className="text-sm text-light">Blocked Users</span>
              </div>
              <ChevronRight className="w-5 h-5 text-light/50" />
            </button>
          </div>

          {/* Preferences Section */}
          <div className="border-t border-light/10 pt-4">
            <h3 className="text-sm font-semibold text-light/70 mb-4 uppercase tracking-wide">Preferences</h3>

            {/* Default IOU Visibility */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-light mb-2">
                Default IOU Visibility
              </label>
              <p className="text-xs text-light/50 mb-2">
                Default visibility when creating new IOUs.
              </p>
              <div className="flex gap-2">
                {(['private', 'public'] as const).map((option) => (
                  <button
                    key={option}
                    onClick={() => settingsMutation.mutate({ default_iou_visibility: option })}
                    disabled={settingsMutation.isPending}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      profile?.default_iou_visibility === option
                        ? 'bg-accent text-dark'
                        : 'bg-dark text-light/70 hover:bg-dark/70'
                    }`}
                  >
                    {option.charAt(0).toUpperCase() + option.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Theme Toggle */}
            <div>
              <label className="block text-sm font-medium text-light mb-2">
                Theme
              </label>
              <button
                onClick={toggleTheme}
                className="flex items-center gap-3 px-4 py-2 bg-dark rounded-lg hover:bg-dark/70 transition-colors"
              >
                {theme === 'dark' ? (
                  <>
                    <Moon className="w-5 h-5 text-accent" />
                    <span className="text-sm text-light">Dark Mode</span>
                  </>
                ) : (
                  <>
                    <Sun className="w-5 h-5 text-warning" />
                    <span className="text-sm text-light">Light Mode</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IOUs with this friend */}
      {!isOwnProfile && friendshipStatus === 'friends' && (
        <div className="bg-card rounded-xl p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-accent/10 rounded-lg">
              <FileText className="w-5 h-5 text-accent" />
            </div>
            <h2 className="text-lg font-semibold text-light">
              IOUs with {profile?.first_name || profile?.username}
            </h2>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-danger/10 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-danger">{youOweCount}</p>
              <p className="text-xs text-light/50">You owe</p>
            </div>
            <div className="bg-success/10 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-success">{owesYouCount}</p>
              <p className="text-xs text-light/50">Owes you</p>
            </div>
          </div>

          {/* IOU List */}
          {iousWithFriend.length > 0 ? (
            <div className="space-y-3">
              {iousWithFriend.slice(0, 10).map((iou) => (
                <IOUCard key={iou.id} iou={iou} />
              ))}
              {iousWithFriend.length > 10 && (
                <p className="text-center text-sm text-light/50">
                  And {iousWithFriend.length - 10} more...
                </p>
              )}
            </div>
          ) : (
            <p className="text-center text-light/50 py-4">
              No IOUs with {profile?.first_name || profile?.username} yet
            </p>
          )}
        </div>
      )}

      {/* Payment History */}
      {isOwnProfile && completedIOUs.length > 0 && (
        <div className="bg-card rounded-xl p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-success/10 rounded-lg">
              <Receipt className="w-5 h-5 text-success" />
            </div>
            <h2 className="text-lg font-semibold text-light">
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

      {/* Edit Profile Modal */}
      {showEditProfile && (
        <EditProfileModal onClose={() => setShowEditProfile(false)} />
      )}

      {/* Blocked Users Modal */}
      {showBlockedUsers && (
        <BlockedUsersModal onClose={() => setShowBlockedUsers(false)} />
      )}
    </div>
  )
}
