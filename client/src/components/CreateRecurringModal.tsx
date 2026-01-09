import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { X, Search, Plus, Repeat } from 'lucide-react'
import { api } from '../services/api'
import { User } from '../types'

const CURRENCY_OPTIONS = ['$', '🍺', '☕', '🍌', '🥤'] as const
type CurrencyOption = typeof CURRENCY_OPTIONS[number] | 'custom'

interface CreateRecurringModalProps {
  onClose: () => void
  preselectedFriend?: User | null
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
]

export default function CreateRecurringModal({ onClose, preselectedFriend }: CreateRecurringModalProps) {
  const queryClient = useQueryClient()
  const [step, setStep] = useState<'friend' | 'details'>(preselectedFriend ? 'details' : 'friend')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFriend, setSelectedFriend] = useState<User | null>(preselectedFriend || null)
  const [direction, setDirection] = useState<'uome' | 'iou'>('uome') // uome = they owe me, iou = I owe them
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState<CurrencyOption>('$')
  const [customCurrency, setCustomCurrency] = useState('')
  const [notes, setNotes] = useState('')
  const [visibility, setVisibility] = useState<'private' | 'public'>('private')
  const [frequency, setFrequency] = useState<'weekly' | 'monthly'>('weekly')
  const [dayOfWeek, setDayOfWeek] = useState(5) // Friday
  const [dayOfMonth, setDayOfMonth] = useState(1)
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
    friend.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    friend.first_name?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const createMutation = useMutation({
    mutationFn: () => {
      const selectedCurrency = currency === 'custom' ? customCurrency : currency
      return api.createRecurringIOU({
        // If UOMe: friend is debtor (they owe me). If IOU: friend is creditor (I owe them)
        debtor_id: direction === 'uome' ? selectedFriend!.id : undefined,
        creditor_id: direction === 'iou' ? selectedFriend!.id : undefined,
        description,
        visibility,
        notes: notes || undefined,
        amount: amount ? parseFloat(amount) : undefined,
        currency: amount && selectedCurrency ? selectedCurrency : undefined,
        frequency,
        day_of_week: frequency === 'weekly' ? dayOfWeek : undefined,
        day_of_month: frequency === 'monthly' ? dayOfMonth : undefined,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring'] })
      onClose()
    },
    onError: (err) => {
      setError('Failed to create recurring IOU. Please try again.')
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
      setError('Please enter what they owe')
      return
    }

    createMutation.mutate()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-card rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-light/10">
          <h2 className="text-lg font-semibold text-light flex items-center gap-2">
            <Repeat className="w-5 h-5 text-accent" />
            {step === 'friend' ? 'Select Friend' : 'Recurring IOU Details'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-dark rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-light/50" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[60vh]">
          {step === 'friend' ? (
            <div className="space-y-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-light/40" />
                <input
                  type="text"
                  placeholder="Search friends..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-dark border border-light/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50 text-light placeholder-light/40"
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
                      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-accent/20 transition-colors text-left"
                    >
                      <div className="w-10 h-10 rounded-full bg-accent/30 flex items-center justify-center text-accent font-medium">
                        {(friend.first_name?.[0] || friend.username[0]).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-light">{friend.first_name || friend.username}</p>
                        <p className="text-xs text-light/40">@{friend.username}</p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-light/50">
                    {friends.length === 0
                      ? 'Add friends to create recurring IOUs'
                      : 'No friends found'}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Selected Friend */}
              <div className="flex items-center gap-3 p-3 bg-dark rounded-lg">
                <div className="w-10 h-10 rounded-full bg-accent/30 flex items-center justify-center text-accent font-medium">
                  {(selectedFriend?.first_name?.[0] || selectedFriend?.username[0])?.toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="text-sm text-light/50">
                    {direction === 'uome' ? 'Owes you (recurring)' : 'You owe (recurring)'}
                  </p>
                  <p className="font-medium text-light">{selectedFriend?.first_name || selectedFriend?.username}</p>
                  <p className="text-xs text-light/40">@{selectedFriend?.username}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setStep('friend')}
                  className="text-sm text-accent hover:underline"
                >
                  Change
                </button>
              </div>

              {/* Direction Toggle */}
              <div>
                <label className="block text-sm font-medium text-light mb-2">
                  Direction
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setDirection('uome')}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                      direction === 'uome'
                        ? 'bg-accent text-dark'
                        : 'bg-dark text-light/70 hover:bg-dark/70'
                    }`}
                  >
                    They owe me
                  </button>
                  <button
                    type="button"
                    onClick={() => setDirection('iou')}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                      direction === 'iou'
                        ? 'bg-accent text-dark'
                        : 'bg-dark text-light/70 hover:bg-dark/70'
                    }`}
                  >
                    I owe them
                  </button>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-light mb-1">
                  {direction === 'uome' ? 'What do they owe you?' : 'What do you owe them?'} *
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={direction === 'uome' ? 'e.g., Weekly allowance, Monthly rent contribution' : 'e.g., Weekly payment, Monthly subscription'}
                  className="w-full px-4 py-2 bg-dark border border-light/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50 text-light placeholder-light/40"
                  required
                />
              </div>

              {/* Amount with Currency */}
              <div>
                <label className="block text-sm font-medium text-light mb-1">
                  Amount (optional)
                </label>
                <div className="flex gap-2 mb-2">
                  {CURRENCY_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setCurrency(opt)}
                      className={`w-10 h-10 rounded-lg border text-lg flex items-center justify-center transition-colors ${
                        currency === opt
                          ? 'bg-accent/20 border-accent text-light'
                          : 'bg-dark border-light/20 text-light/60 hover:border-light/40'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setCurrency('custom')}
                    className={`w-10 h-10 rounded-lg border flex items-center justify-center transition-colors ${
                      currency === 'custom'
                        ? 'bg-accent/20 border-accent text-light'
                        : 'bg-dark border-light/20 text-light/60 hover:border-light/40'
                    }`}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                {currency === 'custom' && (
                  <input
                    type="text"
                    value={customCurrency}
                    onChange={(e) => setCustomCurrency(e.target.value)}
                    placeholder="Enter custom (e.g., 🍕, minutes, etc.)"
                    maxLength={20}
                    className="w-full px-4 py-2 mb-2 bg-dark border border-light/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50 text-light placeholder-light/40"
                  />
                )}
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-light/40">
                    {currency === 'custom' ? (customCurrency || '?') : currency}
                  </span>
                  <input
                    type="number"
                    step={currency === '$' ? '0.01' : '1'}
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder={currency === '$' ? '0.00' : '0'}
                    className="w-full pl-10 pr-4 py-2 bg-dark border border-light/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50 text-light placeholder-light/40"
                  />
                </div>
              </div>

              {/* Frequency */}
              <div>
                <label className="block text-sm font-medium text-light mb-2">
                  Frequency
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="frequency"
                      value="weekly"
                      checked={frequency === 'weekly'}
                      onChange={() => setFrequency('weekly')}
                      className="w-4 h-4 text-accent focus:ring-accent"
                    />
                    <span className="text-sm text-light/70">Weekly</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="frequency"
                      value="monthly"
                      checked={frequency === 'monthly'}
                      onChange={() => setFrequency('monthly')}
                      className="w-4 h-4 text-accent focus:ring-accent"
                    />
                    <span className="text-sm text-light/70">Monthly</span>
                  </label>
                </div>
              </div>

              {/* Day Selection */}
              {frequency === 'weekly' ? (
                <div>
                  <label className="block text-sm font-medium text-light mb-1">
                    Day of Week
                  </label>
                  <select
                    value={dayOfWeek}
                    onChange={(e) => setDayOfWeek(parseInt(e.target.value))}
                    className="w-full px-4 py-2 bg-dark border border-light/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50 text-light"
                  >
                    {DAYS_OF_WEEK.map((day) => (
                      <option key={day.value} value={day.value}>
                        {day.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-light mb-1">
                    Day of Month
                  </label>
                  <select
                    value={dayOfMonth}
                    onChange={(e) => setDayOfMonth(parseInt(e.target.value))}
                    className="w-full px-4 py-2 bg-dark border border-light/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50 text-light"
                  >
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                      <option key={day} value={day}>
                        {day}{day === 1 ? 'st' : day === 2 ? 'nd' : day === 3 ? 'rd' : 'th'}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-light/40 mt-1">
                    For months with fewer days, it will be the last day of the month
                  </p>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-light mb-1">
                  Notes (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g., Allowance for chores"
                  rows={2}
                  className="w-full px-4 py-2 bg-dark border border-light/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50 text-light placeholder-light/40 resize-none"
                />
              </div>

              {/* Visibility */}
              <div>
                <label className="block text-sm font-medium text-light mb-2">
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
                      className="w-4 h-4 text-accent focus:ring-accent"
                    />
                    <span className="text-sm text-light/70">Private</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="visibility"
                      value="public"
                      checked={visibility === 'public'}
                      onChange={() => setVisibility('public')}
                      className="w-4 h-4 text-accent focus:ring-accent"
                    />
                    <span className="text-sm text-light/70">Public</span>
                  </label>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-danger/10 border border-danger/20 text-danger rounded-lg text-sm">
                  {error}
                </div>
              )}
            </form>
          )}
        </div>

        {/* Footer */}
        {step === 'details' && (
          <div className="p-4 border-t border-light/10 bg-dark/50">
            <button
              onClick={handleSubmit}
              disabled={createMutation.isPending || !description.trim()}
              className="w-full bg-accent text-dark py-3 rounded-lg font-medium hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createMutation.isPending ? 'Creating...' : 'Create Recurring IOU'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
