import { X, UserX, Loader2 } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'

interface BlockedUsersModalProps {
  onClose: () => void
}

export default function BlockedUsersModal({ onClose }: BlockedUsersModalProps) {
  const queryClient = useQueryClient()

  const { data: blockedData, isLoading } = useQuery({
    queryKey: ['blocked-users'],
    queryFn: () => api.getBlockedUsers(),
  })

  const unblockMutation = useMutation({
    mutationFn: (userId: string) => api.unblockUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blocked-users'] })
    },
  })

  const blockedUsers = blockedData?.data || []

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-xl w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-light/10">
          <h2 className="text-lg font-semibold text-light">Blocked Users</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-dark rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-light/70" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-accent animate-spin" />
            </div>
          ) : blockedUsers.length === 0 ? (
            <div className="text-center py-8">
              <UserX className="w-12 h-12 text-light/30 mx-auto mb-3" />
              <p className="text-light/50">No blocked users</p>
              <p className="text-xs text-light/30 mt-1">
                Users you block won't be able to see you or send you requests
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {blockedUsers.map((blocked) => (
                <div
                  key={blocked.id}
                  className="flex items-center justify-between p-3 bg-dark rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-accent/30 flex items-center justify-center text-sm font-bold text-accent">
                      {(blocked.blocked_user?.first_name?.[0] || blocked.blocked_user?.username?.[0])?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-light">
                        {blocked.blocked_user?.first_name || blocked.blocked_user?.username}
                      </p>
                      <p className="text-xs text-light/50">
                        @{blocked.blocked_user?.username}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => unblockMutation.mutate(blocked.blocked_id)}
                    disabled={unblockMutation.isPending}
                    className="px-3 py-1.5 text-xs font-medium bg-light/10 text-light rounded-lg hover:bg-light/20 transition-colors disabled:opacity-50"
                  >
                    {unblockMutation.isPending ? 'Unblocking...' : 'Unblock'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-light/10">
          <p className="text-xs text-light/40 text-center">
            Blocked users cannot see your profile, send you friend requests, or create IOUs with you.
          </p>
        </div>
      </div>
    </div>
  )
}
