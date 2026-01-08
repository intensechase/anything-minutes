import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import authRoutes from './routes/auth.js'
import friendsRoutes from './routes/friends.js'
import usersRoutes from './routes/users.js'
import iousRoutes from './routes/ious.js'
import profileRoutes from './routes/profile.js'
import feedRoutes from './routes/feed.js'
import recurringRoutes from './routes/recurring.js'
import blockingRoutes from './routes/blocking.js'

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(helmet())

const allowedOrigins = [
  'https://www.anythingminutes.com',
  'https://anythingminutes.com',
  'http://localhost:5173',
  'http://localhost:3000'
]

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true)
    if (allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true
}))
app.use(express.json({ limit: '1mb' }))

// Rate limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later' } }
})

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many auth attempts, please try again later' } }
})

const searchLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 searches per minute
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many searches, please slow down' } }
})

// Apply general rate limit to all routes
app.use('/api/', generalLimiter)

// Routes
app.use('/api/auth', authLimiter, authRoutes)
app.use('/api/friends', friendsRoutes)
app.use('/api/users/search', searchLimiter)
app.use('/api/users', usersRoutes)
app.use('/api/ious', iousRoutes)
app.use('/api/profile', profileRoutes)
app.use('/api/feed', feedRoutes)
app.use('/api/recurring', recurringRoutes)
app.use('/api/blocked', blockingRoutes)

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
