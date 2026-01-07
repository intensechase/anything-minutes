import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, UserPlus, Check, X, Users, FileText } from 'lucide-react'
import { api } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { User, Friendship } from '../types'
import CreateIOUModal from '../components/CreateIOUModal'

export default function FriendsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<User[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [selectedFriend, setSelectedFriend] = useState<User | null>(null)

  const { data: friendsData, isLoading } = useQuery({
    queryKey: ['friends'],
    queryFn: () => api.getFriends(),
  })

  const { data: requestsData } = useQuery({
    queryKey: ['friend-requests'],
    queryFn: () => api.getFriendRequests(),
  })

  // Fetch IOUs to show counts per friend
  const { data: iousData } = useQuery({
    queryKey: ['ious'],
    queryFn: () => api.getIOUs(),
  })

  const ious = iousData?.data || []

  // Helper to count active IOUs with a specific friend
  const getActiveIOUCount = (friendId: string): number => {
    return ious.filter(
      (iou) =>
        (iou.status === 'active' || iou.status === 'pending' || iou.status === 'payment_pending') &&
        (iou.debtor_id === friendId || iou.creditor_id === friendId)
    ).length
  }

  const friendships = friendsData?.data || []
  const requests = requestsData?.data || []

  const acceptedFriends = friendships.filter((f) => f.status === 'accepted')
  const pendingRequests = requests.filter(
    (r) => r.status === 'pending' && r.addressee_id === user?.id
  )
  const sentRequests = friendships.filter(
    (f) => f.status === 'pending' && f.requester_id === user?.id
  )

  const sendRequestMutation = useMutation({
    mutationFn: (variables: { userId: string; username: string }) =>
      api.sendFriendRequest(variables.userId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['friends'] })
      setSearchResults([])
      setSearchQuery('')
      setSuccessMessage(`Friend request sent to ${variables.username}!`)
      // Auto-hide message after 4 seconds
      setTimeout(() => setSuccessMessage(null), 4000)
    },
  })

  const acceptMutation = useMutation({
    mutationFn: (friendshipId: string) => api.acceptFriendRequest(friendshipId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friends'] })
      queryClient.invalidateQueries({ queryKey: ['friend-requests'] })
    },
  })

  const declineMutation = useMutation({
    mutationFn: (friendshipId: string) => api.declineFriendRequest(friendshipId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friends'] })
      queryClient.invalidateQueries({ queryKey: ['friend-requests'] })
    },
  })

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    setIsSearching(true)
    try {
      const response = await api.searchUsers(searchQuery)
      if (response.success && response.data) {
        const filteredResults = response.data.filter(
          (u) =>
            u.id !== user?.id &&
            !friendships.some(
              (f) => f.requester_id === u.id || f.addressee_id === u.id
            )
        )
        setSearchResults(filteredResults)
      }
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setIsSearching(false)
    }
  }

  const getFriendFromFriendship = (friendship: Friendship): User | undefined => {
    if (friendship.requester_id === user?.id) {
      return friendship.addressee
    }
    return friendship.requester
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <h1 className="text-2xl font-bold font-serif text-gray-800">Friends</h1>

      {/* Success Message */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center justify-between">
          <span>{successMessage}</span>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-green-500 hover:text-green-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search for new friends */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Add Friends</h2>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by username or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-highlight/50"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={isSearching || !searchQuery.trim()}
            className="bg-highlight text-white px-4 py-2 rounded-lg hover:bg-highlight/90 transition-colors disabled:opacity-50"
          >
            {isSearching ? 'Searching...' : 'Search'}
          </button>
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="mt-4 space-y-2">
            {searchResults.map((result) => (
              <div
                key={result.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-medium">
                    {result.username[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-gray-800">{result.username}</p>
                    {result.email && (
                      <p className="text-sm text-gray-500">{result.email}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => sendRequestMutation.mutate({ userId: result.id, username: result.username })}
                  disabled={sendRequestMutation.isPending}
                  className="flex items-center gap-1 bg-highlight text-white px-3 py-1.5 rounded-lg text-sm hover:bg-highlight/90 transition-colors disabled:opacity-50"
                >
                  <UserPlus className="w-4 h-4" />
                  Send Request
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pending Requests */}
      {pendingRequests.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">
            Friend Requests ({pendingRequests.length})
          </h2>
          <div className="space-y-2">
            {pendingRequests.map((request) => {
              const requester = request.requester
              return (
                <div
                  key={request.id}
                  className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-100 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-medium">
                      {requester?.username?.[0]?.toUpperCase() || '?'}
                    </div>
                    <p className="font-medium text-gray-800">
                      {requester?.username || 'Unknown'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => acceptMutation.mutate(request.id)}
                      disabled={acceptMutation.isPending}
                      className="p-2 bg-success text-white rounded-lg hover:bg-success/90 transition-colors disabled:opacity-50"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => declineMutation.mutate(request.id)}
                      disabled={declineMutation.isPending}
                      className="p-2 bg-danger text-white rounded-lg hover:bg-danger/90 transition-colors disabled:opacity-50"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Sent Requests */}
      {sentRequests.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">
            Sent Requests ({sentRequests.length})
          </h2>
          <div className="space-y-2">
            {sentRequests.map((request) => {
              const addressee = request.addressee
              return (
                <div
                  key={request.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-medium">
                      {addressee?.username?.[0]?.toUpperCase() || '?'}
                    </div>
                    <p className="font-medium text-gray-800">
                      {addressee?.username || 'Unknown'}
                    </p>
                  </div>
                  <span className="text-sm text-gray-500">Pending</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Friends List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">
          My Friends ({acceptedFriends.length})
        </h2>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-highlight"></div>
          </div>
        ) : acceptedFriends.length > 0 ? (
          <div className="space-y-2">
            {acceptedFriends.map((friendship) => {
              const friend = getFriendFromFriendship(friendship)
              const activeCount = friend ? getActiveIOUCount(friend.id) : 0
              return (
                <div
                  key={friendship.id}
                  onClick={() => friend && navigate(`/profile/${friend.id}`)}
                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-medium">
                    {friend?.username?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800">
                      {friend?.username || 'Unknown'}
                    </p>
                    {activeCount > 0 && (
                      <p className="text-sm text-highlight">
                        {activeCount} active IOU{activeCount !== 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (friend) setSelectedFriend(friend)
                    }}
                    className="flex items-center gap-1 bg-highlight text-white px-3 py-1.5 rounded-lg text-sm hover:bg-highlight/90 transition-colors"
                  >
                    <FileText className="w-4 h-4" />
                    New IOU
                  </button>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-8">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No friends yet</p>
            <p className="text-sm text-gray-400">
              Search for friends above to get started
            </p>
          </div>
        )}
      </div>

      {/* Create IOU Modal */}
      {selectedFriend && (
        <CreateIOUModal
          onClose={() => setSelectedFriend(null)}
          preselectedFriend={selectedFriend}
        />
      )}
    </div>
  )
}
