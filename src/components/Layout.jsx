import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Layout({ children }) {
  const { user, isAdmin, signOut } = useAuth()
  const location = useLocation()

  const allNavLinks = [
    { to: '/', label: 'Feed', icon: '📢' },
    { to: '/report', label: 'Report', icon: '📸' },
    { to: '/my-reports', label: 'My Reports', icon: '📋' },
    { to: '/admin', label: 'Dashboard', icon: '🗺️', adminOnly: true },
  ]

  const navLinks = allNavLinks.filter(link => !link.adminOnly || isAdmin)

  return (
    <div className="min-h-screen bg-black text-white flex flex-col selection:bg-white selection:text-black">
      {/* Desktop Header */}
      <header className="sticky top-0 z-50 bg-black/90 backdrop-blur-md border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            {/* Brand Logo */}
            <Link to="/" className="flex items-center gap-3 group">
              <div className="w-9 h-9 rounded-xl bg-white text-black font-extrabold flex items-center justify-center text-lg shadow-md group-hover:scale-105 transition-transform">
                🏛️
              </div>
              <span className="font-bold text-lg tracking-tight text-white group-hover:text-zinc-300 transition-colors">
                CivicSense AI
              </span>
            </Link>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center gap-2">
              {navLinks.map(link => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    location.pathname === link.to
                      ? 'bg-white text-black font-semibold'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
                  }`}
                >
                  <span className="mr-1.5">{link.icon}</span>
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* User Profile / Sign Out */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-zinc-400 hidden sm:block truncate max-w-[180px] border border-zinc-800 px-2.5 py-1 rounded-full bg-zinc-950">
                {user?.email}
              </span>
              <button
                onClick={signOut}
                className="px-3.5 py-1.5 text-xs font-semibold text-zinc-300 hover:text-black bg-zinc-900 hover:bg-white border border-zinc-700 hover:border-white rounded-lg transition-all"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {children}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-lg border-t border-zinc-800">
        <div className="grid grid-cols-4 items-center h-16 px-2">
          {navLinks.map(link => (
            <Link
              key={link.to}
              to={link.to}
              className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all ${
                location.pathname === link.to
                  ? 'text-white font-bold'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <span className="text-lg mb-0.5">{link.icon}</span>
              <span className="text-[10px] uppercase tracking-wider">{link.label}</span>
            </Link>
          ))}
        </div>
      </nav>

      {/* Mobile Spacer */}
      <div className="md:hidden h-16" />
    </div>
  )
}
