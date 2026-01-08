export interface User {
  id: string
  firebase_uid: string
  username: string
  email?: string
  phone?: string
  profile_pic_url?: string
  street_cred_visibility: 'private' | 'friends_only' | 'public'
  feed_visible: boolean
  setup_complete: boolean
  created_at: string
}

export interface FeedItem extends IOU {
  reactions: { up: number; down: number }
  userReaction: 'up' | 'down' | null
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
  created_by?: string  // Who created the IOU (for accept/decline permissions)
  description: string
  amount?: number  // Optional monetary amount
  status: 'pending' | 'active' | 'payment_pending' | 'paid' | 'cancelled'
  visibility: 'private' | 'public'
  due_date?: string
  notes?: string
  created_at: string
  paid_at?: string
  debtor?: User
  creditor?: User
  payments?: Payment[]  // Payment history
  amount_paid?: number  // Calculated total paid
}

export interface Payment {
  id: string
  iou_id: string
  amount?: number  // Optional - can be flexible like "half"
  description: string  // e.g., "$25" or "half the pizza"
  paid_at: string
  created_by: string  // Who logged this payment
}

export interface StreetCred {
  debts_paid: number
  total_debts: number
  outstanding_debts: number
}

export interface RecurringIOU {
  id: string
  debtor_id: string
  creditor_id: string
  created_by: string
  description: string
  amount?: number
  visibility: 'private' | 'public'
  notes?: string
  frequency: 'weekly' | 'monthly'
  day_of_week?: number  // 0=Sunday, 1=Monday, etc. (for weekly)
  day_of_month?: number  // 1-31 (for monthly)
  is_active: boolean
  last_generated_at?: string
  next_due_at: string
  created_at: string
  updated_at: string
  debtor?: User
  creditor?: User
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
  }
}
