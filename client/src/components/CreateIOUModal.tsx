import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { X, Search, Calendar } from 'lucide-react'
import { api } from '../services/api'
import { User } from '../types'

interface CreateIOUModalProps {
  onClose: () => void
}

export default function CreateIOUModal({ onClose }: CreateIOUModalProps) {
  const queryClient = useQueryClient()
  const [step, setStep] = useState<'friend' | 'details'>('friend')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFriend, setSelectedFriend] = useState<User | null>(null)
  const [description, setDescription] = useState('')
  const [notes, setNotes] = useState('')
  const [visibility, setVisibility] = useState<'private' | 'public'>('private')
  const [dueDate, setDueDate] = useState('')
  const [error, setError] = useState<string | null>(null)

  const { data: friendsData } = useQuery({
    queryKey: ['friends'],
    queryFn: () => api.getFriends(),
  })

  const friends = (friendsData?.data || [])
    .filter((f) => f.status === 'accepted')
    .map((f) => f.requester || f.addressee)
    .filter((u): u is User => !!u)

  const filteredFriends = friends.filter((friend) =>
    friend.username.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const createMutation = useMutation({
    mutationFn: () =>
      api.createIOU({
        creditor_id: selectedFriend!.id,
        description,
        visibility,
        due_date: dueDate || undefined,
        notes: notes || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ious'] })
      onClose()
    },
    onError: (err) => {
      setError('Failed to create IOU. Please try again.')
      console.error(err)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!selectedFriend) {
      setError('Please select a friend')
      return
    }

    if (!description.trim()) {
      setError('Please enter what you owe')
      return
    }

    createMutation.mutate()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-800">
            {step === 'friend' ? 'Select Friend' : 'IOU Details'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[60vh]">
          {step === 'friend' ? (
            <div className="space-y-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search friends..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-highlight/50"
                />
              </div>

              {/* Friends List */}
              {filteredFriends.length > 0 ? (
                <div className="space-y-2">
                  {filteredFriends.map((friend) => (
                    <button
                      key={friend.id}
                      onClick={() => {
                        setSelectedFriend(friend)
                        setStep('details')
                      }}
                      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors text-left"
                    >
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-medium">
                        {friend.username[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">{friend.username}</p>
                        {friend.email && (
                          <p className="text-sm text-gray-500">{friend.email}</p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500">
                    {friends.length === 0
                      ? 'Add friends to create IOUs'
                      : 'No friends found'}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Selected Friend */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-medium">
                  {selectedFriend?.username[0].toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-500">You owe</p>
                  <p className="font-medium text-gray-800">{selectedFriend?.username}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setStep('friend')}
                  className="text-sm text-highlight hover:underline"
                >
                  Change
                </button>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  What do you owe? *
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g., Beer, $20, 30 minutes massage"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-highlight/50"
                  required
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g., Lost the fantasy football bet"
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-highlight/50 resize-none"
                />
              </div>

              {/* Due Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Due Date (optional)
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="datetime-local"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-highlight/50"
                  />
                </div>
              </div>

              {/* Visibility */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Visibility
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="visibility"
                      value="private"
                      checked={visibility === 'private'}
                      onChange={() => setVisibility('private')}
                      className="w-4 h-4 text-highlight focus:ring-highlight"
                    />
                    <span className="text-sm text-gray-700">Private</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="visibility"
                      value="public"
                      checked={visibility === 'public'}
                      onChange={() => setVisibility('public')}
                      className="w-4 h-4 text-highlight focus:ring-highlight"
                    />
                    <span className="text-sm text-gray-700">Public</span>
                  </label>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
                  {error}
                </div>
              )}
            </form>
          )}
        </div>

        {/* Footer */}
        {step === 'details' && (
          <div className="p-4 border-t bg-gray-50">
            <button
              onClick={handleSubmit}
              disabled={createMutation.isPending || !description.trim()}
              className="w-full bg-highlight text-white py-3 rounded-lg font-medium hover:bg-highlight/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createMutation.isPending ? 'Creating...' : 'Send IOU Request'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
