import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Repeat, Calendar, DollarSign, Pause, Play, Trash2, Clock } from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { RecurringIOU } from '../types'
import { api } from '../services/api'
import { useAuth } from '../context/AuthContext'

interface RecurringIOUCardProps {
  recurring: RecurringIOU
}

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default function RecurringIOUCard({ recurring }: RecurringIOUCardProps) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [expanded, setExpanded] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const isCreator = recurring.created_by === user?.id
  const isDebtor = recurring.debtor_id === user?.id
  const otherUser = isDebtor ? recurring.creditor : recurring.debtor

  const toggleActiveMutation = useMutation({
    mutationFn: () => api.updateRecurringIOU(recurring.id, { is_active: !recurring.is_active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recurring'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteRecurringIOU(recurring.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recurring'] }),
  })

  const getScheduleText = () => {
    if (recurring.frequency === 'weekly') {
      return `Every ${DAYS_OF_WEEK[recurring.day_of_week || 0]}`
    } else {
      const day = recurring.day_of_month || 1
      const suffix = day === 1 ? 'st' : day === 2 ? 'nd' : day === 3 ? 'rd' : 'th'
      return `Every ${day}${suffix} of the month`
    }
  }

  return (
    <div
      className={`border-l-4 rounded-lg shadow-sm transition-all ${
        recurring.is_active
          ? 'border-l-accent bg-card'
          : 'border-l-light/30 bg-light/5'
      }`}
    >
      <div
        className="p-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Repeat className={`w-4 h-4 ${recurring.is_active ? 'text-accent' : 'text-light/40'}`} />
              <div className="w-8 h-8 rounded-full bg-accent/30 flex items-center justify-center text-accent text-sm font-medium">
                {(otherUser?.first_name?.[0] || otherUser?.username?.[0])?.toUpperCase() || '?'}
              </div>
              <div>
                <p className="text-sm font-medium text-light">
                  {isDebtor ? 'You owe' : 'Owes you'}{' '}
                  <span className="text-accent">{otherUser?.first_name || otherUser?.username || 'Unknown'}</span>
                </p>
                <p className="text-base font-semibold text-light">{recurring.description}</p>
              </div>
            </div>

            {/* Amount display */}
            {recurring.amount && (
              <div className="flex items-center gap-1 mt-2 text-sm">
                <DollarSign className="w-4 h-4 text-accent" />
                <span className="text-light font-medium">${recurring.amount.toFixed(2)}</span>
              </div>
            )}

            {/* Schedule */}
            <div className="flex items-center gap-1 mt-2 text-xs text-light/50">
              <Calendar className="w-3 h-3" />
              <span>{getScheduleText()}</span>
            </div>

            {/* Next due */}
            {recurring.is_active && (
              <div className="flex items-center gap-1 mt-1 text-xs text-accent">
                <Clock className="w-3 h-3" />
                <span>Next: {formatDistanceToNow(new Date(recurring.next_due_at), { addSuffix: true })}</span>
              </div>
            )}
          </div>

          {/* Status badge */}
          {recurring.is_active ? (
            <span className="px-2 py-1 text-xs font-medium bg-accent/20 text-accent rounded-full">
              Active
            </span>
          ) : (
            <span className="px-2 py-1 text-xs font-medium bg-light/10 text-light/50 rounded-full">
              Paused
            </span>
          )}
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-light/10 pt-3">
          <div className="text-sm text-light/70 space-y-2 mb-4">
            {recurring.notes && <p>{recurring.notes}</p>}
            <p className="text-xs text-light/40">
              Created {format(new Date(recurring.created_at), 'MMM d, yyyy')}
            </p>
            {recurring.last_generated_at && (
              <p className="text-xs text-light/40">
                Last generated: {format(new Date(recurring.last_generated_at), 'MMM d, yyyy h:mm a')}
              </p>
            )}
            <p className="text-xs text-light/40">
              Next due: {format(new Date(recurring.next_due_at), 'MMM d, yyyy')}
            </p>
          </div>

          {/* Actions - only for creator */}
          {isCreator && (
            <div className="flex gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  toggleActiveMutation.mutate()
                }}
                disabled={toggleActiveMutation.isPending}
                className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                  recurring.is_active
                    ? 'bg-warning/20 text-warning hover:bg-warning/30'
                    : 'bg-success/20 text-success hover:bg-success/30'
                }`}
              >
                {recurring.is_active ? (
                  <>
                    <Pause className="w-4 h-4" />
                    Pause
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Resume
                  </>
                )}
              </button>

              {showDeleteConfirm ? (
                <div className="flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteMutation.mutate()
                    }}
                    disabled={deleteMutation.isPending}
                    className="flex items-center justify-center gap-1 bg-danger text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-danger/90 disabled:opacity-50"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowDeleteConfirm(false)
                    }}
                    className="flex items-center justify-center gap-1 bg-dark text-light px-3 py-2 rounded-lg text-sm font-medium hover:bg-dark/70"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowDeleteConfirm(true)
                  }}
                  className="flex items-center justify-center gap-1 bg-danger/20 text-danger px-3 py-2 rounded-lg text-sm font-medium hover:bg-danger/30"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
