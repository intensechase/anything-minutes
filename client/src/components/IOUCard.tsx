import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Clock, Check, X } from 'lucide-react'
import { formatDistanceToNow, isPast, format } from 'date-fns'
import { IOU } from '../types'
import { api } from '../services/api'
import { useAuth } from '../context/AuthContext'

interface IOUCardProps {
  iou: IOU
}

export default function IOUCard({ iou }: IOUCardProps) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [expanded, setExpanded] = useState(false)

  const isDebtor = iou.debtor_id === user?.id
  const otherUser = isDebtor ? iou.creditor : iou.debtor
  const isOverdue = iou.due_date && isPast(new Date(iou.due_date)) && iou.status === 'active'

  const acceptMutation = useMutation({
    mutationFn: () => api.acceptIOU(iou.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ious'] }),
  })

  const declineMutation = useMutation({
    mutationFn: () => api.declineIOU(iou.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ious'] }),
  })

  const markPaidMutation = useMutation({
    mutationFn: () => api.markPaid(iou.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ious'] }),
  })

  const getStatusColor = () => {
    if (isOverdue) return 'border-l-danger bg-red-50'
    switch (iou.status) {
      case 'pending':
        return 'border-l-warning bg-yellow-50'
      case 'payment_pending':
        return 'border-l-accent bg-blue-50'
      case 'paid':
        return 'border-l-success bg-green-50'
      case 'cancelled':
        return 'border-l-gray-400 bg-gray-50'
      default:
        return 'border-l-highlight bg-white'
    }
  }

  const getStatusBadge = () => {
    if (isOverdue) {
      return (
        <span className="px-2 py-1 text-xs font-medium bg-danger/10 text-danger rounded-full">
          Overdue
        </span>
      )
    }
    switch (iou.status) {
      case 'pending':
        return (
          <span className="px-2 py-1 text-xs font-medium bg-warning/10 text-warning rounded-full">
            Pending Acceptance
          </span>
        )
      case 'payment_pending':
        return (
          <span className="px-2 py-1 text-xs font-medium bg-accent/10 text-accent rounded-full">
            Payment Pending
          </span>
        )
      case 'paid':
        return (
          <span className="px-2 py-1 text-xs font-medium bg-success/10 text-success rounded-full">
            Paid
          </span>
        )
      case 'cancelled':
        return (
          <span className="px-2 py-1 text-xs font-medium bg-gray-200 text-gray-600 rounded-full">
            Cancelled
          </span>
        )
      default:
        return (
          <span className="px-2 py-1 text-xs font-medium bg-highlight/10 text-highlight rounded-full">
            Active
          </span>
        )
    }
  }

  return (
    <div
      className={`border-l-4 rounded-lg shadow-sm transition-all ${getStatusColor()}`}
    >
      <div
        className="p-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-sm font-medium">
                {otherUser?.username?.[0]?.toUpperCase() || '?'}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800">
                  {isDebtor ? 'You owe' : 'Owes you'}{' '}
                  <span className="text-highlight">{otherUser?.username || 'Unknown'}</span>
                </p>
                <p className="text-base font-semibold text-gray-900">{iou.description}</p>
              </div>
            </div>
          </div>
          {getStatusBadge()}
        </div>

        {iou.due_date && (
          <div className={`flex items-center gap-1 mt-2 text-xs ${isOverdue ? 'text-danger' : 'text-gray-500'}`}>
            <Clock className="w-3 h-3" />
            {isOverdue ? (
              <span>Overdue by {formatDistanceToNow(new Date(iou.due_date))}</span>
            ) : (
              <span>Due {formatDistanceToNow(new Date(iou.due_date), { addSuffix: true })}</span>
            )}
          </div>
        )}
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-3">
          <div className="text-sm text-gray-600 space-y-2 mb-4">
            {iou.notes && <p>{iou.notes}</p>}
            <p className="text-xs text-gray-400">
              Created {format(new Date(iou.created_at), 'MMM d, yyyy')}
            </p>
            {iou.due_date && (
              <p className="text-xs text-gray-400">
                Due {format(new Date(iou.due_date), 'MMM d, yyyy h:mm a')}
              </p>
            )}
          </div>

          {/* Actions based on status and role */}
          <div className="flex gap-2">
            {/* Pending IOU - non-creator can accept/decline */}
            {iou.status === 'pending' && iou.created_by !== user?.id && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    acceptMutation.mutate()
                  }}
                  disabled={acceptMutation.isPending}
                  className="flex-1 flex items-center justify-center gap-1 bg-success text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-success/90 disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  Accept
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    declineMutation.mutate()
                  }}
                  disabled={declineMutation.isPending}
                  className="flex-1 flex items-center justify-center gap-1 bg-danger text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-danger/90 disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                  Decline
                </button>
              </>
            )}

            {/* Active IOU - creditor can mark as paid */}
            {iou.status === 'active' && !isDebtor && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  markPaidMutation.mutate()
                }}
                disabled={markPaidMutation.isPending}
                className="flex-1 flex items-center justify-center gap-1 bg-success text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-success/90 disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                Mark as Paid
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
