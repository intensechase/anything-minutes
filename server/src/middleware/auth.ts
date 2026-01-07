import { Response, NextFunction } from 'express'
import admin from 'firebase-admin'
import { AuthenticatedRequest } from '../types/index.js'
import { supabase } from '../services/supabase.js'

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  })
}

export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
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

    // Get user from database
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('firebase_uid', decodedToken.uid)
      .single()

    req.user = {
      uid: decodedToken.uid,
      userId: user?.id || '',
    }

    next()
  } catch (error) {
    console.error('Auth error:', error)
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Invalid token' },
    })
  }
}
