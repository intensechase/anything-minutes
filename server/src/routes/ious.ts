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
        creditor:users!ious_creditor_id_fkey(*)
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

    res.json({ success: true, data })
  } catch (error) {
    console.error('Get IOUs error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to fetch IOUs' },
    })
  }
})

// Create IOU
router.post('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId
  const { creditor_id, description, visibility, due_date, notes } = req.body

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
        visibility: visibility || 'private',
        due_date: due_date || null,
        notes: notes || null,
        status: 'pending',
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

// Accept IOU
router.post('/:id/accept', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId
  const { id } = req.params

  try {
    const { data, error } = await supabase
      .from('ious')
      .update({ status: 'active' })
      .eq('id', id)
      .eq('creditor_id', userId)
      .eq('status', 'pending')
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
        error: { code: 'NOT_FOUND', message: 'IOU not found or already processed' },
      })
      return
    }

    res.json({ success: true, data })
  } catch (error) {
    console.error('Accept IOU error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to accept IOU' },
    })
  }
})

// Decline IOU
router.post('/:id/decline', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId
  const { id } = req.params

  try {
    const { data, error } = await supabase
      .from('ious')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .eq('creditor_id', userId)
      .eq('status', 'pending')
      .select()
      .single()

    if (error) throw error
    if (!data) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'IOU not found or already processed' },
      })
      return
    }

    res.json({ success: true, data })
  } catch (error) {
    console.error('Decline IOU error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to decline IOU' },
    })
  }
})

// Mark IOU as paid (by debtor)
router.post('/:id/mark-paid', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId
  const { id } = req.params

  try {
    const { data, error } = await supabase
      .from('ious')
      .update({ status: 'payment_pending' })
      .eq('id', id)
      .eq('debtor_id', userId)
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

// Confirm payment (by creditor)
router.post('/:id/confirm-paid', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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
      .eq('creditor_id', userId)
      .eq('status', 'payment_pending')
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
        error: { code: 'NOT_FOUND', message: 'IOU not found or not pending confirmation' },
      })
      return
    }

    res.json({ success: true, data })
  } catch (error) {
    console.error('Confirm paid error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to confirm payment' },
    })
  }
})

// Dispute payment (by creditor)
router.post('/:id/dispute', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId
  const { id } = req.params

  try {
    const { data, error } = await supabase
      .from('ious')
      .update({ status: 'active' })
      .eq('id', id)
      .eq('creditor_id', userId)
      .eq('status', 'payment_pending')
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
        error: { code: 'NOT_FOUND', message: 'IOU not found or not pending confirmation' },
      })
      return
    }

    res.json({ success: true, data })
  } catch (error) {
    console.error('Dispute payment error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to dispute payment' },
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
