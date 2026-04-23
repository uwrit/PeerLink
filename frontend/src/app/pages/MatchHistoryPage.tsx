import { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight, Loader2, Clock, CheckCircle2 } from 'lucide-react'
import { Badge } from '../components/ui/badge'
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
    <div className="p-6 min-h-full" style={{ backgroundColor: '#E8F0DD30' }}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-[#203E84] mb-2">Match History</h1>
            <p className="text-gray-700">Track active submissions and review past matching jobs</p>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Program:</label>
            <select
              value={selectedProgram}
              onChange={(e) => setSelectedProgram(e.target.value)}
              className="text-sm border-2 border-[#849B6F] rounded-lg px-4 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-[#849B6F] font-medium text-gray-700 min-w-[260px] shadow-sm"
            >
              {programOptions.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>

        {/* Live Activity */}
        {filteredLiveEntries.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500" />
              </span>
              <h2 className="text-[#203E84]" style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '1.2rem', fontWeight: 700 }}>
                Live Activity
              </h2>
              <span className="text-xs text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">
                {filteredLiveEntries.length} active
              </span>
            </div>

            <div className="space-y-3">
              {filteredLiveEntries.map((entry) => {
                const isProcessing = entry.status === 'processing'
                const isExpanded = expandedLive.includes(entry.id)

                return (
                  <div
                    key={entry.id}
                    className={`bg-white rounded-xl shadow-sm border-2 overflow-hidden ${isProcessing ? 'border-blue-200' : 'border-amber-200'}`}
                  >
                    <button
                      onClick={() => toggleLive(entry.id)}
                      className="w-full p-5 flex items-center justify-between hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${isProcessing ? 'bg-blue-100' : 'bg-amber-100'}`}>
                          {isProcessing
                            ? <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                            : <Clock className="w-5 h-5 text-amber-500" />}
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <Badge className={`text-xs font-medium ${isProcessing ? 'bg-blue-100 text-blue-700 hover:bg-blue-100 border border-blue-200' : 'bg-amber-100 text-amber-700 hover:bg-amber-100 border border-amber-200'}`}>
                              {isProcessing ? 'Processing' : 'In Progress'}
                            </Badge>
                            <span className="text-xs text-gray-400">{formatTime(entry.submittedAt)}</span>
                          </div>
                          <p className="text-sm font-medium text-gray-900 leading-snug truncate">
                            {entry.abstracts[0]?.title}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {entry.abstracts[0]?.applicantName} · {entry.abstracts[0]?.program}
                          </p>
                        </div>
                      </div>
                      {isExpanded
                        ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                    </button>

                    {isProcessing && (
                      <div className="h-1 bg-blue-100 overflow-hidden">
                        <div className="h-full bg-blue-400 animate-pulse" style={{ width: '60%' }} />
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
          <div>
            {filteredLiveEntries.length > 0 && (
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle2 className="w-4 h-4 text-[#849B6F]" />
                <h2 className="text-[#203E84]" style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '1.2rem', fontWeight: 700 }}>
                  Past Jobs
                </h2>
              </div>
            )}
            <div className="space-y-4">
              {pastJobs.map((job) => {
                const isExpanded = expandedJobs.includes(job.id)
                const institutionNames = job.institutions.map((i) => i.name).join(', ')

                // results is a flat array; filter to real reviewer entries (have orcid or h_index)
                const resultsArr = Array.isArray(job.results) ? job.results : []
                const realReviewers = resultsArr.filter((r) => r.orcid || r.h_index != null)

                // group by institution
                const byInstitution = realReviewers.reduce<Record<string, typeof realReviewers>>((acc, r) => {
                  const key = r.institution ?? 'Unknown'
                  if (!acc[key]) acc[key] = []
                  acc[key].push(r)
                  return acc
                }, {})

                return (
                  <div key={job.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                    <button
                      onClick={() => toggleJob(job.id)}
                      className="w-full p-6 flex items-center justify-between hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        {isExpanded
                          ? <ChevronDown className="h-5 w-5 text-[#203E84]" />
                          : <ChevronRight className="h-5 w-5 text-[#203E84]" />}
                        <div className="text-left">
                          <div className="flex items-center gap-3 mb-1">
                            <h3 className="font-semibold text-lg text-[#203E84]">{institutionNames || 'Job #' + job.id}</h3>
                            <Badge className="bg-[#849B6F] text-white hover:bg-[#849B6F]">Completed</Badge>
                          </div>
                          <p className="text-sm text-gray-600">{new Date(job.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6 text-sm">
                        <div className="text-center">
                          <div className="font-semibold text-[#203E84]">{job.abstract_ids?.length ?? 1}</div>
                          <div className="text-gray-600">Abstracts</div>
                        </div>
                        <div className="text-center">
                          <div className="font-semibold text-[#203E84]">{realReviewers.length}</div>
                          <div className="text-gray-600">Reviewers</div>
                        </div>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-gray-200 p-6 bg-[#E1EFD4]/30">
                        <h4 className="font-semibold text-[#203E84] mb-4">Reviewer Results by Institution</h4>
                        <div className="space-y-4">
                          {Object.entries(byInstitution).map(([institution, reviewers]) => (
                            <div key={institution} className="bg-white rounded-lg p-4 border border-gray-200">
                              <h5 className="font-medium text-[#203E84] mb-3">{institution}</h5>
                              <div className="flex flex-wrap gap-2">
                                {reviewers.map((r, idx) => (
                                  <Badge key={idx} variant="outline" className="border-[#849B6F] text-[#849B6F]">
                                    {r.reviewer_name}
                                  </Badge>
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

        {/* Empty State */}
        {pastJobs.length === 0 && filteredLiveEntries.length === 0 && !loadingJobs && (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <p className="text-gray-600 mb-2">No matching activity yet</p>
            <p className="text-sm text-gray-500">Submit abstracts for reviewer matching to see activity here</p>
          </div>
        )}
      </div>
    </div>
  )
}
