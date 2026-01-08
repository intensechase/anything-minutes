import { Request } from 'express'

export interface User {
  id: string
  firebase_uid: string
  username: string
  first_name?: string
  email?: string
  phone?: string
  profile_pic_url?: string
  street_cred_visibility: 'private' | 'friends_only' | 'public'
  feed_visible: boolean
  setup_complete: boolean
  profile_complete: boolean
  email_verified: boolean
  phone_verified: boolean
  username_changed_at?: string
  venmo_handle?: string
  friend_request_setting: 'everyone' | 'friends_of_friends' | 'no_one'
  profile_visibility: 'everyone' | 'friends_only'
  hide_from_search: boolean
  default_iou_visibility: 'private' | 'public'
  default_currency: string
  date_format: string
  time_format: '12h' | '24h'
  created_at: string
}

export interface BlockedUser {
  id: string
  blocker_id: string
  blocked_id: string
  created_at: string
  blocked_user?: User
}

export interface Friendship {
  id: string
  requester_id: string
  addressee_id: string
  status: 'pending' | 'accepted' | 'declined'
  created_at: string
  updated_at: string
  requester?: User
  addressee?: User
}

export interface IOU {
  id: string
  debtor_id: string
  creditor_id: string
  created_by: string  // Who created the IOU (for accept/decline permissions)
  description: string
  status: 'pending' | 'active' | 'payment_pending' | 'paid' | 'cancelled'
  visibility: 'private' | 'public'
  due_date?: string
  notes?: string
  created_at: string
  paid_at?: string
  debtor?: User
  creditor?: User
}

export interface StreetCred {
  debts_paid: number
  total_debts: number
  outstanding_debts: number
}

export interface AuthenticatedRequest extends Request {
  user?: {
    uid: string
    userId: string
  }
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
  }
}
