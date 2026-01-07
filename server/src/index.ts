import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import authRoutes from './routes/auth.js'
import friendsRoutes from './routes/friends.js'
import usersRoutes from './routes/users.js'
import iousRoutes from './routes/ious.js'
import profileRoutes from './routes/profile.js'
import feedRoutes from './routes/feed.js'

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors())
app.use(express.json())

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/friends', friendsRoutes)
app.use('/api/users', usersRoutes)
app.use('/api/ious', iousRoutes)
app.use('/api/profile', profileRoutes)
app.use('/api/feed', feedRoutes)

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
