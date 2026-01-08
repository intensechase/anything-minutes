import { Router, Response } from 'express'
import { supabase } from '../services/supabase.js'
import { authMiddleware } from '../middleware/auth.js'
import { AuthenticatedRequest, StreetCred } from '../types/index.js'

const router = Router()

// All routes require authentication
router.use(authMiddleware)

// Helper to validate username format
const isValidUsername = (username: string): { valid: boolean; error?: string } => {
  if (username.length < 3 || username.length > 20) {
    return { valid: false, error: 'Username must be 3-20 characters' }
  }
  if (!/^[a-z0-9_.]+$/.test(username)) {
    return { valid: false, error: 'Username can only contain lowercase letters, numbers, periods, and underscores' }
  }
  if (username.startsWith('.') || username.endsWith('.') || username.includes('..')) {
    return { valid: false, error: 'Username cannot start or end with a period, or have consecutive periods' }
  }
  return { valid: true }
}

// Helper to validate first name format
const isValidFirstName = (firstName: string): { valid: boolean; error?: string } => {
  if (firstName.length < 1 || firstName.length > 20) {
    return { valid: false, error: 'First name must be 1-20 characters' }
  }
  // Allow letters including accented characters
  if (!/^[\p{L}]+$/u.test(firstName)) {
    return { valid: false, error: 'First name can only contain letters' }
  }
  return { valid: true }
}

// Helper to capitalize first letter
const capitalizeFirstName = (name: string): string => {
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase()
}

// Helper to generate username suggestions
const generateUsernameSuggestions = async (baseUsername: string): Promise<string[]> => {
  const suggestions: string[] = []
  const variations = [
    `${baseUsername}1`,
    `${baseUsername}2`,
    `${baseUsername}_1`,
    `${baseUsername}_2`,
    `${baseUsername}${Math.floor(Math.random() * 100)}`,
    `${baseUsername}${Math.floor(Math.random() * 1000)}`,
    `${baseUsername}.1`,
    `${baseUsername}.2`,
  ]

  // Check which ones are available
  for (const variation of variations) {
    if (suggestions.length >= 3) break
    const { data } = await supabase
      .from('users')
      .select('id')
      .eq('username', variation)
      .single()
    if (!data) {
      suggestions.push(variation)
    }
  }

  return suggestions
}

// Check if username is available
router.get('/check-username/:username', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { username } = req.params
  const userId = req.user!.userId
  const trimmedUsername = username.trim().toLowerCase()

  // Validate format
  const validation = isValidUsername(trimmedUsername)
  if (!validation.valid) {
    res.json({
      success: true,
      data: { available: false, error: validation.error, suggestions: [] }
    })
    return
  }

  try {
    // Check if taken
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('username', trimmedUsername)
      .neq('id', userId)
      .single()

    if (existingUser) {
      const suggestions = await generateUsernameSuggestions(trimmedUsername)
      res.json({
        success: true,
        data: { available: false, error: 'Username is already taken', suggestions }
      })
      return
    }

    res.json({
      success: true,
      data: { available: true }
    })
  } catch (error) {
    console.error('Check username error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to check username' }
    })
  }
})

// Complete profile (for new users and existing users missing first_name)
router.post('/complete', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId
  const { first_name, username } = req.body

  if (!first_name || !username) {
    res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'First name and username are required' }
    })
    return
  }

  // Validate first name
  const firstNameValidation = isValidFirstName(first_name.trim())
  if (!firstNameValidation.valid) {
    res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: firstNameValidation.error }
    })
    return
  }

  // Validate username
  const trimmedUsername = username.trim().toLowerCase()
  const usernameValidation = isValidUsername(trimmedUsername)
  if (!usernameValidation.valid) {
    res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: usernameValidation.error }
    })
    return
  }

  try {
    // Check if username is taken
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('username', trimmedUsername)
      .neq('id', userId)
      .single()

    if (existingUser) {
      const suggestions = await generateUsernameSuggestions(trimmedUsername)
      res.status(400).json({
        success: false,
        error: { code: 'USERNAME_TAKEN', message: 'Username is already taken', suggestions }
      })
      return
    }

    // Update user profile
    const { data, error } = await supabase
      .from('users')
      .update({
        first_name: capitalizeFirstName(first_name.trim()),
        username: trimmedUsername,
        profile_complete: true,
        setup_complete: true,
        username_changed_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single()

    if (error) throw error

    res.json({ success: true, data })
  } catch (error) {
    console.error('Complete profile error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to complete profile' }
    })
  }
})

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

// Get user profile by ID (excludes email/phone for privacy)
router.get('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params

  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, username, first_name, profile_pic_url, street_cred_visibility, created_at')
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
  const { street_cred_visibility, username, feed_visible, first_name } = req.body

  try {
    // Get current user data for username change check
    const { data: currentUser } = await supabase
      .from('users')
      .select('username, username_changed_at')
      .eq('id', userId)
      .single()

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

    // Handle feed visibility toggle
    if (typeof feed_visible === 'boolean') {
      updates.feed_visible = feed_visible
    }

    // Handle first name update
    if (first_name !== undefined) {
      const trimmedFirstName = first_name.trim()
      const validation = isValidFirstName(trimmedFirstName)
      if (!validation.valid) {
        res.status(400).json({
          success: false,
          error: { code: 'BAD_REQUEST', message: validation.error },
        })
        return
      }
      updates.first_name = capitalizeFirstName(trimmedFirstName)
    }

    if (username) {
      // Validate username format
      const trimmedUsername = username.trim().toLowerCase()
      const validation = isValidUsername(trimmedUsername)
      if (!validation.valid) {
        res.status(400).json({
          success: false,
          error: { code: 'BAD_REQUEST', message: validation.error },
        })
        return
      }

      // Check if username is actually changing
      if (currentUser && currentUser.username !== trimmedUsername) {
        // Check 30-day limit
        if (currentUser.username_changed_at) {
          const lastChanged = new Date(currentUser.username_changed_at)
          const thirtyDaysAgo = new Date()
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

          if (lastChanged > thirtyDaysAgo) {
            const nextChangeDate = new Date(lastChanged)
            nextChangeDate.setDate(nextChangeDate.getDate() + 30)
            res.status(400).json({
              success: false,
              error: {
                code: 'USERNAME_CHANGE_LIMIT',
                message: `You can change your username again on ${nextChangeDate.toLocaleDateString()}`
              },
            })
            return
          }
        }

        // Check if username is already taken
        const { data: existingUser } = await supabase
          .from('users')
          .select('id')
          .eq('username', trimmedUsername)
          .neq('id', userId)
          .single()

        if (existingUser) {
          const suggestions = await generateUsernameSuggestions(trimmedUsername)
          res.status(400).json({
            success: false,
            error: { code: 'USERNAME_TAKEN', message: 'This username is already taken', suggestions },
          })
          return
        }

        updates.username = trimmedUsername
        updates.username_changed_at = new Date().toISOString()
      }
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
