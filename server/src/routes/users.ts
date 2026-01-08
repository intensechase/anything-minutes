import { Router, Response } from 'express'
import { supabase } from '../services/supabase.js'
import { authMiddleware } from '../middleware/auth.js'
import { AuthenticatedRequest } from '../types/index.js'

const router = Router()

// All routes require authentication
router.use(authMiddleware)

// Search users
router.get('/search', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId
  const { q } = req.query

  if (!q || typeof q !== 'string') {
    res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'Search query is required' },
    })
    return
  }

  try {
    // Get list of blocked users (both directions)
    const { data: blockedByMe } = await supabase
      .from('blocked_users')
      .select('blocked_id')
      .eq('blocker_id', userId)

    const { data: blockedMe } = await supabase
      .from('blocked_users')
      .select('blocker_id')
      .eq('blocked_id', userId)

    const blockedIds = [
      ...(blockedByMe?.map(b => b.blocked_id) || []),
      ...(blockedMe?.map(b => b.blocker_id) || [])
    ]

    // Search by username, email, or first_name but don't return email/phone (privacy)
    let query = supabase
      .from('users')
      .select('id, username, first_name, profile_pic_url')
      .or(`username.ilike.%${q}%,email.ilike.%${q}%,first_name.ilike.%${q}%`)
      .eq('hide_from_search', false)
      .neq('id', userId)
      .limit(20)

    // Exclude blocked users if any
    if (blockedIds.length > 0) {
      query = query.not('id', 'in', `(${blockedIds.join(',')})`)
    }

    const { data, error } = await query

    if (error) throw error

    res.json({ success: true, data })
  } catch (error) {
    console.error('Search users error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to search users' },
    })
  }
})

export default router
