import { Router, Response, Request } from 'express'
import crypto from 'crypto'
import rateLimit from 'express-rate-limit'
import { supabase } from '../services/supabase.js'
import { authMiddleware } from '../middleware/auth.js'
import { AuthenticatedRequest, IOUInsert, IOUUpdate } from '../types/index.js'
import logger from '../utils/logger.js'
import { friendshipOrClause } from '../utils/friendships.js'
import {
  MAX_PENDING_INVITES,
  INVITE_EXPIRY_DAYS,
  RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_INVITE_MAX,
  validateAmount
} from '../utils/constants.js'

const router = Router()

// Stricter rate limiting for public invite endpoints (prevent brute force)
const inviteTokenLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_INVITE_MAX,
  message: {
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' }
  },
  standardHeaders: true,
  legacyHeaders: false,
})

// Generate a secure random token
function generateToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

// Create an invite IOU (authenticated)
router.post('/', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId
  const {
    type, // 'iou' or 'uome'
    description,
    amount,
    currency,
    visibility,
    due_date,
    notes,
    invitee_name,
    invitee_phone,
    invitee_email
  } = req.body

  if (!type || !description) {
    res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'type and description are required' },
    })
    return
  }

  if (!['iou', 'uome'].includes(type)) {
    res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'type must be "iou" or "uome"' },
    })
    return
  }

  // Validate amount if provided
  const amountValidation = validateAmount(amount)
  if (!amountValidation.valid) {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_AMOUNT', message: amountValidation.error },
    })
    return
  }

  try {
    // Check pending invite limit
    const { count } = await supabase
      .from('iou_invites')
      .select('*', { count: 'exact', head: true })
      .eq('invited_by', userId)
      .eq('status', 'pending')

    if (count !== null && count >= MAX_PENDING_INVITES) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVITE_LIMIT',
          message: `You can only have ${MAX_PENDING_INVITES} pending invites at a time`
        },
      })
      return
    }

    // Create the IOU first (with placeholder for the other party)
    // For 'iou': current user is debtor, invitee will be creditor
    // For 'uome': current user is creditor, invitee will be debtor
    const iouData: IOUInsert = {
      description,
      amount: amount || null,
      currency: currency || null,
      visibility: visibility || 'private',
      due_date: due_date || null,
      notes: notes || null,
      status: 'invite_pending', // Special status for invite IOUs
      created_by: userId,
      debtor_id: type === 'iou' ? userId : null,
      creditor_id: type === 'uome' ? userId : null,
    }

    const { data: iou, error: iouError } = await supabase
      .from('ious')
      .insert(iouData)
      .select()
      .single()

    if (iouError) throw iouError

    // Create the invite
    const token = generateToken()
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + INVITE_EXPIRY_DAYS)

    const { data: invite, error: inviteError } = await supabase
      .from('iou_invites')
      .insert({
        token,
        iou_id: iou.id,
        invited_by: userId,
        invitee_name: invitee_name || null,
        invitee_phone: invitee_phone || null,
        invitee_email: invitee_email || null,
        status: 'pending',
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single()

    if (inviteError) {
      // Clean up the IOU if invite creation failed
      await supabase.from('ious').delete().eq('id', iou.id)
      throw inviteError
    }

    res.json({
      success: true,
      data: {
        invite,
        iou,
        invite_url: `/invite/${token}`
      }
    })
  } catch (error) {
    logger.error('Create invite error', error)
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to create invite' },
    })
  }
})

// Get user's pending invites (authenticated)
router.get('/pending', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId

  try {
    const { data, error } = await supabase
      .from('iou_invites')
      .select(`
        *,
        iou:ious(*)
      `)
      .eq('invited_by', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (error) throw error

    res.json({ success: true, data })
  } catch (error) {
    logger.error('Get pending invites error', error)
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to fetch pending invites' },
    })
  }
})

// Get invite by token (PUBLIC - no auth required, rate limited)
// Returns limited data to prevent scraping sensitive information
router.get('/:token', inviteTokenLimiter, async (req: Request, res: Response): Promise<void> => {
  const { token } = req.params

  try {
    // Only select fields needed for the public invite page
    // Excludes: invitee_email, invitee_phone, IOU notes, internal IDs
    const { data: invite, error } = await supabase
      .from('iou_invites')
      .select(`
        id,
        status,
        expires_at,
        invitee_name,
        iou_id,
        invited_by,
        iou:ious(id, description, amount, currency, visibility, due_date, debtor_id, creditor_id),
        inviter:users!iou_invites_invited_by_fkey(id, username, first_name, profile_pic_url)
      `)
      .eq('token', token)
      .single()

    if (error || !invite) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Invite not found' },
      })
      return
    }

    // Check if expired
    if (new Date(invite.expires_at) < new Date()) {
      // Update status to expired if it hasn't been already
      if (invite.status === 'pending') {
        await supabase
          .from('iou_invites')
          .update({ status: 'expired', updated_at: new Date().toISOString() })
          .eq('id', invite.id)

        // Update IOU status
        await supabase
          .from('ious')
          .update({ status: 'expired' })
          .eq('id', invite.iou_id)

        // Create notification for inviter
        await supabase.from('notifications').insert({
          user_id: invite.invited_by,
          type: 'invite_expired',
          title: 'Invite Expired',
          message: `Your invite to ${invite.invitee_name || 'someone'} has expired`,
          data: { invite_id: invite.id, iou_id: invite.iou_id }
        })
      }

      res.status(410).json({
        success: false,
        error: { code: 'EXPIRED', message: 'This invite has expired' },
      })
      return
    }

    // Check if already claimed
    if (invite.status === 'claimed' || invite.status === 'accepted') {
      res.status(410).json({
        success: false,
        error: { code: 'CLAIMED', message: 'This invite has already been claimed' },
      })
      return
    }

    // Check if declined
    if (invite.status === 'declined') {
      res.status(410).json({
        success: false,
        error: { code: 'DECLINED', message: 'This invite has been declined' },
      })
      return
    }

    res.json({ success: true, data: invite })
  } catch (error) {
    logger.error('Get invite error', error)
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to fetch invite' },
    })
  }
})

// Accept invite (authenticated - user must be logged in)
router.post('/:token/accept', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId
  const { token } = req.params

  try {
    // Get the invite
    const { data: invite, error: fetchError } = await supabase
      .from('iou_invites')
      .select('*, iou:ious(*)')
      .eq('token', token)
      .eq('status', 'pending')
      .single()

    if (fetchError || !invite) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Invite not found or already processed' },
      })
      return
    }

    // Check if expired
    if (new Date(invite.expires_at) < new Date()) {
      res.status(410).json({
        success: false,
        error: { code: 'EXPIRED', message: 'This invite has expired' },
      })
      return
    }

    // Can't accept your own invite
    if (invite.invited_by === userId) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID', message: 'You cannot accept your own invite' },
      })
      return
    }

    // Update the IOU with the accepting user's ID
    // If the inviter created an IOU (they owe), the accepter is the creditor
    // If the inviter created a UOMe (they're owed), the accepter is the debtor
    const iouUpdate: IOUUpdate = {
      status: 'pending', // Now it's a regular pending IOU awaiting acceptance
      creditor_id: invite.iou.debtor_id === invite.invited_by ? userId : undefined,
      debtor_id: invite.iou.debtor_id !== invite.invited_by ? userId : undefined,
    }

    const { error: iouUpdateError } = await supabase
      .from('ious')
      .update(iouUpdate)
      .eq('id', invite.iou_id)

    if (iouUpdateError) throw iouUpdateError

    // Update invite status
    const { error: inviteUpdateError } = await supabase
      .from('iou_invites')
      .update({
        status: 'accepted',
        claimed_by: userId,
        updated_at: new Date().toISOString()
      })
      .eq('id', invite.id)

    if (inviteUpdateError) throw inviteUpdateError

    // Create friendship (if not already friends)
    const { data: existingFriendship } = await supabase
      .from('friendships')
      .select('id')
      .or(friendshipOrClause(userId, invite.invited_by))
      .single()

    if (!existingFriendship) {
      await supabase.from('friendships').insert({
        requester_id: invite.invited_by,
        addressee_id: userId,
        status: 'accepted'
      })
    }

    // Create notification for inviter
    const { data: acceptingUser } = await supabase
      .from('users')
      .select('first_name, username')
      .eq('id', userId)
      .single()

    await supabase.from('notifications').insert({
      user_id: invite.invited_by,
      type: 'invite_accepted',
      title: 'Invite Accepted!',
      message: `${acceptingUser?.first_name || acceptingUser?.username || 'Someone'} accepted your IOU invite`,
      data: { invite_id: invite.id, iou_id: invite.iou_id, user_id: userId }
    })

    // Get updated IOU with user details
    const { data: updatedIOU } = await supabase
      .from('ious')
      .select(`
        *,
        debtor:users!ious_debtor_id_fkey(id, username, first_name, profile_pic_url),
        creditor:users!ious_creditor_id_fkey(id, username, first_name, profile_pic_url)
      `)
      .eq('id', invite.iou_id)
      .single()

    res.json({ success: true, data: updatedIOU })
  } catch (error) {
    logger.error('Accept invite error', error)
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to accept invite' },
    })
  }
})

// Decline invite (PUBLIC - no auth required, rate limited)
router.post('/:token/decline', inviteTokenLimiter, async (req: Request, res: Response): Promise<void> => {
  const { token } = req.params

  try {
    // Get the invite
    const { data: invite, error: fetchError } = await supabase
      .from('iou_invites')
      .select('*')
      .eq('token', token)
      .eq('status', 'pending')
      .single()

    if (fetchError || !invite) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Invite not found or already processed' },
      })
      return
    }

    // Update invite status
    const { error: inviteUpdateError } = await supabase
      .from('iou_invites')
      .update({
        status: 'declined',
        updated_at: new Date().toISOString()
      })
      .eq('id', invite.id)

    if (inviteUpdateError) throw inviteUpdateError

    // Update IOU status
    const { error: iouUpdateError } = await supabase
      .from('ious')
      .update({ status: 'cancelled' })
      .eq('id', invite.iou_id)

    if (iouUpdateError) throw iouUpdateError

    // Create notification for inviter
    await supabase.from('notifications').insert({
      user_id: invite.invited_by,
      type: 'invite_declined',
      title: 'Invite Declined',
      message: `${invite.invitee_name || 'Someone'} declined your IOU invite`,
      data: { invite_id: invite.id, iou_id: invite.iou_id }
    })

    res.json({ success: true, message: 'Invite declined' })
  } catch (error) {
    logger.error('Decline invite error', error)
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to decline invite' },
    })
  }
})

export default router
