import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { FileText, Clock, Check, X, AlertCircle, Loader2 } from 'lucide-react'
import { api } from '../services/api'
import { useAuth } from '../context/AuthContext'

export default function InvitePage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()

  const [invite, setInvite] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<{ code: string; message: string } | null>(null)
  const [accepting, setAccepting] = useState(false)
  const [declining, setDeclining] = useState(false)
  const [declined, setDeclined] = useState(false)

  useEffect(() => {
    if (!token) return

    const fetchInvite = async () => {
      try {
        const response = await api.getInviteByToken(token)
        if (response.success) {
          setInvite(response.data)
        }
      } catch (err: any) {
        const errorData = err.response?.data?.error
        setError(errorData || { code: 'ERROR', message: 'Failed to load invite' })
      } finally {
        setLoading(false)
      }
    }

    fetchInvite()
  }, [token])

  const handleAccept = async () => {
    if (!user) {
      // Store token and redirect to login
      sessionStorage.setItem('pendingInviteToken', token!)
      navigate('/login')
      return
    }

    setAccepting(true)
    try {
      const response = await api.acceptInvite(token!)
      if (response.success) {
        navigate('/debts')
      }
    } catch (err: any) {
      const errorData = err.response?.data?.error
      setError(errorData || { code: 'ERROR', message: 'Failed to accept invite' })
    } finally {
      setAccepting(false)
    }
  }

  const handleDecline = async () => {
    setDeclining(true)
    try {
      await api.declineInvite(token!)
      setDeclined(true)
    } catch (err: any) {
      const errorData = err.response?.data?.error
      setError(errorData || { code: 'ERROR', message: 'Failed to decline invite' })
    } finally {
      setDeclining(false)
    }
  }

  // Calculate days remaining
  const getDaysRemaining = () => {
    if (!invite?.expires_at) return 0
    const expires = new Date(invite.expires_at)
    const now = new Date()
    const diff = expires.getTime() - now.getTime()
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
  }

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-dark flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
      </div>
    )
  }

  if (declined) {
    return (
      <div className="min-h-screen bg-dark flex items-center justify-center p-4">
        <div className="bg-card rounded-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-light/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <X className="w-8 h-8 text-light/50" />
          </div>
          <h1 className="text-xl font-bold text-light mb-2">Invite Declined</h1>
          <p className="text-light/60">
            You've declined this IOU request. The sender has been notified.
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-dark flex items-center justify-center p-4">
        <div className="bg-card rounded-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-danger/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-danger" />
          </div>
          <h1 className="text-xl font-bold text-light mb-2">
            {error.code === 'EXPIRED' ? 'Invite Expired' :
             error.code === 'CLAIMED' ? 'Already Claimed' :
             error.code === 'DECLINED' ? 'Invite Declined' :
             'Invite Not Found'}
          </h1>
          <p className="text-light/60">
            {error.message}
          </p>
          <button
            onClick={() => navigate('/')}
            className="mt-6 px-6 py-2 bg-accent text-dark rounded-lg font-medium hover:bg-accent/90 transition-colors"
          >
            Go to Home
          </button>
        </div>
      </div>
    )
  }

  if (!invite) return null

  const inviter = invite.inviter
  const iou = invite.iou
  const isIOUFromInviter = iou.debtor_id === invite.invited_by // Inviter owes you
  const daysRemaining = getDaysRemaining()

  return (
    <div className="min-h-screen bg-dark flex items-center justify-center p-4">
      <div className="bg-card rounded-xl shadow-xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="bg-accent/10 p-6 text-center border-b border-light/10">
          <div className="w-16 h-16 bg-accent/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-accent" />
          </div>
          <h1 className="text-xl font-bold text-light">
            {isIOUFromInviter ? 'Someone Owes You!' : 'You Have a New IOU Request'}
          </h1>
          <p className="text-light/60 mt-1">
            {isIOUFromInviter
              ? `${inviter?.first_name || inviter?.username} says they owe you`
              : `${inviter?.first_name || inviter?.username} says you owe them`
            }
          </p>
        </div>

        {/* IOU Details */}
        <div className="p-6 space-y-4">
          {/* From */}
          <div className="flex items-center gap-3 p-3 bg-dark rounded-lg">
            <div className="w-10 h-10 rounded-full bg-accent/30 flex items-center justify-center text-accent font-medium">
              {(inviter?.first_name?.[0] || inviter?.username?.[0])?.toUpperCase() || '?'}
            </div>
            <div>
              <p className="text-xs text-light/50">From</p>
              <p className="font-medium text-light">{inviter?.first_name || inviter?.username}</p>
              <p className="text-xs text-light/40">@{inviter?.username}</p>
            </div>
          </div>

          {/* Description */}
          <div className="p-3 bg-dark rounded-lg">
            <p className="text-xs text-light/50 mb-1">What</p>
            <p className="text-light font-medium">{iou.description}</p>
          </div>

          {/* Amount (if specified) */}
          {iou.amount && (
            <div className="p-3 bg-dark rounded-lg">
              <p className="text-xs text-light/50 mb-1">Amount</p>
              <p className="text-2xl font-bold text-accent">
                {iou.currency || '$'}{iou.amount}
              </p>
            </div>
          )}

          {/* Notes (if specified) */}
          {iou.notes && (
            <div className="p-3 bg-dark rounded-lg">
              <p className="text-xs text-light/50 mb-1">Notes</p>
              <p className="text-light/70 text-sm">{iou.notes}</p>
            </div>
          )}

          {/* Expiry */}
          <div className="flex items-center gap-2 text-sm text-light/50">
            <Clock className="w-4 h-4" />
            <span>Expires in {daysRemaining} day{daysRemaining !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="p-6 border-t border-light/10 space-y-3">
          <button
            onClick={handleAccept}
            disabled={accepting}
            className="w-full flex items-center justify-center gap-2 bg-accent text-dark py-3 rounded-lg font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
          >
            {accepting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Check className="w-5 h-5" />
                {user ? 'Accept & Connect' : 'Sign Up to Accept'}
              </>
            )}
          </button>
          <button
            onClick={handleDecline}
            disabled={declining}
            className="w-full flex items-center justify-center gap-2 bg-dark text-light/70 py-3 rounded-lg font-medium hover:bg-dark/70 transition-colors disabled:opacity-50"
          >
            {declining ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <X className="w-5 h-5" />
                Decline
              </>
            )}
          </button>
          <p className="text-xs text-light/40 text-center">
            By accepting, you'll connect with {inviter?.first_name || inviter?.username} on Anything Minutes
          </p>
        </div>
      </div>
    </div>
  )
}
