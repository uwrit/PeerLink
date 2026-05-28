import { useState, useEffect, useRef } from 'react'
import {
  Search, ChevronRight, Building2, User, Mail, BookOpen,
  Plus, Minus, X, FileText, ChevronDown, CheckCircle,
  AlertCircle, Loader2, Layers,
} from 'lucide-react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { usePeerLink, type MatchStatus, type MatchPayload, PROGRAMS, INSTITUTIONS } from '../context/PeerLinkContext'
import { BatchProcessModal } from '../components/BatchProcessModal'

const statusConfig: Record<MatchStatus, { label: string; color: string; dot: string }> = {
  unmatched: { label: 'Unmatched', color: 'text-red-600 bg-red-50 border-red-200', dot: 'bg-red-400' },
  processing: { label: 'Processing', color: 'text-blue-600 bg-blue-50 border-blue-200', dot: 'bg-blue-400' },
  'in-progress': { label: 'In Progress', color: 'text-amber-600 bg-amber-50 border-amber-200', dot: 'bg-amber-400' },
  matched: { label: 'Matched', color: 'text-[#849B6F] bg-[#E8F0DD] border-[#849B6F]/30', dot: 'bg-[#849B6F]' },
}

export function AbstractsPage() {
  const { abstracts, submitForReview, updateAbstract } = usePeerLink()

  const [selectedAppId, setSelectedAppId] = useState<number | null>(null)
  const selectedApp = abstracts.find((a) => a.id === selectedAppId) ?? null

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedProgram, setSelectedProgram] = useState('All Programs')
  const [matchStatusFilter, setMatchStatusFilter] = useState<string>('all')
  const [selectedYear, setSelectedYear] = useState('All Years')
  const [yearDefaultSet, setYearDefaultSet] = useState(false)

  // Batch selection
  const [batchSelected, setBatchSelected] = useState<Set<number>>(new Set())
  const [batchModalOpen, setBatchModalOpen] = useState(false)

  const toggleBatchSelect = (id: number) => {
    setBatchSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allFilteredSelected = (filtered: typeof abstracts) =>
    filtered.length > 0 && filtered.every((a) => batchSelected.has(a.id))

  const toggleSelectAll = (filtered: typeof abstracts) => {
    setBatchSelected((prev) => {
      const next = new Set(prev)
      if (allFilteredSelected(filtered)) {
        filtered.forEach((a) => next.delete(a.id))
      } else {
        filtered.forEach((a) => next.add(a.id))
      }
      return next
    })
  }

  // Detail panel form state
  const [selectedInstitutions, setSelectedInstitutions] = useState<string[]>([])
  const [reviewerCounts, setReviewerCounts] = useState<Record<string, number>>({})
  const [institutionDropdownOpen, setInstitutionDropdownOpen] = useState(false)
  const [fromYear, setFromYear] = useState(2021)
  const [endYear, setEndYear] = useState(2026)
  const [formSubmitted, setFormSubmitted] = useState(false)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Reset form when switching abstracts
  useEffect(() => {
    setSelectedInstitutions([])
    setReviewerCounts({})
    setFromYear(2021)
    setEndYear(2026)
    setFormSubmitted(false)
    setFormErrors({})
    setInstitutionDropdownOpen(false)
  }, [selectedAppId])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setInstitutionDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const programOptions = ['All Programs', ...PROGRAMS]

  const yearOptions = ['All Years', ...Array.from(new Set(
    abstracts.map((a) => a.submitted ? new Date(a.submitted).getFullYear().toString() : null).filter(Boolean) as string[]
  )).sort((a, b) => Number(b) - Number(a))]

  useEffect(() => {
    if (!yearDefaultSet && yearOptions.length > 1) {
      setSelectedYear(yearOptions[1])
      setYearDefaultSet(true)
    }
  }, [yearOptions, yearDefaultSet])

  const filtered = abstracts.filter((a) => {
    const matchesProgram = selectedProgram === 'All Programs' || a.program === selectedProgram
    const matchesSearch =
      a.applicantName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.affiliation.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = matchStatusFilter === 'all' || a.matchStatus === matchStatusFilter
    const matchesYear = selectedYear === 'All Years' ||
      (a.submitted ? new Date(a.submitted).getFullYear().toString() === selectedYear : false)
    return matchesProgram && matchesSearch && matchesStatus && matchesYear
  })

  const toggleInstitution = (uni: string) => {
    setSelectedInstitutions((prev) => {
      if (prev.includes(uni)) return prev.filter((u) => u !== uni)
      setReviewerCounts((c) => ({ ...c, [uni]: c[uni] ?? 3 }))
      return [...prev, uni]
    })
  }

  const removeInstitution = (uni: string) => {
    setSelectedInstitutions((prev) => prev.filter((u) => u !== uni))
  }

  const validateForm = () => {
    const errors: Record<string, string> = {}
    if (selectedInstitutions.length === 0) errors.institutions = 'Please select at least one institution.'
    if (fromYear > endYear) errors.years = 'Start year cannot be after end year.'
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleFindReviewers = async () => {
    if (!validateForm() || !selectedApp) return
    setSubmitting(true)
    try {
      const payload: MatchPayload = {
        institutions: selectedInstitutions.map((name) => ({ name, count: reviewerCounts[name] ?? 3 })),
        year_from: fromYear,
        year_to: endYear,
      }
      await submitForReview(selectedApp.id, payload)
      setFormSubmitted(true)
    } catch (e) {
      setFormErrors({ submit: (e as Error).message })
    } finally {
      setSubmitting(false)
    }
  }

  const abstractIsActive =
    selectedApp?.matchStatus === 'processing' || selectedApp?.matchStatus === 'in-progress'
  const showSubmittedUI = formSubmitted || abstractIsActive

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left List Panel */}
      <div
        className="flex flex-col border-r border-gray-200 bg-white flex-shrink-0"
        style={{ width: selectedApp ? '360px' : '100%', minWidth: '300px' }}
      >
        {/* Panel Header */}
        <div className="px-5 pt-5 pb-4 border-b border-gray-200 flex-shrink-0 bg-white">
          <div className="flex items-center justify-between mb-3">
            <h1
              className="text-[#203E84]"
              style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '1.5rem', fontWeight: 700 }}
            >
              Abstracts
            </h1>
            {batchSelected.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">{batchSelected.size} selected</span>
                <Button
                  onClick={() => setBatchModalOpen(true)}
                  className="h-8 px-3 text-xs bg-[#203E84] hover:bg-[#162d61] text-white flex items-center gap-1.5"
                >
                  <Layers className="w-3.5 h-3.5" />
                  Run Batch
                </Button>
                <button
                  onClick={() => setBatchSelected(new Set())}
                  className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, title, or institution..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-[#E8F0DD]/50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#849B6F]/40 focus:border-[#849B6F]"
            />
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <select
                value={selectedProgram}
                onChange={(e) => setSelectedProgram(e.target.value)}
                className="w-full appearance-none text-xs bg-white border border-gray-200 rounded-lg pl-3 pr-7 py-2 text-gray-700 outline-none focus:ring-2 focus:ring-[#849B6F]/40 focus:border-[#849B6F] cursor-pointer transition-colors hover:border-[#849B6F]/60 truncate"
              >
                {programOptions.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            </div>

            <div className="relative flex-shrink-0">
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="appearance-none text-xs bg-white border border-gray-200 rounded-lg pl-3 pr-7 py-2 text-gray-700 outline-none focus:ring-2 focus:ring-[#849B6F]/40 focus:border-[#849B6F] cursor-pointer"
              >
                {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            </div>

            <div className="relative flex-shrink-0">
              <select
                value={matchStatusFilter}
                onChange={(e) => setMatchStatusFilter(e.target.value)}
                className="appearance-none text-xs bg-white border border-gray-200 rounded-lg pl-3 pr-7 py-2 text-gray-700 outline-none focus:ring-2 focus:ring-[#849B6F]/40 focus:border-[#849B6F] cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="unmatched">Unmatched</option>
                <option value="processing">Processing</option>
                <option value="in-progress">In Progress</option>
                <option value="matched">Matched</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            </div>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <FileText className="w-10 h-10 mb-2 opacity-30" />
              <p className="text-sm">No abstracts found</p>
            </div>
          ) : (
            <>
              {/* Select-all row */}
              <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100 bg-gray-50">
                <button
                  type="button"
                  onClick={() => toggleSelectAll(filtered)}
                  className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                    allFilteredSelected(filtered)
                      ? 'bg-[#849B6F] border-[#849B6F]'
                      : batchSelected.size > 0 && filtered.some((a) => batchSelected.has(a.id))
                        ? 'bg-[#849B6F]/40 border-[#849B6F]'
                        : 'border-gray-300 bg-white'
                  }`}
                >
                  {allFilteredSelected(filtered) && (
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 10">
                      <path d="M1.5 5L4 7.5 8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
                <span className="text-xs text-gray-400">Select all</span>
              </div>

              {filtered.map((app) => {
                const status = statusConfig[app.matchStatus]
                const isSelected = selectedApp?.id === app.id
                const isProcessingStatus = app.matchStatus === 'processing'
                const isBatchChecked = batchSelected.has(app.id)
                return (
                  <div
                    key={app.id}
                    className={`border-b border-gray-100 transition-colors ${
                      isSelected
                        ? 'bg-[#E8F0DD]/70 border-l-4 border-l-[#849B6F]'
                        : isBatchChecked
                          ? 'bg-[#E8F0DD]/30 border-l-4 border-l-[#849B6F]/40'
                          : 'hover:bg-gray-50 border-l-4 border-l-transparent'
                    }`}
                  >
                    <div className="flex items-start gap-3 px-4 py-4">
                      {/* Batch checkbox */}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); toggleBatchSelect(app.id) }}
                        className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${
                          isBatchChecked ? 'bg-[#849B6F] border-[#849B6F]' : 'border-gray-300 bg-white hover:border-[#849B6F]/60'
                        }`}
                      >
                        {isBatchChecked && (
                          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 10">
                            <path d="M1.5 5L4 7.5 8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </button>

                      {/* Row content */}
                      <button
                        className="flex-1 text-left min-w-0"
                        onClick={() => setSelectedAppId(isSelected ? null : app.id)}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <p className="text-sm font-medium text-gray-900 leading-snug line-clamp-2 flex-1">
                            {app.title}
                          </p>
                          <ChevronRight className={`w-4 h-4 flex-shrink-0 mt-0.5 transition-colors ${isSelected ? 'text-[#849B6F]' : 'text-gray-300'}`} />
                        </div>
                        <p className="text-xs text-gray-500 mb-2">
                          {app.applicantName} · {app.affiliation}
                        </p>
                        <div className="flex items-center justify-between gap-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border font-medium ${status.color}`}>
                            {isProcessingStatus ? (
                              <Loader2 className="w-2.5 h-2.5 animate-spin flex-shrink-0" />
                            ) : (
                              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${status.dot}`} />
                            )}
                            {status.label}
                          </span>
                          <span className="text-xs text-gray-400 flex-shrink-0">{app.submitted}</span>
                        </div>
                      </button>
                    </div>
                  </div>
                )
              })}
            </>
          )}
        </div>

      </div>

      {/* Right Detail Panel */}
      {batchModalOpen && (
        <BatchProcessModal
          selectedIds={Array.from(batchSelected)}
          onClose={() => setBatchModalOpen(false)}
          onSuccess={() => setBatchSelected(new Set())}
        />
      )}

      {selectedApp && (
        <div className="flex-1 overflow-y-auto" style={{ backgroundColor: '#F3F7ED' }}>
          {/* Sticky Header */}
          <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-8 py-4 flex items-start justify-between shadow-sm">
            <div className="flex-1 pr-4">
              <p className="text-xs text-[#849B6F] font-medium uppercase tracking-wide mb-1">
                {selectedApp.program}
              </p>
              <h2
                className="text-gray-900 leading-snug"
                style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '1.3rem', fontWeight: 700 }}
              >
                {selectedApp.title}
              </h2>
            </div>
            <button
              onClick={() => setSelectedAppId(null)}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="px-8 py-6 space-y-5">
            {/* Status row */}
            <div className="flex items-center gap-3">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm border font-medium ${statusConfig[selectedApp.matchStatus].color}`}>
                {selectedApp.matchStatus === 'processing' ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <span className={`w-2 h-2 rounded-full ${statusConfig[selectedApp.matchStatus].dot}`} />
                )}
                {statusConfig[selectedApp.matchStatus].label}
              </span>
              <span className="text-sm text-gray-400">Submitted {selectedApp.submitted}</span>
            </div>

            {/* Researcher Info */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-gray-900 mb-4" style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '1.1rem', fontWeight: 600 }}>
                Researcher Information
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { icon: User, label: 'Principal Investigator', value: selectedApp.applicantName },
                  { icon: Building2, label: 'University Affiliation', value: selectedApp.affiliation, sub: selectedApp.program },
                  { icon: Mail, label: 'Email', value: selectedApp.email, href: `mailto:${selectedApp.email}` },
                ].map(({ icon: Icon, label, value, sub, href }) => (
                  <div key={label} className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#E8F0DD] flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Icon className="w-4 h-4 text-[#849B6F]" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
                      {href ? (
                        <a href={href} className="text-sm font-medium text-[#203E84] hover:underline">{value}</a>
                      ) : (
                        <p className="text-sm font-medium text-gray-900">{value}</p>
                      )}
                      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Abstract Text */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <BookOpen className="w-4 h-4 text-[#849B6F]" />
                <h3 className="text-gray-900" style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '1.1rem', fontWeight: 600 }}>
                  Abstract
                </h3>
              </div>
              {selectedApp.abstract ? (
                <div className="space-y-3">
                  {selectedApp.abstract.split('\n\n').map((para, i) => (
                    <p key={i} className="text-sm text-gray-700 leading-relaxed">{para}</p>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic">Abstract text not available — PDF may not have been extracted.</p>
              )}
            </div>

            {/* Find Reviewers */}
            <div className="bg-white rounded-xl border-2 border-[#849B6F]/40 p-6">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-6 h-6 rounded-full bg-[#203E84] flex items-center justify-center">
                  <Search className="w-3 h-3 text-white" />
                </div>
                <h3 className="text-gray-900" style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '1.15rem', fontWeight: 700 }}>
                  Find Reviewers for This Application
                </h3>
              </div>
              <p className="text-sm text-gray-500 mb-5">
                Complete the required fields below to start matching expert peer reviewers to this submission.
              </p>

              {formErrors.submit && (
                <p className="text-xs text-red-500 mb-3 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {formErrors.submit}
                </p>
              )}

              {showSubmittedUI ? (
                <>
                  {selectedApp.matchStatus === 'processing' && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 text-center">
                      <div className="w-12 h-12 bg-blue-100 rounded-full mx-auto flex items-center justify-center mb-3">
                        <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                      </div>
                      <p className="font-semibold text-blue-700 mb-1">AI Processing Underway</p>
                      <p className="text-sm text-blue-600">
                        The AI is searching for the best reviewer matches. Track progress in Match History.
                      </p>
                    </div>
                  )}
                  {(selectedApp.matchStatus === 'in-progress' || selectedApp.matchStatus === 'matched') && (
                    <div className="bg-[#E8F0DD] border border-[#849B6F] rounded-xl p-6 text-center">
                      <div className="w-12 h-12 bg-[#849B6F] rounded-full mx-auto flex items-center justify-center mb-3">
                        <CheckCircle className="w-6 h-6 text-white" />
                      </div>
                      <p className="font-semibold text-[#203E84] mb-1">Reviewer Matching In Progress</p>
                      <p className="text-sm text-gray-600">
                        Reviewers have been identified. Track status in the Match History tab.
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-5">
                  {/* Institution Multi-Select */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Find Reviewers From <span className="text-red-500">*</span>
                    </label>
                    <div ref={dropdownRef} className="relative">
                      <button
                        type="button"
                        onClick={() => setInstitutionDropdownOpen((o) => !o)}
                        className="w-full flex items-center justify-between px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg outline-none hover:bg-[#E8F0DD]/40 focus:ring-2 focus:ring-[#849B6F]/40 transition-colors"
                      >
                        <span className={selectedInstitutions.length === 0 ? 'text-gray-400' : 'text-gray-700'}>
                          {selectedInstitutions.length === 0
                            ? 'Select WWAMI institutions…'
                            : `${selectedInstitutions.length} institution${selectedInstitutions.length > 1 ? 's' : ''} selected`}
                        </span>
                        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${institutionDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>

                      {institutionDropdownOpen && (
                        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-72 overflow-y-auto">
                          {INSTITUTIONS.map((group) => (
                            <div key={group.state}>
                              <div className="px-4 py-2 bg-[#E8F0DD]/60 sticky top-0">
                                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{group.state}</span>
                              </div>
                              {group.universities.map((uni) => {
                                const checked = selectedInstitutions.includes(uni)
                                return (
                                  <button
                                    key={uni}
                                    type="button"
                                    onClick={() => toggleInstitution(uni)}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#E8F0DD]/30 text-left transition-colors"
                                  >
                                    <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${checked ? 'bg-[#849B6F] border-[#849B6F]' : 'border-gray-300 bg-white'}`}>
                                      {checked && (
                                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 10">
                                          <path d="M1.5 5L4 7.5 8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                      )}
                                    </div>
                                    <span className="text-sm text-gray-700">{uni}</span>
                                  </button>
                                )
                              })}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {selectedInstitutions.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {selectedInstitutions.map((uni) => (
                          <div key={uni} className="flex items-center gap-3 px-3 py-2">
                            <span className="text-sm text-gray-800 flex-1 leading-snug">{uni}</span>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <span className="text-xs text-gray-500 whitespace-nowrap">Reviewers:</span>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => setReviewerCounts((c) => ({ ...c, [uni]: Math.max((c[uni] ?? 3) - 1, 1) }))}
                                  className="w-6 h-6 flex items-center justify-center rounded border border-gray-200 bg-white hover:bg-gray-100 transition-colors text-gray-600"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <span className="w-7 text-center text-sm font-medium text-gray-900">{reviewerCounts[uni] ?? 3}</span>
                                <button
                                  type="button"
                                  onClick={() => setReviewerCounts((c) => ({ ...c, [uni]: Math.min((c[uni] ?? 3) + 1, 20) }))}
                                  className="w-6 h-6 flex items-center justify-center rounded border border-gray-200 bg-white hover:bg-gray-100 transition-colors text-gray-600"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                            <button type="button" onClick={() => removeInstitution(uni)} className="text-gray-300 hover:text-gray-500 transition-colors flex-shrink-0">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    {formErrors.institutions && (
                      <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> {formErrors.institutions}
                      </p>
                    )}
                  </div>

                  {/* Year Range */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Year Range <span className="text-red-500">*</span>
                    </label>
                    <p className="text-xs text-gray-400 mb-2">Specify the range of years for the reviewers' experience.</p>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={fromYear}
                        onChange={(e) => setFromYear(Number(e.target.value))}
                        placeholder="Start Year"
                        className={`bg-gray-50 ${formErrors.years ? 'border-red-400' : 'border-gray-200'}`}
                      />
                      <span className="text-gray-500">to</span>
                      <Input
                        type="number"
                        value={endYear}
                        onChange={(e) => setEndYear(Number(e.target.value))}
                        placeholder="End Year"
                        className={`bg-gray-50 ${formErrors.years ? 'border-red-400' : 'border-gray-200'}`}
                      />
                    </div>
                    {formErrors.years && (
                      <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> {formErrors.years}
                      </p>
                    )}
                  </div>

                  {/* Submit */}
                  <div className="pt-1 flex gap-3">
                    <Button
                      onClick={handleFindReviewers}
                      disabled={submitting}
                      className="flex-1 bg-[#849B6F] hover:bg-[#6e8360] text-white"
                    >
                      {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      Find Reviewers
                    </Button>
                    <Button
                      variant="outline"
                      className="border-gray-200 text-gray-600 hover:bg-gray-50"
                      onClick={() => {
                        setSelectedInstitutions([])
                        setReviewerCounts({})
                        setFromYear(2021)
                        setEndYear(2026)
                        setFormErrors({})
                      }}
                    >
                      Clear
                    </Button>
                  </div>
                </div>
              )}
            </div>
            <div className="h-4" />
          </div>
        </div>
      )}
    </div>
  )
}
