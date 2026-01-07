import { Router, Response } from 'express'
import { supabase } from '../services/supabase.js'
import { authMiddleware } from '../middleware/auth.js'
import { AuthenticatedRequest } from '../types/index.js'

const router = Router()

// All routes require authentication
router.use(authMiddleware)

// Get friendship status with a specific user
router.get('/status/:userId', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const currentUserId = req.user!.userId
  const { userId } = req.params

  try {
    const { data, error } = await supabase
      .from('friendships')
      .select('*')
      .or(
        `and(requester_id.eq.${currentUserId},addressee_id.eq.${userId}),and(requester_id.eq.${userId},addressee_id.eq.${currentUserId})`
      )
      .single()

    if (error && error.code !== 'PGRST116') throw error // PGRST116 = no rows

    if (!data) {
      res.json({ success: true, data: { status: 'none' } })
      return
    }

    // Determine relationship from current user's perspective
    const isSender = data.requester_id === currentUserId
    let status: string

    if (data.status === 'accepted') {
      status = 'friends'
    } else if (data.status === 'pending') {
      status = isSender ? 'request_sent' : 'request_received'
    } else {
      status = 'none'
    }

    res.json({
      success: true,
      data: {
        status,
        friendship_id: data.id,
      },
    })
  } catch (error) {
    console.error('Get friendship status error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to get friendship status' },
    })
  }
})

// Get all friendships (accepted)
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId

  try {
    const { data, error } = await supabase
      .from('friendships')
      .select(`
        *,
        requester:users!friendships_requester_id_fkey(*),
        addressee:users!friendships_addressee_id_fkey(*)
      `)
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
      .eq('status', 'accepted')

    if (error) throw error

    res.json({ success: true, data })
  } catch (error) {
    console.error('Get friends error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to fetch friends' },
    })
  }
})

// Get pending friend requests (received)
router.get('/requests', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId

  try {
    const { data, error } = await supabase
      .from('friendships')
      .select(`
        *,
        requester:users!friendships_requester_id_fkey(*),
        addressee:users!friendships_addressee_id_fkey(*)
      `)
      .eq('addressee_id', userId)
      .eq('status', 'pending')

    if (error) throw error

    res.json({ success: true, data })
  } catch (error) {
    console.error('Get friend requests error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to fetch friend requests' },
    })
  }
})

// Send friend request
router.post('/request', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId
  const { addressee_id } = req.body

  if (!addressee_id) {
    res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'addressee_id is required' },
    })
    return
  }

  try {
    // Check if friendship already exists
    const { data: existing } = await supabase
      .from('friendships')
      .select('*')
      .or(
        `and(requester_id.eq.${userId},addressee_id.eq.${addressee_id}),and(requester_id.eq.${addressee_id},addressee_id.eq.${userId})`
      )
      .single()

    if (existing) {
      res.status(400).json({
        success: false,
        error: { code: 'ALREADY_EXISTS', message: 'Friendship already exists' },
      })
      return
    }

    const { data, error } = await supabase
      .from('friendships')
      .insert({
        requester_id: userId,
        addressee_id,
        status: 'pending',
      })
      .select(`
        *,
        requester:users!friendships_requester_id_fkey(*),
        addressee:users!friendships_addressee_id_fkey(*)
      `)
      .single()

    if (error) throw error

    res.json({ success: true, data })
  } catch (error) {
    console.error('Send friend request error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to send friend request' },
    })
  }
})

// Accept friend request
router.post('/:id/accept', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId
  const { id } = req.params

  try {
    const { data, error } = await supabase
      .from('friendships')
      .update({ status: 'accepted', updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('addressee_id', userId)
      .eq('status', 'pending')
      .select(`
        *,
        requester:users!friendships_requester_id_fkey(*),
        addressee:users!friendships_addressee_id_fkey(*)
      `)
      .single()

    if (error) throw error
    if (!data) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Friend request not found' },
      })
      return
    }

    res.json({ success: true, data })
  } catch (error) {
    console.error('Accept friend request error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to accept friend request' },
    })
  }
})

// Decline friend request
router.post('/:id/decline', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId
  const { id } = req.params

  try {
    const { data, error } = await supabase
      .from('friendships')
      .update({ status: 'declined', updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('addressee_id', userId)
      .eq('status', 'pending')
      .select()
      .single()

    if (error) throw error
    if (!data) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Friend request not found' },
      })
      return
    }

    res.json({ success: true, data })
  } catch (error) {
    console.error('Decline friend request error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to decline friend request' },
    })
  }
})

// Remove friend
router.delete('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId
  const { id } = req.params

  try {
    const { error } = await supabase
      .from('friendships')
      .delete()
      .eq('id', id)
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)

    if (error) throw error

    res.json({ success: true })
  } catch (error) {
    console.error('Remove friend error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to remove friend' },
    })
  }
})

export default router
