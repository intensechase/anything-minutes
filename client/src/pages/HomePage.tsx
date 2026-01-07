import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Receipt, Users, TrendingUp } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { api } from '../services/api'
import IOUCard from '../components/IOUCard'

export default function HomePage() {
  const { user } = useAuth()

  const { data: iousData } = useQuery({
    queryKey: ['ious'],
    queryFn: () => api.getIOUs(),
  })

  const { data: friendsData } = useQuery({
    queryKey: ['friends'],
    queryFn: () => api.getFriends(),
  })

  const ious = iousData?.data || []
  const friends = friendsData?.data || []

  const pendingIOUs = ious.filter(
    (iou) => iou.status === 'pending' || iou.status === 'payment_pending'
  )
  const activeIOUs = ious.filter((iou) => iou.status === 'active')

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-primary to-secondary rounded-xl p-6 text-white">
        <h1 className="text-2xl font-bold font-serif mb-2">
          Welcome back, {user?.username || 'Friend'}!
        </h1>
        <p className="text-white/80">Here's your IOU summary</p>
      </div>

      {/* Quick Stats - Clickable cards */}
      <div className="grid grid-cols-3 gap-4">
        <Link
          to="/debts"
          className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:border-highlight/50 hover:shadow-md transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-highlight/10 rounded-lg">
              <Receipt className="w-5 h-5 text-highlight" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{activeIOUs.length}</p>
              <p className="text-xs text-gray-500">Active IOUs</p>
            </div>
          </div>
        </Link>

        <Link
          to="/debts"
          className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:border-warning/50 hover:shadow-md transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-warning/10 rounded-lg">
              <TrendingUp className="w-5 h-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{pendingIOUs.length}</p>
              <p className="text-xs text-gray-500">Pending</p>
            </div>
          </div>
        </Link>

        <Link
          to="/friends"
          className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:border-success/50 hover:shadow-md transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-success/10 rounded-lg">
              <Users className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">
                {friends.filter((f) => f.status === 'accepted').length}
              </p>
              <p className="text-xs text-gray-500">Friends</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Pending Actions */}
      {pendingIOUs.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Needs Attention</h2>
          <div className="space-y-3">
            {pendingIOUs.slice(0, 3).map((iou) => (
              <IOUCard key={iou.id} iou={iou} />
            ))}
          </div>
          {pendingIOUs.length > 3 && (
            <Link
              to="/debts"
              className="block mt-3 text-center text-sm text-highlight hover:underline"
            >
              View all {pendingIOUs.length} pending IOUs
            </Link>
          )}
        </div>
      )}

      {/* Recent Active IOUs */}
      {activeIOUs.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Active IOUs</h2>
          <div className="space-y-3">
            {activeIOUs.slice(0, 5).map((iou) => (
              <IOUCard key={iou.id} iou={iou} />
            ))}
          </div>
          {activeIOUs.length > 5 && (
            <Link
              to="/debts"
              className="block mt-3 text-center text-sm text-highlight hover:underline"
            >
              View all {activeIOUs.length} active IOUs
            </Link>
          )}
        </div>
      )}

      {/* Empty State */}
      {ious.length === 0 && (
        <div className="text-center py-12">
          <Receipt className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-700 mb-2">No IOUs yet</h3>
          <p className="text-gray-500 mb-4">
            Start by adding friends and creating your first IOU
          </p>
          <Link
            to="/friends"
            className="inline-flex items-center gap-2 bg-highlight text-white px-4 py-2 rounded-lg hover:bg-highlight/90 transition-colors"
          >
            <Users className="w-4 h-4" />
            Add Friends
          </Link>
        </div>
      )}
    </div>
  )
}
