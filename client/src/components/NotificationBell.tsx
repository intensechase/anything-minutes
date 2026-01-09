import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, Check, X, UserPlus, FileText, Clock } from 'lucide-react'
import { api } from '../services/api'
import { formatDistanceToNow } from 'date-fns'

interface Notification {
  id: string
  type: 'invite_accepted' | 'invite_declined' | 'invite_expired' | 'friend_request' | 'iou_request' | 'payment_claimed'
  title: string
  message: string
  data?: Record<string, any>
  is_read: boolean
  created_at: string
}

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()

  // Fetch unread count
  const { data: countData } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => api.getUnreadNotificationCount(),
    refetchInterval: 30000, // Refetch every 30 seconds
  })

  // Fetch notifications when dropdown is open
  const { data: notificationsData } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.getNotifications(20),
    enabled: isOpen,
  })

  const markReadMutation = useMutation({
    mutationFn: (id: string) => api.markNotificationRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const markAllReadMutation = useMutation({
    mutationFn: () => api.markAllNotificationsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const unreadCount = countData?.data?.count || 0
  const notifications: Notification[] = notificationsData?.data || []

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const getIcon = (type: string) => {
    switch (type) {
      case 'invite_accepted':
        return <Check className="w-4 h-4 text-success" />
      case 'invite_declined':
        return <X className="w-4 h-4 text-danger" />
      case 'invite_expired':
        return <Clock className="w-4 h-4 text-warning" />
      case 'friend_request':
        return <UserPlus className="w-4 h-4 text-accent" />
      case 'iou_request':
      case 'payment_claimed':
        return <FileText className="w-4 h-4 text-accent" />
      default:
        return <Bell className="w-4 h-4 text-light/50" />
    }
  }

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.is_read) {
      markReadMutation.mutate(notification.id)
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full hover:bg-dark transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-6 h-6 text-light/70" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 w-5 h-5 bg-danger text-white text-xs font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-card rounded-xl shadow-xl border border-light/10 overflow-hidden z-50">
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-light/10">
            <h3 className="font-semibold text-light">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllReadMutation.mutate()}
                className="text-xs text-accent hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length > 0 ? (
              notifications.map((notification) => (
                <button
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`w-full flex items-start gap-3 p-3 text-left hover:bg-dark/50 transition-colors border-b border-light/5 ${
                    !notification.is_read ? 'bg-accent/5' : ''
                  }`}
                >
                  <div className="mt-0.5">
                    {getIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${!notification.is_read ? 'font-medium text-light' : 'text-light/70'}`}>
                      {notification.title}
                    </p>
                    <p className="text-xs text-light/50 mt-0.5 line-clamp-2">
                      {notification.message}
                    </p>
                    <p className="text-xs text-light/40 mt-1">
                      {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  {!notification.is_read && (
                    <div className="w-2 h-2 bg-accent rounded-full mt-1.5" />
                  )}
                </button>
              ))
            ) : (
              <div className="p-8 text-center">
                <Bell className="w-8 h-8 text-light/20 mx-auto mb-2" />
                <p className="text-light/50 text-sm">No notifications yet</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
