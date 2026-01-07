import axios from 'axios'
import { auth } from './firebase'
import { User, Friendship, IOU, StreetCred, ApiResponse } from '../types'

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

  async getStreetCred(userId: string): Promise<ApiResponse<StreetCred>> {
    const { data } = await apiClient.get(`/profile/${userId}/street-cred`)
    return data
  },

  // Friends
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
  }): Promise<ApiResponse<IOU>> {
    const { data } = await apiClient.post('/ious', iou)
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

  async confirmPaid(iouId: string): Promise<ApiResponse<IOU>> {
    const { data } = await apiClient.post(`/ious/${iouId}/confirm-paid`)
    return data
  },

  async disputePayment(iouId: string): Promise<ApiResponse<IOU>> {
    const { data } = await apiClient.post(`/ious/${iouId}/dispute`)
    return data
  },

  async cancelIOU(iouId: string): Promise<ApiResponse<void>> {
    const { data } = await apiClient.delete(`/ious/${iouId}`)
    return data
  },
}
