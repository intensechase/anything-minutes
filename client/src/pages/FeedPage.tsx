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
        <h1 className="text-2xl font-bold text-light">Feed</h1>
        <div className="text-center py-12">
          <Rss className="w-16 h-16 text-light/30 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-light mb-2">Feed Disabled</h3>
          <p className="text-light/50">
            Enable feed visibility in your profile settings to see activity.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-light">Feed</h1>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
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
          <Rss className="w-16 h-16 text-light/30 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-light mb-2">No public activity yet</h3>
          <p className="text-light/50">
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
    <div className="bg-card rounded-xl p-4 hover:bg-card/80 transition-colors">
      {/* Header with avatars and action */}
      <div className="flex items-start gap-3">
        {/* Debtor avatar */}
        <div className="w-10 h-10 rounded-full bg-accent/30 flex items-center justify-center text-accent font-medium flex-shrink-0">
          {(debtor?.first_name?.[0] || debtor?.username?.[0])?.toUpperCase() || '?'}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Action text */}
          <p className="text-light">
            <span className="font-semibold">{debtor?.first_name || debtor?.username || 'Unknown'}</span>
            <span className="text-light/50"> {actionText} </span>
            <span className="font-semibold">{creditor?.first_name || creditor?.username || 'Unknown'}</span>
          </p>

          {/* Description */}
          <p className="text-light/70 mt-1">{item.description}</p>

          {/* Timestamp */}
          <p className="text-xs text-light/40 mt-2">{timeAgo}</p>
        </div>

        {/* Creditor avatar */}
        <div className="w-10 h-10 rounded-full bg-success/30 flex items-center justify-center text-success font-medium flex-shrink-0">
          {(creditor?.first_name?.[0] || creditor?.username?.[0])?.toUpperCase() || '?'}
        </div>
      </div>

      {/* Reactions */}
      <div className="flex items-center gap-4 mt-4 pt-3 border-t border-light/10">
        <button
          onClick={() => onReaction(item, 'up')}
          disabled={isReacting}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors ${
            item.userReaction === 'up'
              ? 'bg-success/20 text-success'
              : 'bg-dark text-light/50 hover:bg-dark/70'
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
              ? 'bg-danger/20 text-danger'
              : 'bg-dark text-light/50 hover:bg-dark/70'
          }`}
        >
          <ThumbsDown className="w-4 h-4" />
          <span>{item.reactions.down}</span>
        </button>

        {isInvolved && (
          <span className="ml-auto text-xs text-accent font-medium">You're involved</span>
        )}
      </div>
    </div>
  )
}
