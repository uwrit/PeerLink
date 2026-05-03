import { useState } from 'react'
import { Link } from 'react-router'
import { FileText, Clock, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react'
import { Badge } from '../components/ui/badge'
import { usePeerLink, PROGRAMS } from '../context/PeerLinkContext'

export function DashboardPage() {
  const { abstracts, syncGravityForms } = usePeerLink()
  const [selectedProgram, setSelectedProgram] = useState<string>('')
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)

  const activeProgram = selectedProgram || PROGRAMS[0] || ''

  const totalStats = {
    total: abstracts.length,
    unmatched: abstracts.filter((a) => a.matchStatus === 'unmatched').length,
    inProgress: abstracts.filter((a) => a.matchStatus === 'in-progress' || a.matchStatus === 'processing').length,
    matched: abstracts.filter((a) => a.matchStatus === 'matched').length,
  }

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
      setSyncMsg(`Synced ${synced} abstract${synced !== 1 ? 's' : ''} from Gravity Forms`)
    } catch (e) {
      setSyncMsg('Sync failed — check backend logs')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 p-6 overflow-auto bg-[#E8F0DD]/30">
        <div className="max-w-7xl mx-auto">

          {/* Header */}
          <div className="mb-8 flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-[#203E84] mb-2">Dashboard</h1>
              <p className="text-gray-700">Overview of all abstract matching activity across programs</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <button
                onClick={handleSync}
                disabled={syncing}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-[#203E84] text-[#203E84] hover:bg-[#203E84] hover:text-white transition-colors text-sm font-medium disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Syncing…' : 'Sync from Gravity Forms'}
              </button>
              {syncMsg && <p className="text-xs text-gray-500">{syncMsg}</p>}
            </div>
          </div>

          {/* Overall Stats */}
          <div className="grid grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Total Abstracts', value: totalStats.total, color: 'text-[#203E84]', icon: FileText },
              { label: 'Unmatched', value: totalStats.unmatched, color: 'text-red-600', icon: AlertCircle },
              { label: 'In Progress', value: totalStats.inProgress, color: 'text-amber-600', icon: Clock },
              { label: 'Matched', value: totalStats.matched, color: 'text-[#849B6F]', icon: CheckCircle2 },
            ].map((stat) => (
              <div key={stat.label} className="bg-white rounded-xl shadow-sm p-5 border border-gray-200">
                <div className="flex items-center gap-3 mb-2">
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                  <span className="text-xs text-gray-500">{stat.label}</span>
                </div>
                <p className={`text-3xl font-semibold ${stat.color}`}>{stat.value}</p>
              </div>
            ))}
          </div>

          <div className="space-y-6">
            {/* Program Breakdown */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                <h2 className="font-semibold text-[#203E84]">Program Breakdown</h2>
                <select
                  value={activeProgram}
                  onChange={(e) => setSelectedProgram(e.target.value)}
                  className="text-sm border-2 border-[#849B6F] rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#849B6F] font-medium text-gray-700 min-w-[260px]"
                >
                  {PROGRAMS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              <div className="p-5">
                <div className="grid grid-cols-4 gap-4 mb-5">
                  {[
                    { label: 'Total', value: stats.total, color: 'text-[#203E84]', bg: 'bg-[#E8F0DD]/40' },
                    { label: 'Unmatched', value: stats.unmatched, color: 'text-red-600', bg: 'bg-red-50' },
                    { label: 'In Progress', value: stats.inProgress, color: 'text-amber-600', bg: 'bg-amber-50' },
                    { label: 'Matched', value: stats.matched, color: 'text-[#849B6F]', bg: 'bg-green-50' },
                  ].map((s) => (
                    <div key={s.label} className={`${s.bg} rounded-xl p-4 text-center`}>
                      <p className={`text-2xl font-semibold ${s.color}`}>{s.value}</p>
                      <p className="text-xs text-gray-500 mt-1">{s.label}</p>
                    </div>
                  ))}
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                    <span>Matching Progress</span>
                    <span>{stats.total > 0 ? Math.round((stats.matched / stats.total) * 100) : 0}% complete</span>
                  </div>
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden flex">
                    <div className="bg-[#849B6F] h-full transition-all duration-500" style={{ width: `${stats.total > 0 ? (stats.matched / stats.total) * 100 : 0}%` }} />
                    <div className="bg-amber-300 h-full transition-all duration-500" style={{ width: `${stats.total > 0 ? (stats.inProgress / stats.total) * 100 : 0}%` }} />
                    <div className="bg-red-200 h-full transition-all duration-500" style={{ width: `${stats.total > 0 ? (stats.unmatched / stats.total) * 100 : 0}%` }} />
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#849B6F] inline-block" /> Matched</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-300 inline-block" /> In Progress</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-200 inline-block" /> Unmatched</span>
                  </div>
                </div>
              </div>

              <div className="px-5 pb-5">
                <Link
                  to="/abstracts"
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg border-2 border-[#203E84] text-[#203E84] hover:bg-[#203E84] hover:text-white transition-colors text-sm font-medium"
                >
                  <FileText className="h-4 w-4" />
                  View All Abstracts for This Program
                </Link>
              </div>
            </div>

            {/* All Programs Summary */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-5 border-b border-gray-100">
                <h2 className="font-semibold text-[#203E84]">All Programs Summary</h2>
              </div>
              <div className="divide-y divide-gray-100">
                  {PROGRAMS.map((program) => {
                    const ps = getProgramStats(program)
                    const pct = ps.total > 0 ? Math.round((ps.matched / ps.total) * 100) : 0
                    return (
                      <div key={program} className="px-5 py-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-medium text-gray-800">{program}</p>
                          <div className="flex items-center gap-2">
                            <Badge className="bg-red-100 text-red-700 hover:bg-red-100 text-xs">{ps.unmatched} unmatched</Badge>
                            <Badge className="bg-[#849B6F] text-white hover:bg-[#849B6F] text-xs">{ps.matched} matched</Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className="bg-[#849B6F] h-full rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-gray-500 w-16 text-right">{pct}% done</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

            {abstracts.length === 0 && (
              <div className="bg-white rounded-xl shadow-sm p-12 text-center border border-gray-200">
                <p className="text-gray-500 mb-4">No abstracts yet.</p>
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className="px-6 py-2 rounded-lg bg-[#203E84] text-white text-sm font-medium hover:bg-[#203E84]/90 disabled:opacity-50"
                >
                  {syncing ? 'Syncing…' : 'Sync from Gravity Forms'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
