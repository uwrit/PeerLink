import { useEffect, useRef, useState } from 'react'
import {
  Sparkles, Search, Loader2, User, Building2, ExternalLink,
  AlertCircle, Trash2, ChevronDown, Plus, Minus, X,
} from 'lucide-react'
import { Button } from '../components/ui/button'
import { api, ReviewerResult } from '../../api/client'
import { INSTITUTIONS } from '../context/PeerLinkContext'

const STORAGE_KEY = 'peerlink.quickmatch.lastRun'

interface SavedRun {
  abstractText: string
  selectedInstitutions: string[]
  reviewerCounts: Record<string, number>
  yearFrom: number
  yearTo: number
  reviewers: ReviewerResult[]
  ranAt: string
}

const currentYear = new Date().getFullYear()

export function QuickMatchPage() {
  const [abstractText, setAbstractText] = useState('')
  const [selectedInstitutions, setSelectedInstitutions] = useState<string[]>([])
  const [reviewerCounts, setReviewerCounts] = useState<Record<string, number>>({})
  const [institutionDropdownOpen, setInstitutionDropdownOpen] = useState(false)
  const [yearFrom, setYearFrom] = useState(2020)
  const [yearTo, setYearTo] = useState(currentYear)

  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reviewers, setReviewers] = useState<ReviewerResult[]>([])
  const [lastRunAt, setLastRunAt] = useState<string | null>(null)

  const dropdownRef = useRef<HTMLDivElement>(null)

  // Restore last run from localStorage
  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    try {
      const saved: SavedRun = JSON.parse(raw)
      setAbstractText(saved.abstractText)
      setSelectedInstitutions(saved.selectedInstitutions)
      setReviewerCounts(saved.reviewerCounts)
      setYearFrom(saved.yearFrom)
      setYearTo(saved.yearTo)
      setReviewers(saved.reviewers)
      setLastRunAt(saved.ranAt)
    } catch {
      // ignore corrupt storage
    }
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setInstitutionDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!abstractText.trim()) return setError('Please enter an abstract.')
    if (selectedInstitutions.length === 0) return setError('Please select at least one institution.')
    if (yearFrom > yearTo) return setError('Start year cannot be after end year.')

    setRunning(true)
    setReviewers([])
    try {
      const institutionsPayload = selectedInstitutions.map((name) => ({
        name,
        count: reviewerCounts[name] ?? 3,
      }))
      const { reviewers: results } = await api.runEphemeralMatching({
        abstract_text: abstractText.trim(),
        institutions: institutionsPayload,
        year_from: yearFrom,
        year_to: yearTo,
      })
      const valid = results.filter((r) => r.reviewer_name)
      setReviewers(valid)
      const ranAt = new Date().toISOString()
      setLastRunAt(ranAt)
      const toSave: SavedRun = {
        abstractText: abstractText.trim(),
        selectedInstitutions,
        reviewerCounts,
        yearFrom,
        yearTo,
        reviewers: valid,
        ranAt,
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Match failed. Please try again.')
    } finally {
      setRunning(false)
    }
  }

  const handleClear = () => {
    localStorage.removeItem(STORAGE_KEY)
    setAbstractText('')
    setSelectedInstitutions([])
    setReviewerCounts({})
    setYearFrom(2020)
    setYearTo(currentYear)
    setReviewers([])
    setLastRunAt(null)
    setError(null)
  }

  // Group reviewers by institution for results display
  const reviewersByInstitution = reviewers.reduce<Record<string, ReviewerResult[]>>(
    (acc, r) => {
      const key = r.institution ?? 'Unknown'
      if (!acc[key]) acc[key] = []
      acc[key].push(r)
      return acc
    },
    {},
  )

  return (
    <div className="p-8 bg-[#E8F0DD] min-h-full">
      <div className="max-w-3xl mx-auto">
        {/* Welcome banner */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#203E84] mb-4">
            <Sparkles className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-semibold text-[#203E84] mb-2">
            Welcome to PeerLink!
          </h1>
          <p className="text-gray-700">Find the perfect reviewers in minutes</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-8">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-[#203E84] mb-1">Find Expert Peer Reviewers</h2>
            <p className="text-sm text-gray-500">
              Enter the abstract details, select one or more institutions, and let us help you find the perfect reviewers.
            </p>
          </div>

          <div className="space-y-5">
            <div>
              <label htmlFor="abstractText" className="block text-sm font-medium text-gray-700 mb-1">
                Abstract <span className="text-red-500">*</span>
              </label>
              <textarea
                id="abstractText"
                rows={10}
                value={abstractText}
                onChange={(e) => setAbstractText(e.target.value)}
                placeholder="Enter your abstract..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 bg-white hover:border-[#849B6F] focus:outline-none focus:ring-2 focus:ring-[#849B6F] focus:border-transparent resize-y"
              />
            </div>

            {/* Institution Multi-Select */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Select Institutions <span className="text-red-500">*</span>
              </label>
              <div ref={dropdownRef} className="relative">
                <button
                  type="button"
                  onClick={() => setInstitutionDropdownOpen((o) => !o)}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg outline-none hover:border-[#849B6F] focus:ring-2 focus:ring-[#849B6F]/40 transition-colors"
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
                    <div key={uni} className="flex items-center gap-3 bg-[#E8F0DD]/50 border border-[#849B6F]/20 rounded-lg px-3 py-2">
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
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="yearFrom" className="block text-sm font-medium text-gray-700 mb-1">From Year</label>
                <input
                  id="yearFrom"
                  type="number"
                  min={1900}
                  max={currentYear + 5}
                  value={yearFrom}
                  onChange={(e) => setYearFrom(parseInt(e.target.value) || 0)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 bg-white hover:border-[#849B6F] focus:outline-none focus:ring-2 focus:ring-[#849B6F] focus:border-transparent"
                />
              </div>
              <div>
                <label htmlFor="yearTo" className="block text-sm font-medium text-gray-700 mb-1">End Year</label>
                <input
                  id="yearTo"
                  type="number"
                  min={1900}
                  max={currentYear + 5}
                  value={yearTo}
                  onChange={(e) => setYearTo(parseInt(e.target.value) || 0)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 bg-white hover:border-[#849B6F] focus:outline-none focus:ring-2 focus:ring-[#849B6F] focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {error && (
            <p className="mt-5 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </p>
          )}

          <div className="mt-6">
            <Button
              type="submit"
              disabled={running}
              className="w-full bg-[#203E84] hover:bg-[#203E84]/90 text-white"
            >
              {running ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Searching for reviewers…
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  Find Reviewers
                </>
              )}
            </Button>
          </div>
        </form>

        {/* Results */}
        {(reviewers.length > 0 || lastRunAt) && !running && (
          <div className="mt-8 bg-white rounded-xl shadow-sm p-8">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-xl font-semibold text-[#203E84]">
                  Reviewer Matches ({reviewers.length})
                </h2>
                {lastRunAt && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    Last run {new Date(lastRunAt).toLocaleString()}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={handleClear}
                className="text-xs text-gray-500 hover:text-red-600 flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                Clear
              </button>
            </div>

            {reviewers.length === 0 ? (
              <p className="text-sm text-gray-500 italic">
                No reviewers were found for this abstract.
              </p>
            ) : (
              <div className="space-y-6">
                {Object.entries(reviewersByInstitution).map(([inst, list]) => (
                  <div key={inst}>
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-200">
                      <Building2 className="w-4 h-4 text-[#849B6F]" />
                      <h3 className="text-sm font-semibold text-[#203E84] uppercase tracking-wide">
                        {inst}
                      </h3>
                      <span className="text-xs text-gray-400">({list.length})</span>
                    </div>
                    <div className="space-y-3">
                      {list.map((r, i) => (
                        <div key={i} className="border border-gray-200 rounded-xl p-4 hover:border-[#849B6F] transition-colors">
                          <div className="flex items-start justify-between mb-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <User className="w-4 h-4 text-[#849B6F] flex-shrink-0" />
                                <h4 className="font-semibold text-[#203E84] truncate">{r.reviewer_name}</h4>
                              </div>
                              {r.h_index !== undefined && (
                                <p className="text-xs text-gray-500 pl-6">
                                  h-index: <span className="font-semibold text-gray-700">{r.h_index}</span>
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                              {r.orcid && (
                                <a
                                  href={`https://orcid.org/${r.orcid}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-xs text-[#A6CE39] hover:underline font-medium"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  ORCID
                                </a>
                              )}
                              {r.openalex_id && (
                                <a
                                  href={`https://openalex.org/authors/${r.openalex_id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-xs text-blue-500 hover:underline font-medium"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  OpenAlex
                                </a>
                              )}
                            </div>
                          </div>
                          {r.justification && (
                            <p className="text-sm text-gray-700 leading-relaxed pl-6 mt-2">
                              {r.justification}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
