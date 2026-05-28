import { useState } from 'react'
import { Outlet, Link, useLocation } from 'react-router'
import { Menu, LayoutDashboard, History, ChevronLeft, FileText, Search, Settings } from 'lucide-react'
import ithsLogo from '../../assets/iths_logo.png'
import { Footer } from './Footer'

export function Layout() {
  const [isOpen, setIsOpen] = useState(true)
  const location = useLocation()

  return (
    <div className="min-h-screen flex flex-col">
      {/* Sidebar + Main Content row */}
      <div className="flex flex-1">
        {/* Sidebar */}
        <aside
          className={`bg-[#E8F0DD] border-r border-[rgba(0,0,0,0.1)] flex flex-col sticky top-0 h-screen z-10 flex-shrink-0 ${
            isOpen ? 'w-64' : 'w-16'
          }`}
        >
          <div className="h-[69px] px-4 flex items-center justify-between border-b border-[rgba(0,0,0,0.1)]">
            {isOpen && <h2 className="text-xl font-semibold text-black">PeerLink</h2>}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className={`p-2 rounded-lg hover:bg-white/50 transition-colors text-black ${!isOpen ? 'mx-auto' : ''}`}
            >
              {isOpen ? <ChevronLeft className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>

          <nav className="flex-1 p-4">
            <div className="space-y-2">
              {[
                { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
                { icon: FileText, label: 'Abstracts', path: '/abstracts' },
                { icon: Search, label: 'Find Reviewers', path: '/find-reviewers' },
                { icon: History, label: 'Match History', path: '/match-history' },
                { icon: Settings, label: 'Settings', path: '/settings' },
              ].map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                    location.pathname === item.path
                      ? 'bg-[#849B6F] text-white'
                      : 'text-black hover:bg-white/50'
                  } ${!isOpen ? 'justify-center' : ''}`}
                >
                  <item.icon className="h-5 w-5 flex-shrink-0" />
                  {isOpen && <span className="text-sm font-medium">{item.label}</span>}
                </Link>
              ))}
            </div>
          </nav>
        </aside>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0">
          <header className="bg-white border-b border-[rgba(0,0,0,0.1)] h-[69px] px-6 flex items-center">
            <div className="flex items-center gap-4">
              <img src={ithsLogo} alt="Institute of Translational Health Sciences" className="h-10 w-auto" />
            </div>
          </header>

          <main className="flex-1 bg-white">
            <Outlet />
          </main>
        </div>
      </div>

      {/* Footer */}
      <Footer />
    </div>
  )
}
