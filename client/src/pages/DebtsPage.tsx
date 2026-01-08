import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { Plus, Receipt, HandCoins, Repeat } from 'lucide-react'
import { api } from '../services/api'
import { useAuth } from '../context/AuthContext'
import IOUCard from '../components/IOUCard'
import CreateIOUModal from '../components/CreateIOUModal'
import CreateUOMeModal from '../components/CreateUOMeModal'
import CreateRecurringModal from '../components/CreateRecurringModal'
import RecurringIOUCard from '../components/RecurringIOUCard'

type TabType = 'all' | 'pending' | 'owed_by_me' | 'owed_to_me' | 'recurring' | 'history'

export default function DebtsPage() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()

  // Get initial tab from URL parameter, default to 'all'
  const tabParam = searchParams.get('tab') as TabType | null
  const initialTab = tabParam && ['all', 'pending', 'owed_by_me', 'owed_to_me', 'recurring', 'history'].includes(tabParam)
    ? tabParam
    : 'all'

  const [activeTab, setActiveTab] = useState<TabType>(initialTab)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showCreateUOMeModal, setShowCreateUOMeModal] = useState(false)
  const [showRecurringModal, setShowRecurringModal] = useState(false)

  const { data: iousData, isLoading } = useQuery({
    queryKey: ['ious'],
    queryFn: () => api.getIOUs(),
  })

  const { data: recurringData, isLoading: recurringLoading } = useQuery({
    queryKey: ['recurring'],
    queryFn: () => api.getRecurringIOUs(),
  })

  const ious = iousData?.data || []
  const recurringIOUs = recurringData?.data || []

  const filteredIOUs = ious.filter((iou) => {
    const isDebtor = iou.debtor_id === user?.id
    const isCompleted = iou.status === 'paid' || iou.status === 'cancelled'
    const isPending = iou.status === 'pending' || iou.status === 'payment_pending'

    switch (activeTab) {
      case 'pending':
        // Show IOUs waiting for acceptance or payment confirmation
        return isPending
      case 'owed_by_me':
        return isDebtor && !isCompleted
      case 'owed_to_me':
        return !isDebtor && !isCompleted
      case 'history':
        return isCompleted
      default:
        // All active = not completed
        return !isCompleted
    }
  })

  // Count pending items for badge
  const pendingCount = ious.filter(
    (iou) => iou.status === 'pending' || iou.status === 'payment_pending'
  ).length

  const activeRecurringCount = recurringIOUs.filter((r) => r.is_active).length

  const tabs = [
    { id: 'all' as TabType, label: 'All Active' },
    { id: 'pending' as TabType, label: 'Pending', count: pendingCount },
    { id: 'owed_by_me' as TabType, label: 'I Owe' },
    { id: 'owed_to_me' as TabType, label: 'Owed to Me' },
    { id: 'recurring' as TabType, label: 'Recurring', count: activeRecurringCount },
    { id: 'history' as TabType, label: 'History' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-light">Debts</h1>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-accent text-dark px-4 py-2 rounded-lg hover:bg-accent/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New IOU
          </button>
          <button
            onClick={() => setShowCreateUOMeModal(true)}
            className="flex items-center gap-2 bg-card text-light px-4 py-2 rounded-lg hover:bg-card/80 transition-colors"
          >
            <HandCoins className="w-4 h-4" />
            New UOMe
          </button>
          <button
            onClick={() => setShowRecurringModal(true)}
            className="flex items-center gap-2 bg-card text-light px-4 py-2 rounded-lg hover:bg-card/80 transition-colors"
          >
            <Repeat className="w-4 h-4" />
            New Recurring
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-2 ${
              activeTab === tab.id
                ? 'bg-accent text-dark'
                : 'bg-card text-light/70 hover:bg-card/80'
            }`}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className={`px-1.5 py-0.5 text-xs rounded-full ${
                activeTab === tab.id
                  ? 'bg-dark/20 text-dark'
                  : 'bg-warning text-white'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'recurring' ? (
        // Recurring IOUs List
        recurringLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
          </div>
        ) : recurringIOUs.length > 0 ? (
          <div className="space-y-3">
            {recurringIOUs.map((recurring) => (
              <RecurringIOUCard key={recurring.id} recurring={recurring} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Repeat className="w-16 h-16 text-light/30 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-light mb-2">No recurring IOUs</h3>
            <p className="text-light/50">
              Set up recurring IOUs for regular allowances or payments
            </p>
          </div>
        )
      ) : (
        // Regular IOU List
        isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
          </div>
        ) : filteredIOUs.length > 0 ? (
          <div className="space-y-3">
            {filteredIOUs.map((iou) => (
              <IOUCard key={iou.id} iou={iou} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Receipt className="w-16 h-16 text-light/30 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-light mb-2">
              {activeTab === 'history' ? 'No completed IOUs' : 'No active IOUs'}
            </h3>
            <p className="text-light/50">
              {activeTab === 'history'
                ? 'Completed and cancelled IOUs will appear here'
                : 'Create a new IOU to get started'}
            </p>
          </div>
        )
      )}

      {/* Create IOU Modal */}
      {showCreateModal && (
        <CreateIOUModal onClose={() => setShowCreateModal(false)} />
      )}

      {/* Create UOMe Modal */}
      {showCreateUOMeModal && (
        <CreateUOMeModal onClose={() => setShowCreateUOMeModal(false)} />
      )}

      {/* Create Recurring Modal */}
      {showRecurringModal && (
        <CreateRecurringModal onClose={() => setShowRecurringModal(false)} />
      )}
    </div>
  )
}
