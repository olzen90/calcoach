import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom'
import { MessageCircle, BarChart3, TrendingUp, Settings } from 'lucide-react'
import CoachView from './pages/CoachView'
import StatsView from './pages/StatsView'
import ProgressView from './pages/ProgressView'
import SettingsView from './pages/SettingsView'
import SwipeablePages, { useSwipeContext, SwipeProvider } from './components/SwipeablePages'

// Page components array for pre-rendering during swipe
const pageComponents = [
  <CoachView key="coach" />,
  <StatsView key="stats" />,
  <ProgressView key="progress" />,
  <SettingsView key="settings" />
]

function NavItem({ to, icon: Icon, label, index }) {
  const navigate = useNavigate()
  const { activeIndex } = useSwipeContext()
  const isActive = activeIndex === index
  
  return (
    <button
      onClick={() => navigate(to)}
      className={`nav-item ${isActive ? 'active' : ''}`}
    >
      <Icon className="w-6 h-6" />
      <span className="text-xs mt-1 font-medium">{label}</span>
    </button>
  )
}

function AppContent() {
  return (
    <SwipeProvider>
      <div className="min-h-screen">
        {/* Main content area with swipe navigation */}
        <SwipeablePages pageComponents={pageComponents}>
          <main className="pb-20">
            <Routes>
              <Route path="/" element={<CoachView />} />
              <Route path="/stats" element={<StatsView />} />
              <Route path="/progress" element={<ProgressView />} />
              <Route path="/settings" element={<SettingsView />} />
            </Routes>
          </main>
        </SwipeablePages>
        
        {/* Bottom navigation */}
        <nav className="fixed bottom-0 left-0 right-0 bg-gray-50 border-t border-gray-200 safe-bottom z-50">
          <div className="flex justify-around items-center py-2 px-4 max-w-lg mx-auto">
            <NavItem to="/" icon={MessageCircle} label="Coach" index={0} />
            <NavItem to="/stats" icon={BarChart3} label="Stats" index={1} />
            <NavItem to="/progress" icon={TrendingUp} label="Progress" index={2} />
            <NavItem to="/settings" icon={Settings} label="Settings" index={3} />
          </div>
        </nav>
      </div>
    </SwipeProvider>
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
