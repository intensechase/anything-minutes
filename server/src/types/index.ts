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

export type IOUStatus = 'pending' | 'active' | 'payment_pending' | 'paid' | 'cancelled' | 'invite_pending' | 'expired'
export type IOUVisibility = 'private' | 'public'

export interface IOU {
  id: string
  debtor_id: string | null
  creditor_id: string | null
  created_by: string  // Who created the IOU (for accept/decline permissions)
  description: string
  amount?: number | null
  currency?: string | null
  status: IOUStatus
  visibility: IOUVisibility
  due_date?: string | null
  notes?: string | null
  created_at: string
  paid_at?: string | null
  debtor?: User
  creditor?: User
}

export interface IOUInsert {
  debtor_id?: string | null
  creditor_id?: string | null
  created_by: string
  description: string
  amount?: number | null
  currency?: string | null
  status: IOUStatus
  visibility?: IOUVisibility
  due_date?: string | null
  notes?: string | null
}

export interface IOUUpdate {
  debtor_id?: string | null
  creditor_id?: string | null
  status?: IOUStatus
  visibility?: IOUVisibility
  due_date?: string | null
  notes?: string | null
  paid_at?: string | null
}

export interface Payment {
  id: string
  iou_id: string
  amount?: number | null
  description: string
  created_by: string
  created_at: string
}

export type RecurringFrequency = 'weekly' | 'monthly'

export interface RecurringIOU {
  id: string
  debtor_id: string
  creditor_id: string
  created_by: string
  description: string
  amount?: number | null
  currency?: string | null
  visibility: IOUVisibility
  notes?: string | null
  frequency: RecurringFrequency
  day_of_week?: number | null
  day_of_month?: number | null
  next_due_at: string
  last_generated_at?: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface RecurringIOUUpdate {
  description?: string
  amount?: number | null
  currency?: string | null
  visibility?: IOUVisibility
  notes?: string | null
  frequency?: RecurringFrequency
  day_of_week?: number | null
  day_of_month?: number | null
  next_due_at?: string
  last_generated_at?: string | null
  is_active?: boolean
  updated_at?: string
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
