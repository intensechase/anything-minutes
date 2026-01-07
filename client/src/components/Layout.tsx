import { Outlet, NavLink } from 'react-router-dom'
import { Home, Receipt, Users, User, Rss } from 'lucide-react'

const navItems = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/feed', icon: Rss, label: 'Feed' },
  { to: '/debts', icon: Receipt, label: 'Debts' },
  { to: '/friends', icon: Users, label: 'Friends' },
  { to: '/profile', icon: User, label: 'Profile' },
]

export default function Layout() {
  return (
    <div className="min-h-screen bg-gray-50 pb-16 md:pb-0">
      {/* Desktop Header */}
      <header className="hidden md:block bg-gradient-to-r from-primary to-secondary text-white shadow-lg">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold font-serif">Anything Minutes</h1>
          <nav className="flex gap-6">
            {navItems.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `text-sm font-medium transition-colors ${
                    isActive ? 'text-highlight' : 'text-white/80 hover:text-white'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto p-4">
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg">
        <div className="flex justify-around items-center h-16">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                  isActive ? 'text-highlight' : 'text-gray-500'
                }`
              }
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs mt-1">{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
