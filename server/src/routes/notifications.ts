import { Router, Response } from 'express'
import { supabase } from '../services/supabase.js'
import { authMiddleware } from '../middleware/auth.js'
import { AuthenticatedRequest } from '../types/index.js'
import logger from '../utils/logger.js'

const router = Router()

// All routes require authentication
router.use(authMiddleware)

// Get user's notifications
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId
  const { limit = 20, unread_only } = req.query

  try {
    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(Number(limit))

    if (unread_only === 'true') {
      query = query.eq('read', false)
    }

    const { data, error } = await query

    if (error) throw error

    res.json({ success: true, data })
  } catch (error) {
    logger.error('Get notifications error', error)
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to fetch notifications' },
    })
  }
})

// Get unread count
router.get('/unread-count', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId

  try {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false)

    if (error) throw error

    res.json({ success: true, data: { count: count || 0 } })
  } catch (error) {
    logger.error('Get unread count error', error)
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to fetch unread count' },
    })
  }
})

// Mark notification as read
router.post('/:id/read', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId
  const { id } = req.params

  try {
    const { data, error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) throw error

    res.json({ success: true, data })
  } catch (error) {
    logger.error('Mark read error', error)
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to mark notification as read' },
    })
  }
})

// Mark all notifications as read
router.post('/read-all', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId

  try {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false)

    if (error) throw error

    res.json({ success: true, message: 'All notifications marked as read' })
  } catch (error) {
    logger.error('Mark all read error', error)
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to mark notifications as read' },
    })
  }
})

export default router
