import { Router, Response } from 'express'
import { supabase } from '../services/supabase.js'
import { authMiddleware } from '../middleware/auth.js'
import { AuthenticatedRequest } from '../types/index.js'

const router = Router()

// All routes require authentication
router.use(authMiddleware)

// Get blocked users list
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId

  try {
    const { data, error } = await supabase
      .from('blocked_users')
      .select(`
        id,
        blocked_id,
        created_at,
        blocked_user:users!blocked_id(id, username, first_name, profile_pic_url)
      `)
      .eq('blocker_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error

    res.json({ success: true, data })
  } catch (error) {
    console.error('Get blocked users error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to fetch blocked users' },
    })
  }
})

// Block a user
router.post('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId
  const { id: blockedId } = req.params

  // Can't block yourself
  if (userId === blockedId) {
    res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'You cannot block yourself' },
    })
    return
  }

  try {
    // Check if user exists
    const { data: targetUser } = await supabase
      .from('users')
      .select('id')
      .eq('id', blockedId)
      .single()

    if (!targetUser) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' },
      })
      return
    }

    // Check if already blocked
    const { data: existingBlock } = await supabase
      .from('blocked_users')
      .select('id')
      .eq('blocker_id', userId)
      .eq('blocked_id', blockedId)
      .single()

    if (existingBlock) {
      res.status(400).json({
        success: false,
        error: { code: 'ALREADY_BLOCKED', message: 'User is already blocked' },
      })
      return
    }

    // Create the block
    const { data, error } = await supabase
      .from('blocked_users')
      .insert({ blocker_id: userId, blocked_id: blockedId })
      .select()
      .single()

    if (error) throw error

    // Remove any existing friendship between the two users
    await supabase
      .from('friendships')
      .delete()
      .or(
        `and(requester_id.eq.${userId},addressee_id.eq.${blockedId}),and(requester_id.eq.${blockedId},addressee_id.eq.${userId})`
      )

    res.json({ success: true, data })
  } catch (error) {
    console.error('Block user error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to block user' },
    })
  }
})

// Unblock a user
router.delete('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId
  const { id: blockedId } = req.params

  try {
    const { error } = await supabase
      .from('blocked_users')
      .delete()
      .eq('blocker_id', userId)
      .eq('blocked_id', blockedId)

    if (error) throw error

    res.json({ success: true })
  } catch (error) {
    console.error('Unblock user error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to unblock user' },
    })
  }
})

// Check if a specific user is blocked
router.get('/check/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId
  const { id: targetId } = req.params

  try {
    const { data } = await supabase
      .from('blocked_users')
      .select('id')
      .eq('blocker_id', userId)
      .eq('blocked_id', targetId)
      .single()

    res.json({ success: true, data: { isBlocked: !!data } })
  } catch (error) {
    console.error('Check blocked status error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to check blocked status' },
    })
  }
})

export default router
