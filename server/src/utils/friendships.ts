import { supabase } from '../services/supabase.js'
import { SUPABASE_NO_ROWS_ERROR } from './constants.js'

/**
 * Build the OR clause for checking friendship between two users
 * Use this when you need to check both directions of a friendship
 */
export function friendshipOrClause(userId1: string, userId2: string): string {
  return `and(requester_id.eq.${userId1},addressee_id.eq.${userId2}),and(requester_id.eq.${userId2},addressee_id.eq.${userId1})`
}

/**
 * Build the OR clause for getting all friendships involving a user
 * Use this when you need to find all friendships where user is either requester or addressee
 */
export function userFriendshipsOrClause(userId: string): string {
  return `requester_id.eq.${userId},addressee_id.eq.${userId}`
}

/**
 * Check if two users are friends (have an accepted friendship)
 * Returns the friendship record if they are friends, null otherwise
 */
export async function areFriends(userId1: string, userId2: string): Promise<boolean> {
  const { data } = await supabase
    .from('friendships')
    .select('id')
    .or(friendshipOrClause(userId1, userId2))
    .eq('status', 'accepted')
    .single()

  return !!data
}

/**
 * Get friendship record between two users (any status)
 * Returns the friendship record or null if no friendship exists
 */
export async function getFriendship(userId1: string, userId2: string) {
  const { data, error } = await supabase
    .from('friendships')
    .select('*')
    .or(friendshipOrClause(userId1, userId2))
    .single()

  if (error && error.code !== SUPABASE_NO_ROWS_ERROR) {
    throw error
  }

  return data
}

/**
 * Get accepted friendship record between two users
 * Returns the friendship record or null if not friends
 */
export async function getAcceptedFriendship(userId1: string, userId2: string) {
  const { data, error } = await supabase
    .from('friendships')
    .select('*')
    .or(friendshipOrClause(userId1, userId2))
    .eq('status', 'accepted')
    .single()

  if (error && error.code !== SUPABASE_NO_ROWS_ERROR) {
    throw error
  }

  return data
}
