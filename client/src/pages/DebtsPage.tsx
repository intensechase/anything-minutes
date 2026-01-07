import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus, Receipt } from 'lucide-react'
import { api } from '../services/api'
import { useAuth } from '../context/AuthContext'
import IOUCard from '../components/IOUCard'
import CreateIOUModal from '../components/CreateIOUModal'

type TabType = 'all' | 'owed_by_me' | 'owed_to_me' | 'history'

export default function DebtsPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<TabType>('all')
  const [showCreateModal, setShowCreateModal] = useState(false)

  const { data: iousData, isLoading } = useQuery({
    queryKey: ['ious'],
    queryFn: () => api.getIOUs(),
  })

  const ious = iousData?.data || []

  const filteredIOUs = ious.filter((iou) => {
    const isDebtor = iou.debtor_id === user?.id
    const isCompleted = iou.status === 'paid' || iou.status === 'cancelled'

    switch (activeTab) {
      case 'owed_by_me':
        return isDebtor && !isCompleted
      case 'owed_to_me':
        return !isDebtor && !isCompleted
      case 'history':
        return isCompleted
      default:
        return !isCompleted
    }
  })

  const tabs = [
    { id: 'all' as TabType, label: 'All Active' },
    { id: 'owed_by_me' as TabType, label: 'I Owe' },
    { id: 'owed_to_me' as TabType, label: 'Owed to Me' },
    { id: 'history' as TabType, label: 'History' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-serif text-gray-800">Debts</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-highlight text-white px-4 py-2 rounded-lg hover:bg-highlight/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New IOU
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'bg-highlight text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* IOU List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-highlight"></div>
        </div>
      ) : filteredIOUs.length > 0 ? (
        <div className="space-y-3">
          {filteredIOUs.map((iou) => (
            <IOUCard key={iou.id} iou={iou} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Receipt className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-700 mb-2">
            {activeTab === 'history' ? 'No completed IOUs' : 'No active IOUs'}
          </h3>
          <p className="text-gray-500">
            {activeTab === 'history'
              ? 'Completed and cancelled IOUs will appear here'
              : 'Create a new IOU to get started'}
          </p>
        </div>
      )}

      {/* Create IOU Modal */}
      {showCreateModal && (
        <CreateIOUModal onClose={() => setShowCreateModal(false)} />
      )}
    </div>
  )
}
