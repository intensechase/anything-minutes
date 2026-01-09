import { Router, Response, Request } from 'express'
import crypto from 'crypto'
import { supabase } from '../services/supabase.js'
import { authMiddleware } from '../middleware/auth.js'
import { AuthenticatedRequest } from '../types/index.js'

const router = Router()

const MAX_PENDING_INVITES = 5
const INVITE_EXPIRY_DAYS = 7
const MAX_AMOUNT = 999999.99

// Amount validation helper
function validateAmount(amount: any): { valid: boolean; error?: string } {
  if (amount === undefined || amount === null || amount === '') {
    return { valid: true } // Optional field
  }
  const num = Number(amount)
  if (!Number.isFinite(num)) {
    return { valid: false, error: 'Amount must be a valid number' }
  }
  if (num < 0) {
    return { valid: false, error: 'Amount cannot be negative' }
  }
  if (num > MAX_AMOUNT) {
    return { valid: false, error: `Amount cannot exceed ${MAX_AMOUNT}` }
  }
  return { valid: true }
}

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
    const iouData: Record<string, any> = {
      description,
      amount: amount || null,
      currency: currency || null,
      visibility: visibility || 'private',
      due_date: due_date || null,
      notes: notes || null,
      status: 'invite_pending', // Special status for invite IOUs
      created_by: userId,
    }

    if (type === 'iou') {
      iouData.debtor_id = userId
      iouData.creditor_id = null // Will be filled when invite is accepted
    } else {
      iouData.creditor_id = userId
      iouData.debtor_id = null // Will be filled when invite is accepted
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
    console.error('Create invite error:', error)
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
    console.error('Get pending invites error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to fetch pending invites' },
    })
  }
})

// Get invite by token (PUBLIC - no auth required)
router.get('/:token', async (req: Request, res: Response): Promise<void> => {
  const { token } = req.params

  try {
    const { data: invite, error } = await supabase
      .from('iou_invites')
      .select(`
        *,
        iou:ious(*),
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
    console.error('Get invite error:', error)
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
    const iouUpdate: Record<string, any> = {
      status: 'pending', // Now it's a regular pending IOU awaiting acceptance
    }

    // If the inviter created an IOU (they owe), the accepter is the creditor
    // If the inviter created a UOMe (they're owed), the accepter is the debtor
    if (invite.iou.debtor_id === invite.invited_by) {
      iouUpdate.creditor_id = userId
    } else {
      iouUpdate.debtor_id = userId
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
      .or(`and(requester_id.eq.${userId},addressee_id.eq.${invite.invited_by}),and(requester_id.eq.${invite.invited_by},addressee_id.eq.${userId})`)
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
    console.error('Accept invite error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to accept invite' },
    })
  }
})

// Decline invite (PUBLIC - no auth required)
router.post('/:token/decline', async (req: Request, res: Response): Promise<void> => {
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
    console.error('Decline invite error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to decline invite' },
    })
  }
})

export default router
