import { useState, useEffect, useRef } from 'react'
import {
  Search, ChevronRight, Building2, User, Mail, BookOpen,
  Plus, Minus, X, FileText, ChevronDown,
  AlertCircle, Loader2, CheckCircle2,
} from 'lucide-react'
import { usePeerLink, type MatchStatus, type MatchPayload } from '../context/PeerLinkContext'
import { useMatchingWS } from '../../lib/useMatchingWS'

const STATUS: Record<MatchStatus, { label: string; cls: string; dot: string }> = {
  unmatched:   { label: 'Unmatched',   cls: 'text-red-700 bg-red-50 border-red-200',       dot: 'bg-red-500' },
  processing:  { label: 'Processing',  cls: 'text-blue-700 bg-blue-50 border-blue-200',     dot: 'bg-blue-500' },
  'in-progress':{ label: 'In Progress', cls: 'text-amber-700 bg-amber-50 border-amber-200', dot: 'bg-amber-500' },
  matched:     { label: 'Matched',     cls: 'text-green-700 bg-green-50 border-green-200',  dot: 'bg-green-600' },
}

export function AbstractsPage() {
  const { abstracts, programs, institutions, submitForReview, removeLiveEntry, updateLiveEntry } = usePeerLink()

  const [selectedId, setSelectedId] = useState<number | null>(null)
  const selectedApp = abstracts.find((a) => a.id === selectedId) ?? null

  const [search, setSearch] = useState('')
  const [programFilter, setProgramFilter] = useState('All Programs')
  const [statusFilter, setStatusFilter] = useState('all')

  const [selInstitutions, setSelInstitutions] = useState<string[]>([])
  const [reviewerCounts, setReviewerCounts] = useState<Record<string, number>>({})
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [fromYear, setFromYear] = useState(2021)
  const [toYear, setToYear] = useState(2026)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)
  const [activeJobId, setActiveJobId] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setSelInstitutions([])
    setReviewerCounts({})
    setFromYear(2021)
    setToYear(2026)
    setSubmitted(false)
    setErrors({})
    setDropdownOpen(false)
    setActiveJobId(null)
  }, [selectedId])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setDropdownOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useMatchingWS(activeJobId, (event) => {
    if (!activeJobId) return
    if (event.type === 'progress' && event.status === 'running') updateLiveEntry(activeJobId, 'in-progress')
    if (event.type === 'done') { removeLiveEntry(activeJobId); setActiveJobId(null) }
  })

  const programOptions = ['All Programs', ...programs]

  const filtered = abstracts.filter((a) => {
    const matchProg = programFilter === 'All Programs' || a.program === programFilter
    const matchSearch = !search ||
      a.applicantName.toLowerCase().includes(search.toLowerCase()) ||
      a.title.toLowerCase().includes(search.toLowerCase()) ||
      a.affiliation.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || a.matchStatus === statusFilter
    return matchProg && matchSearch && matchStatus
  })

  const toggleInstitution = (uni: string) => {
    setSelInstitutions((prev) => {
      if (prev.includes(uni)) return prev.filter((u) => u !== uni)
      setReviewerCounts((c) => ({ ...c, [uni]: c[uni] ?? 3 }))
      return [...prev, uni]
    })
  }

  const validate = () => {
    const errs: Record<string, string> = {}
    if (selInstitutions.length === 0) errs.institutions = 'Select at least one institution.'
    if (fromYear > toYear) errs.years = 'Start year must be before end year.'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleFind = async () => {
    if (!validate() || !selectedApp) return
    setSubmitting(true)
    try {
      const payload: MatchPayload = {
        institutions: selInstitutions.map((name) => ({ name, count: reviewerCounts[name] ?? 3 })),
        year_from: fromYear,
        year_to: toYear,
      }
      const jobId = await submitForReview(selectedApp.id, payload)
      setActiveJobId(jobId)
      setSubmitted(true)
    } catch (e) {
      setErrors({ submit: (e as Error).message })
    } finally {
      setSubmitting(false)
    }
  }

  const isActive = selectedApp?.matchStatus === 'processing' || selectedApp?.matchStatus === 'in-progress'
  const showResult = submitted || isActive

  const counts = {
    total: filtered.length,
    unmatched: filtered.filter((a) => a.matchStatus === 'unmatched').length,
    inProgress: filtered.filter((a) => a.matchStatus === 'in-progress').length,
    matched: filtered.filter((a) => a.matchStatus === 'matched').length,
  }

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── List panel ── */}
      <div
        className="flex flex-col border-r border-gray-200 bg-white flex-shrink-0"
        style={{ width: selectedApp ? '340px' : '100%', minWidth: '280px' }}
      >
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-gray-200 space-y-2.5 flex-shrink-0">
          <div className="flex items-center justify-between">
            <h1 className="text-base font-semibold text-gray-900">Abstracts</h1>
            <span className="text-xs text-gray-400">{counts.total} shown</span>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search name, title, institution…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded bg-white outline-none focus:ring-1 focus:ring-[#1e3a6e] focus:border-[#1e3a6e] placeholder:text-gray-400"
            />
          </div>

          {/* Filters */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <select
                value={programFilter}
                onChange={(e) => setProgramFilter(e.target.value)}
                className="w-full appearance-none text-xs border border-gray-200 rounded px-2.5 py-1.5 bg-white text-gray-700 outline-none focus:ring-1 focus:ring-[#1e3a6e] cursor-pointer truncate pr-6"
              >
                {programOptions.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
            </div>
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="appearance-none text-xs border border-gray-200 rounded px-2.5 py-1.5 pr-6 bg-white text-gray-700 outline-none focus:ring-1 focus:ring-[#1e3a6e] cursor-pointer"
              >
                <option value="all">All Status</option>
                <option value="unmatched">Unmatched</option>
                <option value="processing">Processing</option>
                <option value="in-progress">In Progress</option>
                <option value="matched">Matched</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
            </div>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <FileText className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-sm">No abstracts found</p>
            </div>
          ) : filtered.map((app) => {
            const s = STATUS[app.matchStatus]
            const active = selectedApp?.id === app.id
            return (
              <button
                key={app.id}
                className={`w-full text-left px-4 py-3 transition-colors ${
                  active ? 'bg-[#1e3a6e]/5 border-l-2 border-l-[#1e3a6e]' : 'hover:bg-gray-50 border-l-2 border-l-transparent'
                }`}
                onClick={() => setSelectedId(active ? null : app.id)}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-sm font-medium text-gray-900 leading-snug line-clamp-2 flex-1">{app.title}</p>
                  <ChevronRight className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${active ? 'text-[#1e3a6e]' : 'text-gray-300'}`} />
                </div>
                <p className="text-xs text-gray-500 mb-1.5">{app.applicantName} · {app.affiliation}</p>
                <div className="flex items-center justify-between">
                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium border ${s.cls}`}>
                    {app.matchStatus === 'processing'
                      ? <Loader2 className="w-2.5 h-2.5 animate-spin" />
                      : <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />}
                    {s.label}
                  </span>
                  <span className="text-[11px] text-gray-400">{app.submitted}</span>
                </div>
              </button>
            )
          })}
        </div>

        {/* Footer stats */}
        <div className="px-4 py-2.5 border-t border-gray-200 bg-gray-50 flex-shrink-0 flex items-center gap-4 text-[11px] text-gray-400">
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />{counts.unmatched} unmatched</span>
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />{counts.inProgress} in progress</span>
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-600 inline-block" />{counts.matched} matched</span>
        </div>
      </div>

      {/* ── Detail panel ── */}
      {selectedApp && (
        <div className="flex-1 overflow-y-auto bg-[#f8fafc]">
          {/* Header */}
          <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-3.5 flex items-start justify-between">
            <div className="flex-1 pr-4 min-w-0">
              <p className="text-[11px] font-medium text-[#1e3a6e] uppercase tracking-wide mb-0.5">{selectedApp.program}</p>
              <h2 className="text-sm font-semibold text-gray-900 leading-snug">{selectedApp.title}</h2>
            </div>
            <button onClick={() => setSelectedId(null)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 transition-colors flex-shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-6 py-5 space-y-4">
            {/* Status + date */}
            <div className="flex items-center gap-3">
              <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium border ${STATUS[selectedApp.matchStatus].cls}`}>
                {selectedApp.matchStatus === 'processing'
                  ? <Loader2 className="w-3 h-3 animate-spin" />
                  : <span className={`w-1.5 h-1.5 rounded-full ${STATUS[selectedApp.matchStatus].dot}`} />}
                {STATUS[selectedApp.matchStatus].label}
              </span>
              <span className="text-xs text-gray-400">Submitted {selectedApp.submitted}</span>
            </div>

            {/* Researcher info */}
            <div className="bg-white rounded border border-gray-200">
              <div className="px-4 py-2.5 border-b border-gray-100">
                <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Researcher</h3>
              </div>
              <div className="px-4 py-3 grid grid-cols-2 gap-3">
                {[
                  { icon: User, label: 'Investigator', value: selectedApp.applicantName },
                  { icon: Building2, label: 'Affiliation', value: selectedApp.affiliation },
                  { icon: Mail, label: 'Email', value: selectedApp.email, href: `mailto:${selectedApp.email}` },
                ].map(({ icon: Icon, label, value, href }) => (
                  <div key={label} className="flex items-start gap-2.5">
                    <Icon className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[11px] text-gray-400">{label}</p>
                      {href
                        ? <a href={href} className="text-xs font-medium text-[#1e3a6e] hover:underline truncate block">{value}</a>
                        : <p className="text-xs font-medium text-gray-900 truncate">{value}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Abstract text */}
            <div className="bg-white rounded border border-gray-200">
              <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-2">
                <BookOpen className="w-3.5 h-3.5 text-gray-400" />
                <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Abstract</h3>
              </div>
              <div className="px-4 py-3">
                {selectedApp.abstract ? (
                  <div className="space-y-2">
                    {selectedApp.abstract.split('\n\n').map((para, i) => (
                      <p key={i} className="text-xs text-gray-700 leading-relaxed">{para}</p>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic">Abstract text unavailable — PDF extraction may have failed.</p>
                )}
              </div>
            </div>

            {/* Find Reviewers */}
            <div className="bg-white rounded border-2 border-[#1e3a6e]/20">
              <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-2">
                <Search className="w-3.5 h-3.5 text-[#1e3a6e]" />
                <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Find Reviewers</h3>
              </div>

              <div className="px-4 py-4">
                {errors.submit && (
                  <div className="mb-3 flex items-center gap-1.5 text-xs text-red-600 bg-red-50 border border-red-100 rounded px-3 py-2">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /> {errors.submit}
                  </div>
                )}

                {showResult ? (
                  <>
                    {selectedApp.matchStatus === 'processing' && (
                      <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-100 rounded">
                        <Loader2 className="w-5 h-5 text-blue-500 animate-spin flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-blue-800">Matching in progress</p>
                          <p className="text-xs text-blue-600 mt-0.5">AI is identifying reviewers — track progress in Match History.</p>
                        </div>
                      </div>
                    )}
                    {(selectedApp.matchStatus === 'in-progress' || selectedApp.matchStatus === 'matched') && (
                      <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-100 rounded">
                        <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-green-800">Reviewers identified</p>
                          <p className="text-xs text-green-700 mt-0.5">Check the Match History tab for full results.</p>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="space-y-4">
                    {/* Institution selector */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">
                        Institutions <span className="text-red-500">*</span>
                      </label>
                      <div ref={dropdownRef} className="relative">
                        <button
                          type="button"
                          onClick={() => setDropdownOpen((o) => !o)}
                          className="w-full flex items-center justify-between px-3 py-2 text-sm border border-gray-200 rounded bg-white hover:border-gray-300 focus:outline-none focus:ring-1 focus:ring-[#1e3a6e] transition-colors"
                        >
                          <span className={selInstitutions.length === 0 ? 'text-gray-400 text-xs' : 'text-xs text-gray-700'}>
                            {selInstitutions.length === 0 ? 'Select WWAMI institutions…' : `${selInstitutions.length} selected`}
                          </span>
                          <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {dropdownOpen && (
                          <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded shadow-lg max-h-64 overflow-y-auto">
                            {institutions.map((group) => (
                              <div key={group.state}>
                                <div className="px-3 py-1.5 bg-gray-50 sticky top-0 border-b border-gray-100">
                                  <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{group.state}</span>
                                </div>
                                {group.universities.map((uni) => {
                                  const checked = selInstitutions.includes(uni)
                                  return (
                                    <button
                                      key={uni}
                                      type="button"
                                      onClick={() => toggleInstitution(uni)}
                                      className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 text-left"
                                    >
                                      <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 ${checked ? 'bg-[#1e3a6e] border-[#1e3a6e]' : 'border-gray-300'}`}>
                                        {checked && <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 10 10"><path d="M1.5 5L4 7.5 8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                                      </div>
                                      <span className="text-xs text-gray-700">{uni}</span>
                                    </button>
                                  )
                                })}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {selInstitutions.length > 0 && (
                        <div className="mt-2 space-y-1.5">
                          {selInstitutions.map((uni) => (
                            <div key={uni} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded px-3 py-1.5">
                              <span className="text-xs text-gray-700 flex-1 truncate">{uni}</span>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <span className="text-[11px] text-gray-500">Reviewers:</span>
                                <button type="button" onClick={() => setReviewerCounts((c) => ({ ...c, [uni]: Math.max((c[uni] ?? 3) - 1, 1) }))} className="w-5 h-5 flex items-center justify-center rounded border border-gray-200 bg-white hover:bg-gray-100 text-gray-500">
                                  <Minus className="w-2.5 h-2.5" />
                                </button>
                                <span className="w-5 text-center text-xs font-medium text-gray-900">{reviewerCounts[uni] ?? 3}</span>
                                <button type="button" onClick={() => setReviewerCounts((c) => ({ ...c, [uni]: Math.min((c[uni] ?? 3) + 1, 20) }))} className="w-5 h-5 flex items-center justify-center rounded border border-gray-200 bg-white hover:bg-gray-100 text-gray-500">
                                  <Plus className="w-2.5 h-2.5" />
                                </button>
                              </div>
                              <button type="button" onClick={() => setSelInstitutions((p) => p.filter((u) => u !== uni))} className="text-gray-300 hover:text-gray-500 flex-shrink-0">
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      {errors.institutions && <p className="text-[11px] text-red-600 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.institutions}</p>}
                    </div>

                    {/* Year range */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">
                        Publication Year Range <span className="text-red-500">*</span>
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={fromYear}
                          onChange={(e) => setFromYear(Number(e.target.value))}
                          className={`w-24 text-xs border rounded px-2.5 py-1.5 bg-white outline-none focus:ring-1 focus:ring-[#1e3a6e] ${errors.years ? 'border-red-400' : 'border-gray-200'}`}
                        />
                        <span className="text-xs text-gray-400">to</span>
                        <input
                          type="number"
                          value={toYear}
                          onChange={(e) => setToYear(Number(e.target.value))}
                          className={`w-24 text-xs border rounded px-2.5 py-1.5 bg-white outline-none focus:ring-1 focus:ring-[#1e3a6e] ${errors.years ? 'border-red-400' : 'border-gray-200'}`}
                        />
                      </div>
                      {errors.years && <p className="text-[11px] text-red-600 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.years}</p>}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={handleFind}
                        disabled={submitting}
                        className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded bg-[#1e3a6e] text-white text-sm font-medium hover:bg-[#152d56] disabled:opacity-50 transition-colors"
                      >
                        {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        Find Reviewers
                      </button>
                      <button
                        type="button"
                        onClick={() => { setSelInstitutions([]); setReviewerCounts({}); setFromYear(2021); setToYear(2026); setErrors({}) }}
                        className="px-3 py-2 rounded border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="h-2" />
          </div>
        </div>
      )}
    </div>
  )
}
