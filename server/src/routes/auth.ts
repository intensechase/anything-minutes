import { Router, Response } from 'express'
import admin from 'firebase-admin'
import { supabase } from '../services/supabase.js'
import { AuthenticatedRequest } from '../types/index.js'
import logger from '../utils/logger.js'

const router = Router()

// Strip sensitive fields from user object for API responses
function sanitizeUser(user: Record<string, unknown>) {
  const { email, phone, firebase_uid, ...safeFields } = user
  return safeFields
}

// Login / Create user on first login
router.post('/login', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'No token provided' },
    })
    return
  }

  const token = authHeader.split('Bearer ')[1]

  try {
    const decodedToken = await admin.auth().verifyIdToken(token)
    const { uid, email, name, picture } = decodedToken

    // Check if user exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('firebase_uid', uid)
      .single()

    if (existingUser) {
      res.json({ success: true, data: sanitizeUser(existingUser) })
      return
    }

    // Create new user with temporary username
    const tempUsername = `user_${uid.slice(0, 8)}_${Date.now().toString(36)}`

    const { data: newUser, error } = await supabase
      .from('users')
      .insert({
        firebase_uid: uid,
        username: tempUsername,
        email: email || null,
        profile_pic_url: picture || null,
        street_cred_visibility: 'friends_only',
        setup_complete: false,
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    res.json({ success: true, data: sanitizeUser(newUser) })
  } catch (error) {
    logger.error('Login error', error)
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to authenticate' },
    })
  }
})

export default router
