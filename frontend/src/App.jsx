import { BrowserRouter, useLocation } from 'react-router-dom'
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
  const { pathname } = useLocation()

  return (
    <div className="min-h-screen">
      <main className="pb-20">
        {/*
          CoachView is kept mounted so background AI requests continue even
          when the user navigates to Stats/Progress/Settings. It reads the
          current route via useLocation() internally and only renders its
          fixed portal elements (input bar, toasts) when it is the active page.
        */}
        <div style={pathname !== '/' ? { display: 'none' } : undefined}>
          <CoachView />
        </div>

        {/*
          Stats, Progress and Settings are kept permanently mounted once the
          app loads. Navigation between them is a CSS show/hide — no React
          remount, no useEffect re-run, no API re-fetch.
          Their useEffects also fire at startup (while the user is on Coach),
          so by the time the user taps one of these tabs the data is already
          loaded and ready. Scroll position and active tab state are preserved.
        */}
        <div style={pathname !== '/stats' ? { display: 'none' } : undefined}>
          <StatsView />
        </div>
        <div style={pathname !== '/progress' ? { display: 'none' } : undefined}>
          <ProgressView />
        </div>
        <div style={pathname !== '/settings' ? { display: 'none' } : undefined}>
          <SettingsView />
        </div>
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
