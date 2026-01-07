import { Router, Response } from 'express'
import admin from 'firebase-admin'
import { supabase } from '../services/supabase.js'
import { AuthenticatedRequest } from '../types/index.js'

const router = Router()

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
      res.json({ success: true, data: existingUser })
      return
    }

    // Create new user
    const username = email?.split('@')[0] || `user_${uid.slice(0, 8)}`

    const { data: newUser, error } = await supabase
      .from('users')
      .insert({
        firebase_uid: uid,
        username: username,
        email: email || null,
        profile_pic_url: picture || null,
        street_cred_visibility: 'friends_only',
      })
      .select()
      .single()

    if (error) {
      // Handle unique constraint violation for username
      if (error.code === '23505') {
        const uniqueUsername = `${username}_${Date.now().toString(36)}`
        const { data: retryUser, error: retryError } = await supabase
          .from('users')
          .insert({
            firebase_uid: uid,
            username: uniqueUsername,
            email: email || null,
            profile_pic_url: picture || null,
            street_cred_visibility: 'friends_only',
          })
          .select()
          .single()

        if (retryError) throw retryError
        res.json({ success: true, data: retryUser })
        return
      }
      throw error
    }

    res.json({ success: true, data: newUser })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to authenticate' },
    })
  }
})

export default router
