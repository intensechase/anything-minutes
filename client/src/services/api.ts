import axios from 'axios'
import { auth } from './firebase'
import { User, Friendship, IOU, StreetCred, ApiResponse, FeedItem, Payment, RecurringIOU, BlockedUser } from '../types'

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

apiClient.interceptors.request.use(async (config) => {
  const user = auth.currentUser
  if (user) {
    const token = await user.getIdToken()
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export const api = {
  // Auth
  async createOrGetUser(token: string): Promise<ApiResponse<User>> {
    const { data } = await apiClient.post('/auth/login', {}, {
      headers: { Authorization: `Bearer ${token}` }
    })
    return data
  },

  // Profile
  async getProfile(): Promise<ApiResponse<User>> {
    const { data } = await apiClient.get('/profile/me')
    return data
  },

  async getUserProfile(userId: string): Promise<ApiResponse<User>> {
    const { data } = await apiClient.get(`/profile/${userId}`)
    return data
  },

  async updateProfile(updates: Partial<User>): Promise<ApiResponse<User>> {
    const { data } = await apiClient.put('/profile/settings', updates)
    return data
  },

  async completeProfile(profile: { first_name: string; username: string }): Promise<ApiResponse<User>> {
    const { data } = await apiClient.post('/profile/complete', profile)
    return data
  },

  async checkUsername(username: string): Promise<ApiResponse<{ available: boolean; error?: string; suggestions?: string[] }>> {
    const { data } = await apiClient.get(`/profile/check-username/${encodeURIComponent(username)}`)
    return data
  },

  async getStreetCred(userId: string): Promise<ApiResponse<StreetCred>> {
    const { data } = await apiClient.get(`/profile/${userId}/street-cred`)
    return data
  },

  // Friends
  async getFriendshipStatus(userId: string): Promise<ApiResponse<{ status: string; friendship_id?: string }>> {
    const { data } = await apiClient.get(`/friends/status/${userId}`)
    return data
  },

  async getFriends(): Promise<ApiResponse<Friendship[]>> {
    const { data } = await apiClient.get('/friends')
    return data
  },

  async getFriendRequests(): Promise<ApiResponse<Friendship[]>> {
    const { data } = await apiClient.get('/friends/requests')
    return data
  },

  async sendFriendRequest(userId: string): Promise<ApiResponse<Friendship>> {
    const { data } = await apiClient.post('/friends/request', { addressee_id: userId })
    return data
  },

  async acceptFriendRequest(friendshipId: string): Promise<ApiResponse<Friendship>> {
    const { data } = await apiClient.post(`/friends/${friendshipId}/accept`)
    return data
  },

  async declineFriendRequest(friendshipId: string): Promise<ApiResponse<Friendship>> {
    const { data } = await apiClient.post(`/friends/${friendshipId}/decline`)
    return data
  },

  async removeFriend(friendshipId: string): Promise<ApiResponse<void>> {
    const { data } = await apiClient.delete(`/friends/${friendshipId}`)
    return data
  },

  async searchUsers(query: string): Promise<ApiResponse<User[]>> {
    const { data } = await apiClient.get(`/users/search?q=${encodeURIComponent(query)}`)
    return data
  },

  // IOUs
  async getIOUs(filter?: 'owed_by_me' | 'owed_to_me'): Promise<ApiResponse<IOU[]>> {
    const params = filter ? `?filter=${filter}` : ''
    const { data } = await apiClient.get(`/ious${params}`)
    return data
  },

  async createIOU(iou: {
    creditor_id: string
    description: string
    visibility: 'private' | 'public'
    due_date?: string
    notes?: string
    amount?: number
  }): Promise<ApiResponse<IOU>> {
    const { data } = await apiClient.post('/ious', iou)
    return data
  },

  // Create UOMe (creditor creates - "You owe me")
  async createUOMe(uome: {
    debtor_id: string
    description: string
    visibility: 'private' | 'public'
    due_date?: string
    notes?: string
    amount?: number
  }): Promise<ApiResponse<IOU>> {
    const { data } = await apiClient.post('/ious/uome', uome)
    return data
  },

  // Add a partial payment to an IOU
  async addPayment(iouId: string, payment: {
    description: string
    amount?: number
  }): Promise<ApiResponse<Payment>> {
    const { data } = await apiClient.post(`/ious/${iouId}/payments`, payment)
    return data
  },

  async acceptIOU(iouId: string): Promise<ApiResponse<IOU>> {
    const { data } = await apiClient.post(`/ious/${iouId}/accept`)
    return data
  },

  async declineIOU(iouId: string): Promise<ApiResponse<IOU>> {
    const { data } = await apiClient.post(`/ious/${iouId}/decline`)
    return data
  },

  async markPaid(iouId: string): Promise<ApiResponse<IOU>> {
    const { data } = await apiClient.post(`/ious/${iouId}/mark-paid`)
    return data
  },

  async cancelIOU(iouId: string): Promise<ApiResponse<void>> {
    const { data } = await apiClient.delete(`/ious/${iouId}`)
    return data
  },

  // Feed
  async getFeed(): Promise<ApiResponse<FeedItem[]>> {
    const { data } = await apiClient.get('/feed')
    return data
  },

  async addReaction(iouId: string, reactionType: 'up' | 'down'): Promise<ApiResponse<void>> {
    const { data } = await apiClient.post(`/feed/${iouId}/react`, { reaction_type: reactionType })
    return data
  },

  async removeReaction(iouId: string): Promise<ApiResponse<void>> {
    const { data } = await apiClient.delete(`/feed/${iouId}/react`)
    return data
  },

  // Recurring IOUs
  async getRecurringIOUs(): Promise<ApiResponse<RecurringIOU[]>> {
    const { data } = await apiClient.get('/recurring')
    return data
  },

  async createRecurringIOU(recurring: {
    debtor_id?: string    // For UOMe: friend is debtor (they owe me)
    creditor_id?: string  // For IOU: friend is creditor (I owe them)
    description: string
    amount?: number
    visibility?: 'private' | 'public'
    notes?: string
    frequency: 'weekly' | 'monthly'
    day_of_week?: number
    day_of_month?: number
  }): Promise<ApiResponse<RecurringIOU>> {
    const { data } = await apiClient.post('/recurring', recurring)
    return data
  },

  async updateRecurringIOU(id: string, updates: {
    description?: string
    amount?: number
    visibility?: 'private' | 'public'
    notes?: string
    frequency?: 'weekly' | 'monthly'
    day_of_week?: number
    day_of_month?: number
    is_active?: boolean
  }): Promise<ApiResponse<RecurringIOU>> {
    const { data } = await apiClient.put(`/recurring/${id}`, updates)
    return data
  },

  async deleteRecurringIOU(id: string): Promise<ApiResponse<void>> {
    const { data } = await apiClient.delete(`/recurring/${id}`)
    return data
  },

  async generateRecurringIOUs(): Promise<ApiResponse<{ generated_count: number; generated: IOU[] }>> {
    const { data } = await apiClient.post('/recurring/generate')
    return data
  },

  // Blocking
  async getBlockedUsers(): Promise<ApiResponse<BlockedUser[]>> {
    const { data } = await apiClient.get('/blocked')
    return data
  },

  async blockUser(userId: string): Promise<ApiResponse<BlockedUser>> {
    const { data } = await apiClient.post(`/blocked/${userId}`)
    return data
  },

  async unblockUser(userId: string): Promise<ApiResponse<void>> {
    const { data } = await apiClient.delete(`/blocked/${userId}`)
    return data
  },

  async checkBlocked(userId: string): Promise<ApiResponse<{ isBlocked: boolean }>> {
    const { data } = await apiClient.get(`/blocked/check/${userId}`)
    return data
  },
}
