import { Router, Response } from 'express'
import { supabase } from '../services/supabase.js'
import { authMiddleware } from '../middleware/auth.js'
import { AuthenticatedRequest, RecurringIOUUpdate, RecurringFrequency } from '../types/index.js'
import logger from '../utils/logger.js'
import { getAcceptedFriendship } from '../utils/friendships.js'
import { validateAmount } from '../utils/constants.js'

const router = Router()

// All routes require authentication
router.use(authMiddleware)

// Helper to calculate next due date
function calculateNextDueDate(frequency: 'weekly' | 'monthly', dayOfWeek?: number, dayOfMonth?: number): Date {
  const now = new Date()
  const next = new Date()

  if (frequency === 'weekly' && dayOfWeek !== undefined) {
    // Find next occurrence of the day of week
    const currentDay = now.getDay()
    let daysUntil = dayOfWeek - currentDay
    if (daysUntil <= 0) {
      daysUntil += 7  // Move to next week
    }
    next.setDate(now.getDate() + daysUntil)
  } else if (frequency === 'monthly' && dayOfMonth !== undefined) {
    // Find next occurrence of the day of month
    next.setDate(dayOfMonth)
    if (next <= now) {
      next.setMonth(next.getMonth() + 1)
    }
    // Handle months with fewer days
    while (next.getDate() !== dayOfMonth) {
      next.setDate(0) // Go to last day of previous month
    }
  }

  // Set to noon to avoid timezone issues
  next.setHours(12, 0, 0, 0)
  return next
}

// Get all recurring IOUs for user
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId

  try {
    const { data, error } = await supabase
      .from('recurring_ious')
      .select(`
        *,
        debtor:users!recurring_ious_debtor_id_fkey(id, username, first_name, profile_pic_url),
        creditor:users!recurring_ious_creditor_id_fkey(id, username, first_name, profile_pic_url)
      `)
      .or(`debtor_id.eq.${userId},creditor_id.eq.${userId}`)
      .order('created_at', { ascending: false })

    if (error) throw error

    res.json({ success: true, data })
  } catch (error) {
    logger.error('Get recurring IOUs error', error)
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to fetch recurring IOUs' },
    })
  }
})

// Create recurring IOU (supports both directions)
// - If debtor_id provided: UOMe (they owe me) - current user is creditor
// - If creditor_id provided: IOU (I owe them) - current user is debtor
router.post('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId
  const { debtor_id, creditor_id, description, amount, currency, visibility, notes, frequency, day_of_week, day_of_month } = req.body

  if ((!debtor_id && !creditor_id) || !description || !frequency) {
    res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'debtor_id or creditor_id, description, and frequency are required' },
    })
    return
  }

  // Validate amount if provided
  const amountValidation = validateAmount(amount)
  if (!amountValidation.valid) {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_AMOUNT', message: amountValidation.error },
    })
    return
  }

  // Determine the other party and direction
  const finalDebtorId = debtor_id || userId  // If no debtor_id, current user is debtor
  const finalCreditorId = creditor_id || userId  // If no creditor_id, current user is creditor
  const otherPartyId = debtor_id || creditor_id  // The friend we're creating this with

  if (frequency === 'weekly' && (day_of_week === undefined || day_of_week < 0 || day_of_week > 6)) {
    res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'day_of_week (0-6) is required for weekly frequency' },
    })
    return
  }

  if (frequency === 'monthly' && (day_of_month === undefined || day_of_month < 1 || day_of_month > 31)) {
    res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'day_of_month (1-31) is required for monthly frequency' },
    })
    return
  }

  try {
    // Verify friendship exists
    const friendship = await getAcceptedFriendship(userId, otherPartyId)

    if (!friendship) {
      res.status(400).json({
        success: false,
        error: { code: 'NOT_FRIENDS', message: 'You can only create recurring IOUs with friends' },
      })
      return
    }

    const nextDueAt = calculateNextDueDate(frequency, day_of_week, day_of_month)

    const { data, error } = await supabase
      .from('recurring_ious')
      .insert({
        debtor_id: finalDebtorId,
        creditor_id: finalCreditorId,
        created_by: userId,
        description,
        amount: amount || null,
        currency: currency || null,
        visibility: visibility || 'private',
        notes: notes || null,
        frequency,
        day_of_week: frequency === 'weekly' ? day_of_week : null,
        day_of_month: frequency === 'monthly' ? day_of_month : null,
        next_due_at: nextDueAt.toISOString(),
        is_active: true,
      })
      .select(`
        *,
        debtor:users!recurring_ious_debtor_id_fkey(id, username, first_name, profile_pic_url),
        creditor:users!recurring_ious_creditor_id_fkey(id, username, first_name, profile_pic_url)
      `)
      .single()

    if (error) throw error

    res.json({ success: true, data })
  } catch (error) {
    logger.error('Create recurring IOU error', error)
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to create recurring IOU' },
    })
  }
})

// Update recurring IOU
router.put('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId
  const { id } = req.params
  const { description, amount, visibility, notes, frequency, day_of_week, day_of_month, is_active } = req.body

  try {
    // First verify the user created this recurring IOU
    const { data: existing } = await supabase
      .from('recurring_ious')
      .select('*')
      .eq('id', id)
      .eq('created_by', userId)
      .single()

    if (!existing) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Recurring IOU not found or you do not have permission to edit it' },
      })
      return
    }

    const updates: RecurringIOUUpdate = { updated_at: new Date().toISOString() }

    if (description !== undefined) updates.description = description
    if (amount !== undefined) updates.amount = amount || null
    if (visibility !== undefined) updates.visibility = visibility
    if (notes !== undefined) updates.notes = notes || null
    if (is_active !== undefined) updates.is_active = is_active

    // Handle frequency changes
    if (frequency !== undefined) {
      updates.frequency = frequency
      if (frequency === 'weekly') {
        const dow = day_of_week !== undefined ? day_of_week : existing.day_of_week
        updates.day_of_week = dow
        updates.day_of_month = null
        updates.next_due_at = calculateNextDueDate('weekly', dow).toISOString()
      } else if (frequency === 'monthly') {
        const dom = day_of_month !== undefined ? day_of_month : existing.day_of_month
        updates.day_of_month = dom
        updates.day_of_week = null
        updates.next_due_at = calculateNextDueDate('monthly', undefined, dom).toISOString()
      }
    } else if (day_of_week !== undefined && existing.frequency === 'weekly') {
      updates.day_of_week = day_of_week
      updates.next_due_at = calculateNextDueDate('weekly', day_of_week).toISOString()
    } else if (day_of_month !== undefined && existing.frequency === 'monthly') {
      updates.day_of_month = day_of_month
      updates.next_due_at = calculateNextDueDate('monthly', undefined, day_of_month).toISOString()
    }

    const { data, error } = await supabase
      .from('recurring_ious')
      .update(updates)
      .eq('id', id)
      .select(`
        *,
        debtor:users!recurring_ious_debtor_id_fkey(id, username, first_name, profile_pic_url),
        creditor:users!recurring_ious_creditor_id_fkey(id, username, first_name, profile_pic_url)
      `)
      .single()

    if (error) throw error

    res.json({ success: true, data })
  } catch (error) {
    logger.error('Update recurring IOU error', error)
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to update recurring IOU' },
    })
  }
})

// Delete recurring IOU
router.delete('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId
  const { id } = req.params

  try {
    const { error } = await supabase
      .from('recurring_ious')
      .delete()
      .eq('id', id)
      .eq('created_by', userId)

    if (error) throw error

    res.json({ success: true })
  } catch (error) {
    logger.error('Delete recurring IOU error', error)
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to delete recurring IOU' },
    })
  }
})

// Generate due IOUs - can be called manually or by cron/scheduler
router.post('/generate', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId

  try {
    // Get all active recurring IOUs that are due (for the current user)
    const now = new Date()
    const { data: dueRecurring, error: fetchError } = await supabase
      .from('recurring_ious')
      .select('*')
      .eq('is_active', true)
      .lte('next_due_at', now.toISOString())
      .or(`debtor_id.eq.${userId},creditor_id.eq.${userId}`)

    if (fetchError) throw fetchError

    const generated = []

    for (const recurring of dueRecurring || []) {
      // Create the actual IOU
      const { data: newIOU, error: createError } = await supabase
        .from('ious')
        .insert({
          debtor_id: recurring.debtor_id,
          creditor_id: recurring.creditor_id,
          description: recurring.description,
          amount: recurring.amount,
          currency: recurring.currency,
          visibility: recurring.visibility,
          notes: recurring.notes ? `[Recurring] ${recurring.notes}` : '[Recurring IOU]',
          status: 'pending',
          created_by: recurring.created_by,
        })
        .select()
        .single()

      if (createError) {
        logger.error('Error creating IOU from recurring', createError)
        continue
      }

      // Update the recurring IOU with next due date
      const nextDue = calculateNextDueDate(
        recurring.frequency,
        recurring.day_of_week,
        recurring.day_of_month
      )

      await supabase
        .from('recurring_ious')
        .update({
          last_generated_at: now.toISOString(),
          next_due_at: nextDue.toISOString(),
          updated_at: now.toISOString(),
        })
        .eq('id', recurring.id)

      generated.push(newIOU)
    }

    res.json({
      success: true,
      data: {
        generated_count: generated.length,
        generated
      }
    })
  } catch (error) {
    logger.error('Generate recurring IOUs error', error)
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to generate recurring IOUs' },
    })
  }
})

export default router
