import { useState } from 'react'
import { Outlet, Link, useLocation } from 'react-router'
import {
  LayoutDashboard, FileText, FilePlus, History,
  Settings, ChevronLeft, Menu,
} from 'lucide-react'

const NAV = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: FileText,        label: 'Abstracts',  path: '/abstracts' },
  { icon: FilePlus,        label: 'Add Abstract', path: '/manual-entry' },
  { icon: History,         label: 'Match History', path: '/match-history' },
  { icon: Settings,        label: 'Account',    path: '/account' },
]

export function Layout() {
  const [collapsed, setCollapsed] = useState(false)
  const { pathname } = useLocation()

  return (
    <div className="flex h-screen overflow-hidden bg-[#f8fafc]">
      {/* Sidebar */}
      <aside className={`flex flex-col bg-white border-r border-gray-200 transition-all duration-200 ${collapsed ? 'w-14' : 'w-56'}`}>
        {/* Logo */}
        <div className="flex items-center justify-between px-3 h-14 border-b border-gray-200 flex-shrink-0">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-[#4b2e83] flex items-center justify-center">
                <span className="text-white text-xs font-bold">P</span>
              </div>
              <span className="text-sm font-semibold text-gray-900">PeerLink</span>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={`p-1.5 rounded hover:bg-gray-100 text-gray-400 transition-colors ${collapsed ? 'mx-auto' : ''}`}
          >
            {collapsed ? <Menu className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
          {NAV.map(({ icon: Icon, label, path }) => {
            const active = pathname === path
            return (
              <Link
                key={path}
                to={path}
                title={collapsed ? label : undefined}
                className={`flex items-center gap-2.5 px-2.5 py-2 rounded text-sm transition-colors ${
                  active
                    ? 'bg-[#4b2e83] text-white font-medium'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                } ${collapsed ? 'justify-center' : ''}`}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                {!collapsed && <span>{label}</span>}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        {!collapsed && (
          <div className="px-3 py-3 border-t border-gray-200 flex-shrink-0">
            <p className="text-[11px] text-gray-400 leading-tight">ITHS PeerLink</p>
            <p className="text-[11px] text-gray-300">Reviewer Matching System</p>
          </div>
        )}
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-5 flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-[#4b2e83]">
              Institute for Translational Health Sciences
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="text-right">
              <p className="text-xs font-medium text-gray-700">Program Coordinator</p>
              <p className="text-[11px] text-gray-400">ITHS · University of Washington</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-[#4b2e83] flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
              PC
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
