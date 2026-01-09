import { Router, Response } from 'express'
import { supabase } from '../services/supabase.js'
import { authMiddleware } from '../middleware/auth.js'
import { AuthenticatedRequest } from '../types/index.js'
import logger from '../utils/logger.js'
import { userFriendshipsOrClause } from '../utils/friendships.js'
import { DEFAULT_FEED_LIMIT } from '../utils/constants.js'

const router = Router()

// All routes require authentication
router.use(authMiddleware)

// Get feed items (public IOUs from user and their friends)
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId

  try {
    // First check if user has feed enabled
    const { data: currentUser } = await supabase
      .from('users')
      .select('feed_visible')
      .eq('id', userId)
      .single()

    if (!currentUser?.feed_visible) {
      res.status(403).json({
        success: false,
        error: { code: 'FEED_DISABLED', message: 'Feed is disabled for your account' },
      })
      return
    }

    // Get user's friends list
    const { data: friendships } = await supabase
      .from('friendships')
      .select('requester_id, addressee_id')
      .or(userFriendshipsOrClause(userId))
      .eq('status', 'accepted')

    const friendIds = (friendships || []).map((f) =>
      f.requester_id === userId ? f.addressee_id : f.requester_id
    )

    // Include self in the list
    const relevantUserIds = [userId, ...friendIds]

    // Get public IOUs where user or friends are involved
    // Also filter out IOUs from users who have feed_visible = false
    const { data: ious, error } = await supabase
      .from('ious')
      .select(`
        *,
        debtor:users!ious_debtor_id_fkey(id, username, profile_pic_url, feed_visible),
        creditor:users!ious_creditor_id_fkey(id, username, profile_pic_url, feed_visible)
      `)
      .eq('visibility', 'public')
      .in('status', ['active', 'paid'])
      .or(`debtor_id.in.(${relevantUserIds.join(',')}),creditor_id.in.(${relevantUserIds.join(',')})`)
      .order('created_at', { ascending: false })
      .limit(DEFAULT_FEED_LIMIT)

    if (error) throw error

    // Filter out IOUs where either party has feed disabled
    const filteredIOUs = (ious || []).filter(
      (iou) => iou.debtor?.feed_visible !== false && iou.creditor?.feed_visible !== false
    )

    // Get reaction counts for these IOUs
    const iouIds = filteredIOUs.map((iou) => iou.id)

    let reactionCounts: Record<string, { up: number; down: number }> = {}
    let userReactions: Record<string, string> = {}

    if (iouIds.length > 0) {
      // Get counts
      const { data: reactions } = await supabase
        .from('feed_reactions')
        .select('iou_id, reaction_type')
        .in('iou_id', iouIds)

      // Count reactions per IOU
      for (const reaction of reactions || []) {
        if (!reactionCounts[reaction.iou_id]) {
          reactionCounts[reaction.iou_id] = { up: 0, down: 0 }
        }
        if (reaction.reaction_type === 'up') {
          reactionCounts[reaction.iou_id].up++
        } else {
          reactionCounts[reaction.iou_id].down++
        }
      }

      // Get current user's reactions
      const { data: myReactions } = await supabase
        .from('feed_reactions')
        .select('iou_id, reaction_type')
        .eq('user_id', userId)
        .in('iou_id', iouIds)

      for (const reaction of myReactions || []) {
        userReactions[reaction.iou_id] = reaction.reaction_type
      }
    }

    // Combine data
    const feedItems = filteredIOUs.map((iou) => ({
      ...iou,
      reactions: reactionCounts[iou.id] || { up: 0, down: 0 },
      userReaction: userReactions[iou.id] || null,
    }))

    res.json({ success: true, data: feedItems })
  } catch (error) {
    logger.error('Get feed error', error)
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to fetch feed' },
    })
  }
})

// Add or update reaction
router.post('/:iouId/react', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId
  const { iouId } = req.params
  const { reaction_type } = req.body

  if (!reaction_type || !['up', 'down'].includes(reaction_type)) {
    res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'reaction_type must be "up" or "down"' },
    })
    return
  }

  try {
    // Upsert reaction (insert or update if exists)
    const { data, error } = await supabase
      .from('feed_reactions')
      .upsert(
        {
          user_id: userId,
          iou_id: iouId,
          reaction_type,
        },
        { onConflict: 'user_id,iou_id' }
      )
      .select()
      .single()

    if (error) throw error

    res.json({ success: true, data })
  } catch (error) {
    logger.error('Add reaction error', error)
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to add reaction' },
    })
  }
})

// Remove reaction
router.delete('/:iouId/react', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId
  const { iouId } = req.params

  try {
    const { error } = await supabase
      .from('feed_reactions')
      .delete()
      .eq('user_id', userId)
      .eq('iou_id', iouId)

    if (error) throw error

    res.json({ success: true })
  } catch (error) {
    logger.error('Remove reaction error', error)
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to remove reaction' },
    })
  }
})

export default router
