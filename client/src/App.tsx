import { Routes, Route, Navigate } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import SetupPage from './pages/SetupPage'
import HomePage from './pages/HomePage'
import FeedPage from './pages/FeedPage'
import DebtsPage from './pages/DebtsPage'
import FriendsPage from './pages/FriendsPage'
import ProfilePage from './pages/ProfilePage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { firebaseUser, user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
      </div>
    )
  }

  if (!firebaseUser) {
    return <Navigate to="/login" replace />
  }

  // Redirect to setup if user hasn't completed setup or profile
  // This handles both new users and existing users missing first_name
  if (user && (!user.setup_complete || !user.profile_complete || !user.first_name)) {
    return <Navigate to="/setup" replace />
  }

  return <>{children}</>
}

function SetupRoute({ children }: { children: React.ReactNode }) {
  const { firebaseUser, user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
      </div>
    )
  }

  if (!firebaseUser) {
    return <Navigate to="/login" replace />
  }

  // If profile is fully complete (has first_name), go to home
  if (user && user.setup_complete && user.profile_complete && user.first_name) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/setup"
          element={
            <SetupRoute>
              <SetupPage />
            </SetupRoute>
          }
        />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<HomePage />} />
          <Route path="feed" element={<FeedPage />} />
          <Route path="debts" element={<DebtsPage />} />
          <Route path="friends" element={<FriendsPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="profile/:userId" element={<ProfilePage />} />
        </Route>
      </Routes>
      <Analytics />
    </>
  )
}
