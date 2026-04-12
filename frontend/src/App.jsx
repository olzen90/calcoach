import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { MessageCircle, BarChart3, TrendingUp, Settings } from 'lucide-react'
import { Link } from 'react-router-dom'
import CoachView from './pages/CoachView'
import StatsView from './pages/StatsView'
import ProgressView from './pages/ProgressView'
import SettingsView from './pages/SettingsView'

function NavItem({ to, icon: Icon, label }) {
  const { pathname } = useLocation()
  const isActive = pathname === to

  return (
    <Link
      to={to}
      className={`nav-item ${isActive ? 'active' : ''}`}
    >
      <Icon className="w-6 h-6" />
      <span className="text-xs mt-1 font-medium">{label}</span>
    </Link>
  )
}

function AppContent() {
  return (
    <div className="min-h-screen">
      <main className="pb-20">
        <Routes>
          <Route path="/" element={<CoachView />} />
          <Route path="/stats" element={<StatsView />} />
          <Route path="/progress" element={<ProgressView />} />
          <Route path="/settings" element={<SettingsView />} />
        </Routes>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-gray-50 border-t border-gray-200 safe-bottom z-50">
        <div className="flex justify-around items-center py-2 px-4 max-w-lg mx-auto">
          <NavItem to="/" icon={MessageCircle} label="Coach" />
          <NavItem to="/stats" icon={BarChart3} label="Stats" />
          <NavItem to="/progress" icon={TrendingUp} label="Progress" />
          <NavItem to="/settings" icon={Settings} label="Settings" />
        </div>
      </nav>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  )
}

export default App
