import { Router, Response } from 'express'
import { supabase } from '../services/supabase.js'
import { authMiddleware } from '../middleware/auth.js'
import { AuthenticatedRequest } from '../types/index.js'

const router = Router()

// All routes require authentication
router.use(authMiddleware)

// Get all IOUs for user
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId
  const { filter } = req.query

  try {
    let query = supabase
      .from('ious')
      .select(`
        *,
        debtor:users!ious_debtor_id_fkey(*),
        creditor:users!ious_creditor_id_fkey(*),
        payments(*)
      `)

    if (filter === 'owed_by_me') {
      query = query.eq('debtor_id', userId)
    } else if (filter === 'owed_to_me') {
      query = query.eq('creditor_id', userId)
    } else {
      query = query.or(`debtor_id.eq.${userId},creditor_id.eq.${userId}`)
    }

    query = query.order('created_at', { ascending: false })

    const { data, error } = await query

    if (error) throw error

    // Calculate amount_paid for each IOU
    const iousWithTotals = data?.map(iou => ({
      ...iou,
      amount_paid: iou.payments?.reduce((sum: number, p: any) => sum + (p.amount || 0), 0) || 0
    }))

    res.json({ success: true, data: iousWithTotals })
  } catch (error) {
    console.error('Get IOUs error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to fetch IOUs' },
    })
  }
})

// Create IOU (debtor creates - "I owe you")
router.post('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId
  const { creditor_id, description, visibility, due_date, notes, amount } = req.body

  if (!creditor_id || !description) {
    res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'creditor_id and description are required' },
    })
    return
  }

  try {
    // Verify friendship exists
    const { data: friendship } = await supabase
      .from('friendships')
      .select('*')
      .or(
        `and(requester_id.eq.${userId},addressee_id.eq.${creditor_id}),and(requester_id.eq.${creditor_id},addressee_id.eq.${userId})`
      )
      .eq('status', 'accepted')
      .single()

    if (!friendship) {
      res.status(400).json({
        success: false,
        error: { code: 'NOT_FRIENDS', message: 'You can only create IOUs with friends' },
      })
      return
    }

    const { data, error } = await supabase
      .from('ious')
      .insert({
        debtor_id: userId,
        creditor_id,
        description,
        amount: amount || null,
        visibility: visibility || 'private',
        due_date: due_date || null,
        notes: notes || null,
        status: 'pending',
        created_by: userId,  // Track who created the IOU
      })
      .select(`
        *,
        debtor:users!ious_debtor_id_fkey(*),
        creditor:users!ious_creditor_id_fkey(*)
      `)
      .single()

    if (error) throw error

    res.json({ success: true, data })
  } catch (error) {
    console.error('Create IOU error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to create IOU' },
    })
  }
})

// Create UOMe (creditor creates - "You owe me")
router.post('/uome', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId
  const { debtor_id, description, visibility, due_date, notes, amount } = req.body

  if (!debtor_id || !description) {
    res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'debtor_id and description are required' },
    })
    return
  }

  try {
    // Verify friendship exists
    const { data: friendship } = await supabase
      .from('friendships')
      .select('*')
      .or(
        `and(requester_id.eq.${userId},addressee_id.eq.${debtor_id}),and(requester_id.eq.${debtor_id},addressee_id.eq.${userId})`
      )
      .eq('status', 'accepted')
      .single()

    if (!friendship) {
      res.status(400).json({
        success: false,
        error: { code: 'NOT_FRIENDS', message: 'You can only create IOUs with friends' },
      })
      return
    }

    const { data, error } = await supabase
      .from('ious')
      .insert({
        debtor_id,
        creditor_id: userId,  // Current user is the creditor
        description,
        amount: amount || null,
        visibility: visibility || 'private',
        due_date: due_date || null,
        notes: notes || null,
        status: 'pending',
        created_by: userId,  // Track who created the IOU
      })
      .select(`
        *,
        debtor:users!ious_debtor_id_fkey(*),
        creditor:users!ious_creditor_id_fkey(*)
      `)
      .single()

    if (error) throw error

    res.json({ success: true, data })
  } catch (error) {
    console.error('Create UOMe error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to create UOMe' },
    })
  }
})

// Add a payment to an IOU
router.post('/:id/payments', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId
  const { id } = req.params
  const { amount, description } = req.body

  if (!description) {
    res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'description is required' },
    })
    return
  }

  try {
    // Verify user is involved in the IOU
    const { data: iou } = await supabase
      .from('ious')
      .select('*')
      .eq('id', id)
      .or(`debtor_id.eq.${userId},creditor_id.eq.${userId}`)
      .single()

    if (!iou) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'IOU not found or access denied' },
      })
      return
    }

    if (iou.status !== 'active') {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_STATUS', message: 'Can only add payments to active IOUs' },
      })
      return
    }

    // Create the payment
    const { data: payment, error } = await supabase
      .from('payments')
      .insert({
        iou_id: id,
        amount: amount || null,
        description,
        created_by: userId,
      })
      .select()
      .single()

    if (error) throw error

    res.json({ success: true, data: payment })
  } catch (error) {
    console.error('Add payment error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to add payment' },
    })
  }
})

// Accept IOU (non-creator accepts)
router.post('/:id/accept', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId
  const { id } = req.params

  try {
    // First, get the IOU to check who can accept it
    const { data: iou } = await supabase
      .from('ious')
      .select('*')
      .eq('id', id)
      .eq('status', 'pending')
      .single()

    if (!iou) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'IOU not found or already processed' },
      })
      return
    }

    // User must be involved (debtor or creditor) but NOT the creator
    const isInvolved = iou.debtor_id === userId || iou.creditor_id === userId
    const isCreator = iou.created_by === userId

    if (!isInvolved || isCreator) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You cannot accept this IOU' },
      })
      return
    }

    const { data, error } = await supabase
      .from('ious')
      .update({ status: 'active' })
      .eq('id', id)
      .select(`
        *,
        debtor:users!ious_debtor_id_fkey(*),
        creditor:users!ious_creditor_id_fkey(*)
      `)
      .single()

    if (error) throw error

    res.json({ success: true, data })
  } catch (error) {
    console.error('Accept IOU error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to accept IOU' },
    })
  }
})

// Decline IOU (non-creator declines)
router.post('/:id/decline', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId
  const { id } = req.params

  try {
    // First, get the IOU to check who can decline it
    const { data: iou } = await supabase
      .from('ious')
      .select('*')
      .eq('id', id)
      .eq('status', 'pending')
      .single()

    if (!iou) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'IOU not found or already processed' },
      })
      return
    }

    // User must be involved (debtor or creditor) but NOT the creator
    const isInvolved = iou.debtor_id === userId || iou.creditor_id === userId
    const isCreator = iou.created_by === userId

    if (!isInvolved || isCreator) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You cannot decline this IOU' },
      })
      return
    }

    const { data, error } = await supabase
      .from('ious')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    res.json({ success: true, data })
  } catch (error) {
    console.error('Decline IOU error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to decline IOU' },
    })
  }
})

// Mark IOU as paid (by creditor - the person who was owed)
router.post('/:id/mark-paid', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId
  const { id } = req.params

  try {
    const { data, error } = await supabase
      .from('ious')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('creditor_id', userId)  // Only creditor can mark as paid
      .eq('status', 'active')
      .select(`
        *,
        debtor:users!ious_debtor_id_fkey(*),
        creditor:users!ious_creditor_id_fkey(*)
      `)
      .single()

    if (error) throw error
    if (!data) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'IOU not found or not in active status' },
      })
      return
    }

    res.json({ success: true, data })
  } catch (error) {
    console.error('Mark paid error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to mark IOU as paid' },
    })
  }
})


// Cancel IOU (only pending ones by creator)
router.delete('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId
  const { id } = req.params

  try {
    const { error } = await supabase
      .from('ious')
      .delete()
      .eq('id', id)
      .eq('debtor_id', userId)
      .eq('status', 'pending')

    if (error) throw error

    res.json({ success: true })
  } catch (error) {
    console.error('Cancel IOU error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to cancel IOU' },
    })
  }
})

export default router
