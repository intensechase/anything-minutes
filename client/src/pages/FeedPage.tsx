import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ThumbsUp, ThumbsDown, Rss } from 'lucide-react'
import { api } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { FeedItem } from '../types'

// Helper to format relative time
function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Get action text based on status
function getActionText(status: string): string {
  if (status === 'paid') return 'settled up with'
  return 'has a tab with'
}

export default function FeedPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const { data: feedData, isLoading, error } = useQuery({
    queryKey: ['feed'],
    queryFn: () => api.getFeed(),
  })

  const reactionMutation = useMutation({
    mutationFn: ({ iouId, reactionType }: { iouId: string; reactionType: 'up' | 'down' | null }) => {
      if (reactionType === null) {
        return api.removeReaction(iouId)
      }
      return api.addReaction(iouId, reactionType)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] })
    },
  })

  const handleReaction = (item: FeedItem, type: 'up' | 'down') => {
    // If clicking the same reaction, remove it
    if (item.userReaction === type) {
      reactionMutation.mutate({ iouId: item.id, reactionType: null })
    } else {
      reactionMutation.mutate({ iouId: item.id, reactionType: type })
    }
  }

  const feedItems = feedData?.data || []

  // Check if feed is disabled for user
  if (error && (error as any)?.response?.data?.error?.code === 'FEED_DISABLED') {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold font-serif text-gray-800">Feed</h1>
        <div className="text-center py-12">
          <Rss className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-700 mb-2">Feed Disabled</h3>
          <p className="text-gray-500">
            Enable feed visibility in your profile settings to see activity.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold font-serif text-gray-800">Feed</h1>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-highlight"></div>
        </div>
      ) : feedItems.length > 0 ? (
        <div className="space-y-4">
          {feedItems.map((item) => (
            <FeedCard
              key={item.id}
              item={item}
              currentUserId={user?.id}
              onReaction={handleReaction}
              isReacting={reactionMutation.isPending}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Rss className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-700 mb-2">No public activity yet</h3>
          <p className="text-gray-500">
            When you or your friends make public IOUs, they'll show up here.
          </p>
        </div>
      )}
    </div>
  )
}

interface FeedCardProps {
  item: FeedItem
  currentUserId?: string
  onReaction: (item: FeedItem, type: 'up' | 'down') => void
  isReacting: boolean
}

function FeedCard({ item, currentUserId, onReaction, isReacting }: FeedCardProps) {
  const debtor = item.debtor
  const creditor = item.creditor
  const actionText = getActionText(item.status)
  const timeAgo = formatTimeAgo(item.paid_at || item.created_at)

  // Determine if current user is involved
  const isInvolved = item.debtor_id === currentUserId || item.creditor_id === currentUserId

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition-shadow">
      {/* Header with avatars and action */}
      <div className="flex items-start gap-3">
        {/* Debtor avatar */}
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-medium flex-shrink-0">
          {debtor?.username?.[0]?.toUpperCase() || '?'}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Action text */}
          <p className="text-gray-800">
            <span className="font-semibold">{debtor?.username || 'Unknown'}</span>
            <span className="text-gray-500"> {actionText} </span>
            <span className="font-semibold">{creditor?.username || 'Unknown'}</span>
          </p>

          {/* Description */}
          <p className="text-gray-600 mt-1">{item.description}</p>

          {/* Timestamp */}
          <p className="text-xs text-gray-400 mt-2">{timeAgo}</p>
        </div>

        {/* Creditor avatar */}
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-secondary to-highlight flex items-center justify-center text-white font-medium flex-shrink-0">
          {creditor?.username?.[0]?.toUpperCase() || '?'}
        </div>
      </div>

      {/* Reactions */}
      <div className="flex items-center gap-4 mt-4 pt-3 border-t border-gray-100">
        <button
          onClick={() => onReaction(item, 'up')}
          disabled={isReacting}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors ${
            item.userReaction === 'up'
              ? 'bg-green-100 text-green-600'
              : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
          }`}
        >
          <ThumbsUp className="w-4 h-4" />
          <span>{item.reactions.up}</span>
        </button>

        <button
          onClick={() => onReaction(item, 'down')}
          disabled={isReacting}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors ${
            item.userReaction === 'down'
              ? 'bg-red-100 text-red-600'
              : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
          }`}
        >
          <ThumbsDown className="w-4 h-4" />
          <span>{item.reactions.down}</span>
        </button>

        {isInvolved && (
          <span className="ml-auto text-xs text-highlight font-medium">You're involved</span>
        )}
      </div>
    </div>
  )
}
