import { Router, Response } from 'express'
import { supabase } from '../services/supabase.js'
import { authMiddleware } from '../middleware/auth.js'
import { AuthenticatedRequest, StreetCred } from '../types/index.js'

const router = Router()

// All routes require authentication
router.use(authMiddleware)

// Get current user's profile
router.get('/me', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId

  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) throw error
    if (!data) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' },
      })
      return
    }

    res.json({ success: true, data })
  } catch (error) {
    console.error('Get profile error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to fetch profile' },
    })
  }
})

// Get user profile by ID
router.get('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params

  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, username, email, profile_pic_url, street_cred_visibility, created_at')
      .eq('id', id)
      .single()

    if (error) throw error
    if (!data) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' },
      })
      return
    }

    res.json({ success: true, data })
  } catch (error) {
    console.error('Get user profile error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to fetch user profile' },
    })
  }
})

// Update profile settings
router.put('/settings', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId
  const { street_cred_visibility, username } = req.body

  try {
    const updates: Record<string, unknown> = {}

    if (street_cred_visibility) {
      if (!['private', 'friends_only', 'public'].includes(street_cred_visibility)) {
        res.status(400).json({
          success: false,
          error: { code: 'BAD_REQUEST', message: 'Invalid visibility setting' },
        })
        return
      }
      updates.street_cred_visibility = street_cred_visibility
    }

    if (username) {
      // Validate username format
      const trimmedUsername = username.trim().toLowerCase()
      if (trimmedUsername.length < 3 || trimmedUsername.length > 20) {
        res.status(400).json({
          success: false,
          error: { code: 'BAD_REQUEST', message: 'Username must be 3-20 characters' },
        })
        return
      }
      if (!/^[a-z0-9_]+$/.test(trimmedUsername)) {
        res.status(400).json({
          success: false,
          error: { code: 'BAD_REQUEST', message: 'Username can only contain letters, numbers, and underscores' },
        })
        return
      }

      // Check if username is already taken
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('username', trimmedUsername)
        .neq('id', userId)
        .single()

      if (existingUser) {
        res.status(400).json({
          success: false,
          error: { code: 'USERNAME_TAKEN', message: 'This alias is already taken' },
        })
        return
      }

      updates.username = trimmedUsername
      updates.setup_complete = true
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'No valid updates provided' },
      })
      return
    }

    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single()

    if (error) throw error

    res.json({ success: true, data })
  } catch (error) {
    console.error('Update profile error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to update profile' },
    })
  }
})

// Get street cred for user
router.get('/:id/street-cred', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId
  const { id } = req.params

  try {
    // Get user's visibility settings
    const { data: targetUser } = await supabase
      .from('users')
      .select('street_cred_visibility')
      .eq('id', id)
      .single()

    if (!targetUser) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' },
      })
      return
    }

    // Check visibility permissions
    if (id !== userId) {
      if (targetUser.street_cred_visibility === 'private') {
        res.json({
          success: true,
          data: null,
        })
        return
      }

      if (targetUser.street_cred_visibility === 'friends_only') {
        // Check if they are friends
        const { data: friendship } = await supabase
          .from('friendships')
          .select('*')
          .or(
            `and(requester_id.eq.${userId},addressee_id.eq.${id}),and(requester_id.eq.${id},addressee_id.eq.${userId})`
          )
          .eq('status', 'accepted')
          .single()

        if (!friendship) {
          res.json({
            success: true,
            data: null,
          })
          return
        }
      }
    }

    // Calculate street cred
    const { data: ious, error } = await supabase
      .from('ious')
      .select('status')
      .eq('debtor_id', id)
      .in('status', ['active', 'payment_pending', 'paid', 'cancelled'])

    if (error) throw error

    const streetCred: StreetCred = {
      debts_paid: ious?.filter((i) => i.status === 'paid').length || 0,
      total_debts: ious?.length || 0,
      outstanding_debts: ious?.filter((i) => i.status === 'active' || i.status === 'payment_pending').length || 0,
    }

    res.json({ success: true, data: streetCred })
  } catch (error) {
    console.error('Get street cred error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to fetch street cred' },
    })
  }
})

export default router
