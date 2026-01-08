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
    <div className="min-h-screen bg-dark pb-24 md:pb-0">
      {/* Desktop Header */}
      <header className="hidden md:block bg-card shadow-lg">
        <div className="max-w-6xl mx-auto px-4 py-6 flex items-center justify-between">
          <h1 className="text-4xl font-display text-light tracking-wide">Anything Minutes</h1>
          <nav className="flex gap-10">
            {navItems.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `text-lg font-semibold transition-colors ${
                    isActive ? 'text-accent' : 'text-light/70 hover:text-light'
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
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-dark shadow-lg">
        <div className="flex justify-around items-center h-24">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                  isActive ? 'text-accent' : 'text-light/50'
                }`
              }
            >
              <Icon className="w-7 h-7" />
              <span className="text-base mt-1.5 font-semibold">{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
