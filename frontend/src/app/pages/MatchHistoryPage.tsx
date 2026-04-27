import { useState, useEffect, useCallback } from 'react'
import {
  ChevronDown, ChevronRight, Loader2, Clock,
  User, CalendarDays, Building2, BookOpen, ExternalLink, X,
} from 'lucide-react'
import { Badge } from '../components/ui/badge'
import { usePeerLink } from '../context/PeerLinkContext'
import { api, MatchJob } from '../../api/client'

interface JustificationModal {
  reviewerName: string
  institution: string
  justification: string
  orcid?: string
  openalex_id?: string
}

function JustificationDialog({
  modal,
  onClose,
}: {
  modal: JustificationModal
  onClose: () => void
}) {
  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <User className="w-4 h-4 text-[#849B6F]" />
              <h3 className="font-semibold text-[#203E84] text-base">{modal.reviewerName}</h3>
            </div>
            <p className="text-xs text-gray-400 pl-6">{modal.institution}</p>
          </div>
          <div className="flex items-center gap-3 ml-4 flex-shrink-0">
            {modal.orcid && (
              <a
                href={`https://orcid.org/${modal.orcid}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-[#A6CE39] hover:text-[#7aad00] hover:underline font-medium"
              >
                <ExternalLink className="w-3 h-3" />
                ORCID
              </a>
            )}
            {modal.openalex_id && (
              <a
                href={`https://openalex.org/authors/${modal.openalex_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 hover:underline font-medium"
              >
                <ExternalLink className="w-3 h-3" />
                OpenAlex
              </a>
            )}
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Justification body */}
        <div className="px-6 py-5 overflow-y-auto">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Relevance Justification</p>
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{modal.justification}</p>
        </div>
      </div>
    </div>
  )
}

function LogDialog({
  jobId,
  logs,
  onClose,
}: {
  jobId: number
  logs: Record<string, string[]>
  onClose: () => void
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const institutions = Object.keys(logs)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-semibold text-[#203E84] text-base">Agent Log</h3>
            <p className="text-xs text-gray-400 mt-0.5">Job #{jobId} · full reasoning trace</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Log body */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-6">
          {institutions.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No logs recorded for this job.</p>
          ) : (
            institutions.map((institution) => (
              <div key={institution}>
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="w-3.5 h-3.5 text-[#849B6F]" />
                  <span className="text-xs font-semibold text-[#203E84] uppercase tracking-wide">
                    {institution}
                  </span>
                  <span className="text-xs text-gray-400">({logs[institution].length} steps)</span>
                </div>
                <div className="bg-gray-950 rounded-xl p-4 space-y-2 overflow-x-auto">
                  {logs[institution].map((msg, i) => (
                    <p key={i} className="text-xs text-gray-300 font-mono leading-relaxed whitespace-pre-wrap">
                      <span className="text-gray-500 select-none mr-2">{String(i + 1).padStart(2, '0')}</span>
                      {msg}
                    </p>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatTime(date: Date): string {
  const diffSecs = Math.floor((Date.now() - date.getTime()) / 1000)
  if (diffSecs < 60) return 'Just now'
  const diffMins = Math.floor(diffSecs / 60)
  if (diffMins < 60) return `${diffMins}m ago`
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function MatchHistoryPage() {
  const { liveMatchEntries, abstracts, programs } = usePeerLink()
  const [selectedProgram, setSelectedProgram] = useState('All Programs')
  const [expandedJobs, setExpandedJobs] = useState<number[]>([])
  const [expandedLive, setExpandedLive] = useState<string[]>([])
  const [pastJobs, setPastJobs] = useState<MatchJob[]>([])
  const [loadingJobs, setLoadingJobs] = useState(true)
  const [activeModal, setActiveModal] = useState<JustificationModal | null>(null)
  const closeModal = useCallback(() => setActiveModal(null), [])
  const [activeLogJob, setActiveLogJob] = useState<{ jobId: number; logs: Record<string, string[]> } | null>(null)
  const closeLogModal = useCallback(() => setActiveLogJob(null), [])

  const programOptions = ['All Programs', ...programs]

  useEffect(() => {
    api.getMatchJobs()
      .then((jobs) => setPastJobs(jobs.filter((j) => j.status === 'done')))
      .catch(() => setPastJobs([]))
      .finally(() => setLoadingJobs(false))
  }, [])

  const toggleJob = (id: number) =>
    setExpandedJobs((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )

  const toggleLive = (id: string) =>
    setExpandedLive((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )

  const filteredLiveEntries = liveMatchEntries.filter(
    (e) => selectedProgram === 'All Programs' || e.programs.includes(selectedProgram)
  )

  const filteredPastJobs = pastJobs.filter((job) => {
    if (selectedProgram === 'All Programs') return true
    const abstract = abstracts.find((a) => a.id === job.abstract_id)
    return abstract?.program === selectedProgram
  })

  return (
    <div className="p-6 min-h-full" style={{ backgroundColor: '#E8F0DD30' }}>
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-[#203E84] mb-1">Match History</h1>
            <p className="text-gray-500 text-sm">Reviewer matches organized by abstract</p>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-600 whitespace-nowrap">Program:</label>
            <select
              value={selectedProgram}
              onChange={(e) => setSelectedProgram(e.target.value)}
              className="text-sm border-2 border-[#849B6F] rounded-lg px-4 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#849B6F] text-gray-700 min-w-[260px] shadow-sm"
            >
              {programOptions.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>

        {/* ── Live Activity ── */}
        {filteredLiveEntries.length > 0 && (
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500" />
              </span>
              <h2 className="text-[#203E84] font-bold text-lg" style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>
                Live Activity
              </h2>
              <span className="text-xs text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">
                {filteredLiveEntries.length} active
              </span>
            </div>

            <div className="space-y-2">
              {filteredLiveEntries.map((entry) => {
                const isProcessing = entry.status === 'processing'
                const isExpanded = expandedLive.includes(entry.id)
                return (
                  <div
                    key={entry.id}
                    className={`bg-white rounded-xl border-2 overflow-hidden shadow-sm ${isProcessing ? 'border-blue-200' : 'border-amber-200'}`}
                  >
                    <button
                      onClick={() => toggleLive(entry.id)}
                      className="w-full px-5 py-4 flex items-center gap-4 hover:bg-gray-50 transition-colors text-left"
                    >
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${isProcessing ? 'bg-blue-100' : 'bg-amber-100'}`}>
                        {isProcessing
                          ? <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                          : <Clock className="w-4 h-4 text-amber-500" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <Badge className={`text-xs ${isProcessing ? 'bg-blue-100 text-blue-700 border border-blue-200 hover:bg-blue-100' : 'bg-amber-100 text-amber-700 border border-amber-200 hover:bg-amber-100'}`}>
                            {isProcessing ? 'Processing' : 'In Progress'}
                          </Badge>
                          <span className="text-xs text-gray-400">{formatTime(entry.submittedAt)}</span>
                        </div>
                        <p className="text-sm font-semibold text-gray-900 truncate">{entry.abstracts[0]?.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{entry.abstracts[0]?.applicantName} · {entry.abstracts[0]?.program}</p>
                      </div>
                      {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                    </button>
                    {isProcessing && (
                      <div className="h-0.5 bg-blue-100">
                        <div className="h-full bg-blue-400 animate-pulse" style={{ width: '60%' }} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* ── Completed Jobs ── */}
        {loadingJobs ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-[#849B6F] animate-spin mr-2" />
            <span className="text-gray-500 text-sm">Loading history…</span>
          </div>
        ) : filteredPastJobs.length === 0 && filteredLiveEntries.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <BookOpen className="w-8 h-8 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600 mb-1">No matching history yet</p>
            <p className="text-sm text-gray-400">Submit abstracts for reviewer matching to see results here</p>
          </div>
        ) : filteredPastJobs.length > 0 && (
          <section>
            {filteredLiveEntries.length > 0 && (
              <h2 className="text-[#203E84] font-bold text-lg mb-3" style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>
                Completed
              </h2>
            )}
            <div className="space-y-3">
              {filteredPastJobs.map((job) => {
                const abstract = abstracts.find((a) => a.id === job.abstract_id)
                const isExpanded = expandedJobs.includes(job.id)

                const resultsArr = Array.isArray(job.results) ? job.results : []
                const reviewers = resultsArr.filter((r) => r.reviewer_name)

                // Group reviewers by institution
                const byInstitution = reviewers.reduce<Record<string, typeof reviewers>>(
                  (acc, r) => {
                    const key = r.institution ?? 'Unknown'
                    if (!acc[key]) acc[key] = []
                    acc[key].push(r)
                    return acc
                  },
                  {}
                )

                const yearRange = job.year_to
                  ? `${job.year_from}–${job.year_to}`
                  : `${job.year_from}–present`

                const hasResults = reviewers.length > 0
                const hasErrors = resultsArr.some((r) => r.parse_error)

                return (
                  <div key={job.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    {/* Card header */}
                    <button
                      onClick={() => toggleJob(job.id)}
                      className="w-full px-6 py-5 flex items-start gap-4 hover:bg-gray-50 transition-colors text-left"
                    >
                      <div className="mt-0.5 flex-shrink-0">
                        {isExpanded
                          ? <ChevronDown className="w-5 h-5 text-[#203E84]" />
                          : <ChevronRight className="w-5 h-5 text-[#203E84]" />}
                      </div>

                      {/* Abstract info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[#203E84] text-base leading-snug mb-1 pr-4">
                          {abstract?.title ?? `Abstract #${job.abstract_id}`}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                          {abstract?.applicantName && (
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {abstract.applicantName}
                            </span>
                          )}
                          {abstract?.program && (
                            <span className="flex items-center gap-1">
                              <BookOpen className="w-3 h-3" />
                              {abstract.program}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <CalendarDays className="w-3 h-3" />
                            {yearRange}
                          </span>
                          <span className="text-gray-400">
                            Matched {formatDate(job.created_at)}
                          </span>
                        </div>
                      </div>

                      {/* Right-side stats */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {hasErrors && (
                          <Badge className="bg-red-50 text-red-600 border border-red-200 hover:bg-red-50 text-xs">
                            Parse error
                          </Badge>
                        )}
                        {hasResults ? (
                          <Badge className="bg-[#E8F0DD] text-[#4a6741] border border-[#849B6F]/30 hover:bg-[#E8F0DD] text-xs font-medium">
                            {reviewers.length} reviewer{reviewers.length !== 1 ? 's' : ''}
                          </Badge>
                        ) : (
                          <Badge className="bg-gray-100 text-gray-500 border border-gray-200 hover:bg-gray-100 text-xs">
                            No results
                          </Badge>
                        )}
                        {job.logs && Object.values(job.logs).some((msgs) => msgs.length > 0) && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setActiveLogJob({ jobId: job.id, logs: job.logs! })
                            }}
                            className="text-xs text-[#203E84] hover:underline font-medium"
                          >
                            View Logs
                          </button>
                        )}
                      </div>
                    </button>

                    {/* Expanded: reviewers per institution */}
                    {isExpanded && (
                      <div className="border-t border-gray-100 bg-[#F7FAF3] px-6 py-5">
                        {hasResults ? (
                          <div className="space-y-4">
                            {Object.entries(byInstitution).map(([institution, instReviewers]) => (
                              <div key={institution}>
                                <div className="flex items-center gap-2 mb-2">
                                  <Building2 className="w-3.5 h-3.5 text-[#849B6F]" />
                                  <span className="text-xs font-semibold text-[#203E84] uppercase tracking-wide">
                                    {institution}
                                  </span>
                                  <span className="text-xs text-gray-400">({instReviewers.length})</span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {instReviewers.map((r, i) => (
                                    <div
                                      key={i}
                                      className="flex flex-col bg-white border border-[#849B6F]/40 rounded-lg px-3 py-2.5 shadow-sm min-w-[220px] max-w-[340px]"
                                    >
                                      {/* Name + h-index */}
                                      <div className="flex items-center gap-1.5 mb-1">
                                        <User className="w-3 h-3 text-[#849B6F] flex-shrink-0" />
                                        <span className="text-sm font-semibold text-gray-800">{r.reviewer_name}</span>
                                        {r.h_index != null && (
                                          <span className="text-xs text-gray-400 ml-auto pl-2 flex-shrink-0">h{r.h_index}</span>
                                        )}
                                      </div>
                                      {/* Justification preview + Read more */}
                                      {r.justification && (
                                        <div className="mb-2">
                                          <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">
                                            {r.justification}
                                          </p>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              setActiveModal({
                                                reviewerName: r.reviewer_name,
                                                institution: r.institution ?? '',
                                                justification: r.justification!,
                                                orcid: r.orcid,
                                                openalex_id: r.openalex_id,
                                              })
                                            }}
                                            className="text-xs text-[#203E84] hover:underline mt-0.5 font-medium"
                                          >
                                            Read more
                                          </button>
                                        </div>
                                      )}
                                      {/* Profile links */}
                                      <div className="flex items-center gap-3 mt-auto pt-1 border-t border-gray-100">
                                        {r.orcid && (
                                          <a
                                            href={`https://orcid.org/${r.orcid}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={(e) => e.stopPropagation()}
                                            className="flex items-center gap-0.5 text-xs text-[#A6CE39] hover:text-[#7aad00] hover:underline font-medium"
                                          >
                                            <ExternalLink className="w-2.5 h-2.5" />
                                            ORCID
                                          </a>
                                        )}
                                        {r.openalex_id && (
                                          <a
                                            href={`https://openalex.org/authors/${r.openalex_id}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={(e) => e.stopPropagation()}
                                            className="flex items-center gap-0.5 text-xs text-blue-500 hover:text-blue-700 hover:underline font-medium"
                                          >
                                            <ExternalLink className="w-2.5 h-2.5" />
                                            OpenAlex
                                          </a>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500 italic">
                            {hasErrors
                              ? 'Reviewer results could not be parsed for this job. Re-run matching to get results.'
                              : 'No reviewers were found for this abstract.'}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )}

      </div>
      {activeModal && <JustificationDialog modal={activeModal} onClose={closeModal} />}
      {activeLogJob && <LogDialog jobId={activeLogJob.jobId} logs={activeLogJob.logs} onClose={closeLogModal} />}
    </div>
  )
}
