import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Clock, Check, X, DollarSign, Plus, Link } from 'lucide-react'
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
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentDescription, setPaymentDescription] = useState('')

  const isDebtor = iou.debtor_id === user?.id
  const otherUser = isDebtor ? iou.creditor : iou.debtor
  const isOverdue = iou.due_date && isPast(new Date(iou.due_date)) && iou.status === 'active'
  const isInvitePending = iou.invite_id && !otherUser
  const currencySymbol = iou.currency || '$'

  // Calculate remaining balance
  const amountPaid = iou.amount_paid || 0
  const remaining = iou.amount ? iou.amount - amountPaid : null

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

  const addPaymentMutation = useMutation({
    mutationFn: () => api.addPayment(iou.id, {
      description: paymentDescription,
      amount: paymentAmount ? parseFloat(paymentAmount) : undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ious'] })
      setShowPaymentForm(false)
      setPaymentAmount('')
      setPaymentDescription('')
    },
  })

  const handleAddPayment = (e: React.FormEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!paymentDescription.trim()) return
    addPaymentMutation.mutate()
  }

  const getStatusColor = () => {
    if (isInvitePending) return 'border-l-purple-500 bg-purple-500/10'
    if (isOverdue) return 'border-l-danger bg-danger/10'
    switch (iou.status) {
      case 'pending':
        return 'border-l-warning bg-warning/10'
      case 'payment_pending':
        return 'border-l-accent bg-accent/10'
      case 'paid':
        return 'border-l-success bg-success/10'
      case 'cancelled':
        return 'border-l-light/30 bg-light/5'
      default:
        return 'border-l-accent bg-card'
    }
  }

  const getStatusBadge = () => {
    if (isInvitePending) {
      return (
        <span className="px-2 py-1 text-xs font-medium bg-purple-500/10 text-purple-400 rounded-full flex items-center gap-1">
          <Link className="w-3 h-3" />
          Invite Sent
        </span>
      )
    }
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
          <span className="px-2 py-1 text-xs font-medium bg-light/10 text-light/50 rounded-full">
            Cancelled
          </span>
        )
      default:
        return (
          <span className="px-2 py-1 text-xs font-medium bg-accent/20 text-accent rounded-full">
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
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                isInvitePending ? 'bg-purple-500/30 text-purple-400' : 'bg-accent/30 text-accent'
              }`}>
                {isInvitePending ? (
                  <Link className="w-4 h-4" />
                ) : (
                  (otherUser?.first_name?.[0] || otherUser?.username?.[0])?.toUpperCase() || '?'
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-light">
                  {isDebtor ? 'You owe' : 'Owes you'}{' '}
                  <span className={isInvitePending ? 'text-purple-400' : 'text-accent'}>
                    {isInvitePending ? 'Invited user' : (otherUser?.first_name || otherUser?.username || 'Unknown')}
                  </span>
                </p>
                <p className="text-base font-semibold text-light">{iou.description}</p>
              </div>
            </div>

            {/* Amount display */}
            {iou.amount && (
              <div className="flex items-center gap-2 mt-2">
                <div className="flex items-center gap-1 text-sm">
                  {currencySymbol === '$' ? (
                    <DollarSign className="w-4 h-4 text-accent" />
                  ) : (
                    <span className="text-accent">{currencySymbol}</span>
                  )}
                  <span className="text-light font-medium">
                    {currencySymbol === '$' ? `$${iou.amount.toFixed(2)}` : iou.amount}
                  </span>
                </div>
                {amountPaid > 0 && (
                  <>
                    <span className="text-light/40">•</span>
                    <span className="text-sm text-success">
                      {currencySymbol === '$' ? `$${amountPaid.toFixed(2)}` : `${amountPaid} ${currencySymbol}`} paid
                    </span>
                    {remaining !== null && remaining > 0 && (
                      <>
                        <span className="text-light/40">•</span>
                        <span className="text-sm text-warning">
                          {currencySymbol === '$' ? `$${remaining.toFixed(2)}` : `${remaining} ${currencySymbol}`} remaining
                        </span>
                      </>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
          {getStatusBadge()}
        </div>

        {iou.due_date && (
          <div className={`flex items-center gap-1 mt-2 text-xs ${isOverdue ? 'text-danger' : 'text-light/50'}`}>
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
        <div className="px-4 pb-4 border-t border-light/10 pt-3">
          <div className="text-sm text-light/70 space-y-2 mb-4">
            {iou.notes && <p>{iou.notes}</p>}
            <p className="text-xs text-light/40">
              Created {format(new Date(iou.created_at), 'MMM d, yyyy')}
            </p>
            {iou.due_date && (
              <p className="text-xs text-light/40">
                Due {format(new Date(iou.due_date), 'MMM d, yyyy h:mm a')}
              </p>
            )}
          </div>

          {/* Payment History */}
          {iou.payments && iou.payments.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-medium text-light mb-2">Payment History</h4>
              <div className="space-y-2">
                {iou.payments.map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between text-sm bg-dark/50 rounded-lg p-2">
                    <div>
                      <span className="text-light">{payment.description}</span>
                      {payment.amount && (
                        <span className="text-success ml-2">${payment.amount.toFixed(2)}</span>
                      )}
                    </div>
                    <span className="text-xs text-light/40">
                      {format(new Date(payment.paid_at), 'MMM d, yyyy h:mm a')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add Payment Form */}
          {showPaymentForm && iou.status === 'active' && (
            <form onSubmit={handleAddPayment} className="mb-4 bg-dark/50 rounded-lg p-3 space-y-3">
              <div>
                <label className="block text-xs font-medium text-light/70 mb-1">
                  Description *
                </label>
                <input
                  type="text"
                  value={paymentDescription}
                  onChange={(e) => setPaymentDescription(e.target.value)}
                  placeholder="e.g., Partial payment, Half paid"
                  className="w-full px-3 py-2 bg-dark border border-light/20 rounded-lg text-sm text-light placeholder-light/40 focus:outline-none focus:ring-2 focus:ring-accent/50"
                  onClick={(e) => e.stopPropagation()}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-light/70 mb-1">
                  Amount (optional)
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-light/40" />
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-9 pr-3 py-2 bg-dark border border-light/20 rounded-lg text-sm text-light placeholder-light/40 focus:outline-none focus:ring-2 focus:ring-accent/50"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={addPaymentMutation.isPending || !paymentDescription.trim()}
                  className="flex-1 bg-accent text-dark py-2 rounded-lg text-sm font-medium hover:bg-accent/90 disabled:opacity-50"
                  onClick={(e) => e.stopPropagation()}
                >
                  {addPaymentMutation.isPending ? 'Adding...' : 'Add Payment'}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowPaymentForm(false)
                  }}
                  className="px-4 py-2 bg-dark text-light/70 rounded-lg text-sm hover:bg-dark/70"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

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

            {/* Active IOU - add payment button */}
            {iou.status === 'active' && !showPaymentForm && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setShowPaymentForm(true)
                }}
                className="flex items-center justify-center gap-1 bg-dark text-light px-3 py-2 rounded-lg text-sm font-medium hover:bg-dark/70"
              >
                <Plus className="w-4 h-4" />
                Log Payment
              </button>
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
