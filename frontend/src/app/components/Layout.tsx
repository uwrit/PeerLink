import { useState } from 'react'
import { Outlet, Link, useLocation } from 'react-router'
import { Menu, LayoutDashboard, History, ChevronLeft, FileText, Search, Settings } from 'lucide-react'
import ithsLogo from '../../assets/iths_logo.png'

export function Layout() {
  const [isOpen, setIsOpen] = useState(true)
  const location = useLocation()

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`bg-[#E8F0DD] border-r border-[rgba(0,0,0,0.1)] transition-all duration-300 flex flex-col ${
          isOpen ? 'w-64' : 'w-16'
        }`}
      >
        <div className="p-4 flex items-center justify-between border-b border-[rgba(0,0,0,0.1)]">
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
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-[rgba(0,0,0,0.1)] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src={ithsLogo} alt="Institute of Translational Health Sciences" className="h-8 w-auto" />
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-sm font-medium text-[#203E84]">Program Coordinator</div>
              <div className="text-xs text-gray-600">ITHS</div>
            </div>
            <div className="w-10 h-10 rounded-full bg-[#849B6F] flex items-center justify-center text-white font-medium text-sm">
              PC
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto bg-white">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
