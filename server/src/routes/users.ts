import { Router, Response } from 'express'
import { supabase } from '../services/supabase.js'
import { authMiddleware } from '../middleware/auth.js'
import { AuthenticatedRequest } from '../types/index.js'

const router = Router()

// All routes require authentication
router.use(authMiddleware)

// Search users
router.get('/search', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { q } = req.query

  if (!q || typeof q !== 'string') {
    res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'Search query is required' },
    })
    return
  }

  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, username, email, profile_pic_url')
      .or(`username.ilike.%${q}%,email.ilike.%${q}%`)
      .limit(20)

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
