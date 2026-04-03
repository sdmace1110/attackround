import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import useAuthStore from '../store/authStore'
import DmLoginPage from '../pages/DmLoginPage'
import DmDashboardPage from '../pages/DmDashboardPage'
import CampaignPage from '../pages/CampaignPage'

function ProtectedRoute({ children }) {
  const token = useAuthStore((s) => s.token)
  return token ? children : <Navigate to="/" replace />
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DmLoginPage />} />
        <Route
          path="/dm/dashboard"
          element={
            <ProtectedRoute>
              <DmDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dm/campaign/:id"
          element={
            <ProtectedRoute>
              <CampaignPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}
