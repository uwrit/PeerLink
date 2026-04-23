import { useState } from 'react'
import { Link } from 'react-router'
import { FileText, Clock, AlertCircle, CheckCircle2, RefreshCw, ArrowRight } from 'lucide-react'
import { usePeerLink } from '../context/PeerLinkContext'

export function DashboardPage() {
  const { abstracts, programs, syncGravityForms } = usePeerLink()
  const [selectedProgram, setSelectedProgram] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)

  const displayPrograms = programs.length > 0 ? programs : []
  const activeProgram = selectedProgram || displayPrograms[0] || ''

  const total = abstracts.length
  const unmatched = abstracts.filter((a) => a.matchStatus === 'unmatched').length
  const inProgress = abstracts.filter((a) => a.matchStatus === 'in-progress' || a.matchStatus === 'processing').length
  const matched = abstracts.filter((a) => a.matchStatus === 'matched').length

  const getProgramStats = (program: string) => {
    const list = abstracts.filter((a) => a.program === program)
    return {
      total: list.length,
      unmatched: list.filter((a) => a.matchStatus === 'unmatched').length,
      inProgress: list.filter((a) => a.matchStatus === 'in-progress' || a.matchStatus === 'processing').length,
      matched: list.filter((a) => a.matchStatus === 'matched').length,
    }
  }

  const stats = getProgramStats(activeProgram)

  const handleSync = async () => {
    setSyncing(true)
    setSyncMsg(null)
    try {
      const { synced } = await syncGravityForms()
      setSyncMsg(`Synced ${synced} abstract${synced !== 1 ? 's' : ''}`)
    } catch {
      setSyncMsg('Sync failed — check backend logs')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="p-6 space-y-5 max-w-6xl mx-auto">

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Abstract matching activity overview</p>
        </div>
        <div className="flex items-center gap-3">
          {syncMsg && <span className="text-xs text-gray-500">{syncMsg}</span>}
          <button
            onClick={handleSync}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing…' : 'Sync Gravity Forms'}
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total Abstracts', value: total, icon: FileText, color: 'text-[#4b2e83]', border: 'border-[#4b2e83]/20' },
          { label: 'Unmatched', value: unmatched, icon: AlertCircle, color: 'text-red-600', border: 'border-red-100' },
          { label: 'In Progress', value: inProgress, icon: Clock, color: 'text-amber-600', border: 'border-amber-100' },
          { label: 'Matched', value: matched, icon: CheckCircle2, color: 'text-green-700', border: 'border-green-100' },
        ].map(({ label, value, icon: Icon, color, border }) => (
          <div key={label} className={`bg-white rounded border ${border} px-4 py-3.5`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
              <Icon className={`h-4 w-4 ${color}`} />
            </div>
            <p className={`text-2xl font-semibold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Program breakdown */}
      <div className="bg-white rounded border border-gray-200">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900">Program Breakdown</h2>
          {displayPrograms.length > 0 && (
            <select
              value={activeProgram}
              onChange={(e) => setSelectedProgram(e.target.value)}
              className="text-xs border border-gray-200 rounded px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#4b2e83] min-w-[240px]"
            >
              {displayPrograms.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          )}
        </div>

        <div className="px-4 py-4">
          {/* Mini stats */}
          <div className="grid grid-cols-4 gap-3 mb-4">
            {[
              { label: 'Total', value: stats.total, color: 'text-[#4b2e83]' },
              { label: 'Unmatched', value: stats.unmatched, color: 'text-red-600' },
              { label: 'In Progress', value: stats.inProgress, color: 'text-amber-600' },
              { label: 'Matched', value: stats.matched, color: 'text-green-700' },
            ].map(({ label, value, color }) => (
              <div key={label} className="text-center py-2 bg-gray-50 rounded">
                <p className={`text-xl font-semibold ${color}`}>{value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          {stats.total > 0 && (
            <div>
              <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                <span>Matching progress</span>
                <span>{Math.round((stats.matched / stats.total) * 100)}% complete</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden flex">
                <div className="bg-green-600 h-full transition-all" style={{ width: `${(stats.matched / stats.total) * 100}%` }} />
                <div className="bg-amber-400 h-full transition-all" style={{ width: `${(stats.inProgress / stats.total) * 100}%` }} />
                <div className="bg-red-300 h-full transition-all" style={{ width: `${(stats.unmatched / stats.total) * 100}%` }} />
              </div>
              <div className="flex gap-4 mt-1.5 text-[11px] text-gray-400">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-600 inline-block" />Matched</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />In Progress</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-300 inline-block" />Unmatched</span>
              </div>
            </div>
          )}
        </div>

        <div className="px-4 pb-4">
          <Link
            to="/abstracts"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#4b2e83] hover:underline"
          >
            View abstracts for this program <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {/* All programs table */}
      {displayPrograms.length > 0 && (
        <div className="bg-white rounded border border-gray-200">
          <div className="px-4 py-3 border-b border-gray-200">
            <h2 className="text-sm font-semibold text-gray-900">All Programs</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Program</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide w-20">Total</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide w-24">Unmatched</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide w-24">Matched</th>
                <th className="px-4 py-2.5 w-40"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {displayPrograms.map((program) => {
                const ps = getProgramStats(program)
                const pct = ps.total > 0 ? Math.round((ps.matched / ps.total) * 100) : 0
                return (
                  <tr key={program} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm text-gray-800 font-medium">{program}</td>
                    <td className="px-4 py-3 text-right text-sm text-gray-600">{ps.total}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-xs font-medium text-red-600 bg-red-50 px-1.5 py-0.5 rounded">{ps.unmatched}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-xs font-medium text-green-700 bg-green-50 px-1.5 py-0.5 rounded">{ps.matched}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="bg-green-600 h-full rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[11px] text-gray-400 w-8 text-right">{pct}%</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {abstracts.length === 0 && (
        <div className="bg-white rounded border border-gray-200 py-16 text-center">
          <p className="text-sm text-gray-500 mb-3">No abstracts synced yet.</p>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="px-4 py-2 rounded bg-[#4b2e83] text-white text-sm font-medium hover:bg-[#3b2468] disabled:opacity-50 transition-colors"
          >
            {syncing ? 'Syncing…' : 'Sync from Gravity Forms'}
          </button>
        </div>
      )}
    </div>
  )
}
