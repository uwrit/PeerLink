import { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight, Loader2, Clock, CheckCircle2 } from 'lucide-react'
import { usePeerLink } from '../context/PeerLinkContext'
import { api, MatchJob } from '../../api/client'

function formatTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  if (diffSecs < 60) return 'Just now'
  const diffMins = Math.floor(diffSecs / 60)
  if (diffMins < 60) return `${diffMins}m ago`
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function MatchHistoryPage() {
  const { liveMatchEntries, programs } = usePeerLink()
  const [selectedProgram, setSelectedProgram] = useState('All Programs')
  const [expandedJobs, setExpandedJobs] = useState<number[]>([])
  const [expandedLive, setExpandedLive] = useState<string[]>([])
  const [pastJobs, setPastJobs] = useState<MatchJob[]>([])
  const [loadingJobs, setLoadingJobs] = useState(true)

  const programOptions = ['All Programs', ...programs]

  useEffect(() => {
    api.getMatchJobs()
      .then((jobs) => setPastJobs(jobs.filter((j) => j.status === 'done')))
      .catch(() => setPastJobs([]))
      .finally(() => setLoadingJobs(false))
  }, [])

  const toggleJob = (id: number) =>
    setExpandedJobs((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])

  const toggleLive = (id: string) =>
    setExpandedLive((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])

  const filteredLiveEntries = liveMatchEntries.filter(
    (entry) => selectedProgram === 'All Programs' || entry.programs.includes(selectedProgram)
  )

  return (
    <div className="p-6 space-y-5 max-w-6xl mx-auto">

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Match History</h1>
          <p className="text-sm text-gray-500 mt-0.5">Active submissions and completed matching jobs</p>
        </div>
        <select
          value={selectedProgram}
          onChange={(e) => setSelectedProgram(e.target.value)}
          className="text-xs border border-gray-200 rounded px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#1e3a6e] min-w-[220px]"
        >
          {programOptions.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {/* Live Activity */}
      {filteredLiveEntries.length > 0 && (
        <div className="bg-white rounded border border-gray-200">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
            </span>
            <h2 className="text-sm font-semibold text-gray-900">Live Activity</h2>
            <span className="ml-1 text-[11px] text-gray-400 bg-gray-100 rounded-full px-1.5 py-0.5">
              {filteredLiveEntries.length}
            </span>
          </div>

          <div className="divide-y divide-gray-50">
            {filteredLiveEntries.map((entry) => {
              const isProcessing = entry.status === 'processing'
              const isExpanded = expandedLive.includes(entry.id)

              return (
                <div key={entry.id}>
                  <button
                    onClick={() => toggleLive(entry.id)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={`w-7 h-7 rounded flex items-center justify-center flex-shrink-0 ${isProcessing ? 'bg-blue-50' : 'bg-amber-50'}`}>
                        {isProcessing
                          ? <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />
                          : <Clock className="w-3.5 h-3.5 text-amber-500" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${isProcessing ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>
                            {isProcessing ? 'Processing' : 'In Progress'}
                          </span>
                          <span className="text-[11px] text-gray-400">{formatTime(entry.submittedAt)}</span>
                        </div>
                        <p className="text-sm font-medium text-gray-800 truncate">
                          {entry.abstracts[0]?.title}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {entry.abstracts[0]?.applicantName} · {entry.abstracts[0]?.program}
                        </p>
                      </div>
                    </div>
                    {isExpanded
                      ? <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      : <ChevronRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />}
                  </button>

                  {isProcessing && (
                    <div className="h-0.5 bg-blue-50 overflow-hidden mx-4">
                      <div className="h-full bg-blue-300 animate-pulse" style={{ width: '60%' }} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Past Jobs */}
      {!loadingJobs && pastJobs.length > 0 && (
        <div className="bg-white rounded border border-gray-200">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
            <h2 className="text-sm font-semibold text-gray-900">Completed Jobs</h2>
            <span className="ml-1 text-[11px] text-gray-400 bg-gray-100 rounded-full px-1.5 py-0.5">
              {pastJobs.length}
            </span>
          </div>

          <div className="divide-y divide-gray-50">
            {pastJobs.map((job) => {
              const isExpanded = expandedJobs.includes(job.id)
              const institutionNames = job.institutions.map((i) => i.name).join(', ')
              const reviewerCount = Object.values(job.results ?? {}).reduce((sum, arr) => sum + arr.length, 0)
              return (
                <div key={job.id}>
                  <button
                    onClick={() => toggleJob(job.id)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded
                        ? <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                        : <ChevronRight className="h-3.5 w-3.5 text-gray-400" />}
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-medium text-gray-800">{institutionNames || `Job #${job.id}`}</span>
                          <span className="text-[11px] font-medium text-green-700 bg-green-50 px-1.5 py-0.5 rounded">Completed</span>
                        </div>
                        <p className="text-xs text-gray-500">{new Date(job.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 text-xs text-gray-500">
                      <div className="text-right">
                        <p className="font-semibold text-gray-800 text-sm">{job.abstract_ids?.length ?? 1}</p>
                        <p>Abstracts</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-800 text-sm">{reviewerCount}</p>
                        <p>Reviewers</p>
                      </div>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-gray-100 px-4 py-3 bg-gray-50">
                      <p className="text-xs font-medium text-gray-700 mb-3 uppercase tracking-wide">Reviewer Results by Institution</p>
                      <div className="space-y-3">
                        {Object.entries(job.results ?? {}).map(([institution, reviewers]) => (
                          <div key={institution} className="bg-white rounded border border-gray-200 px-3 py-2.5">
                            <p className="text-xs font-semibold text-gray-700 mb-2">{institution}</p>
                            <div className="flex flex-wrap gap-1.5">
                              {reviewers.map((r, idx) => (
                                <span key={idx} className="text-[11px] border border-gray-200 text-gray-600 px-2 py-0.5 rounded">
                                  {r.reviewer_name}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {loadingJobs && (
        <div className="bg-white rounded border border-gray-200 py-10 text-center">
          <Loader2 className="h-5 w-5 text-gray-300 animate-spin mx-auto" />
        </div>
      )}

      {pastJobs.length === 0 && filteredLiveEntries.length === 0 && !loadingJobs && (
        <div className="bg-white rounded border border-gray-200 py-16 text-center">
          <p className="text-sm text-gray-500 mb-1">No matching activity yet</p>
          <p className="text-xs text-gray-400">Submit abstracts for reviewer matching to see activity here</p>
        </div>
      )}
    </div>
  )
}
