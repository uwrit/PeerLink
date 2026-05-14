import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Search, ChevronDown, Plus, Minus, X, AlertCircle, Loader2,
  User, Building2, ExternalLink, BookOpen, Trash2,
} from 'lucide-react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { api, type ReviewerResult } from '../../api/client'
import { INSTITUTIONS } from '../context/PeerLinkContext'

const STORAGE_KEY = 'peerlink.findReviewers.lastRun'
const currentYear = new Date().getFullYear()

interface SavedRun {
  abstractText: string
  selectedInstitutions: string[]
  reviewerCounts: Record<string, number>
  fromYear: number
  endYear: number
  reviewers: ReviewerResult[]
}

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return `${min}:${sec.toString().padStart(2, '0')}`
}

interface JustificationModalState {
  reviewerName: string
  institution: string
  justification: string
  orcid?: string
  openalex_id?: string
}

export function FindReviewersPage() {
  const [abstractText, setAbstractText] = useState('')
  const [selectedInstitutions, setSelectedInstitutions] = useState<string[]>([])
  const [reviewerCounts, setReviewerCounts] = useState<Record<string, number>>({})
  const [institutionDropdownOpen, setInstitutionDropdownOpen] = useState(false)
  const [fromYear, setFromYear] = useState(2021)
  const [endYear, setEndYear] = useState(currentYear)

  const [submitting, setSubmitting] = useState(false)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [reviewers, setReviewers] = useState<ReviewerResult[]>([])
  const [elapsedMs, setElapsedMs] = useState(0)
  const [activeModal, setActiveModal] = useState<JustificationModalState | null>(null)
  const closeModal = useCallback(() => setActiveModal(null), [])

  const dropdownRef = useRef<HTMLDivElement>(null)
  const startedAtRef = useRef<number | null>(null)

  // Tick a real-time elapsed clock while the agent is running.
  useEffect(() => {
    if (!submitting) return
    const id = setInterval(() => {
      if (startedAtRef.current !== null) {
        setElapsedMs(Date.now() - startedAtRef.current)
      }
    }, 1000)
    return () => clearInterval(id)
  }, [submitting])

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    try {
      const saved: SavedRun = JSON.parse(raw)
      setAbstractText(saved.abstractText)
      setSelectedInstitutions(saved.selectedInstitutions)
      setReviewerCounts(saved.reviewerCounts)
      setFromYear(saved.fromYear)
      setEndYear(saved.endYear)
      setReviewers(saved.reviewers)
    } catch {
      // ignore corrupt storage
    }
  }, [])

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

  const validateForm = () => {
    const errors: Record<string, string> = {}
    if (!abstractText.trim()) errors.abstract = 'Please paste an abstract.'
    if (selectedInstitutions.length === 0) errors.institutions = 'Please select at least one institution.'
    if (fromYear > endYear) errors.years = 'Start year cannot be after end year.'
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleFindReviewers = async () => {
    if (!validateForm()) return
    setSubmitting(true)
    setReviewers([])
    setElapsedMs(0)
    startedAtRef.current = Date.now()
    try {
      const institutionsPayload = selectedInstitutions.map((name) => ({
        name,
        count: reviewerCounts[name] ?? 3,
      }))
      const { reviewers: results } = await api.runPublicMatching({
        abstract_text: abstractText.trim(),
        institutions: institutionsPayload,
        year_from: fromYear,
        year_to: endYear,
      })
      const valid = results.filter((r) => r.reviewer_name || r.parse_error)
      setReviewers(valid)
      const toSave: SavedRun = {
        abstractText: abstractText.trim(),
        selectedInstitutions,
        reviewerCounts,
        fromYear,
        endYear,
        reviewers: valid,
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave))
    } catch (e) {
      setFormErrors({ submit: (e as Error).message })
    } finally {
      setSubmitting(false)
      startedAtRef.current = null
    }
  }

  const handleClear = () => {
    localStorage.removeItem(STORAGE_KEY)
    setAbstractText('')
    setSelectedInstitutions([])
    setReviewerCounts({})
    setFromYear(2021)
    setEndYear(currentYear)
    setReviewers([])
    setElapsedMs(0)
    setFormErrors({})
  }

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
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1
          className="text-[#203E84]"
          style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '1.75rem', fontWeight: 700 }}
        >
          Find Reviewers
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Paste an abstract, choose one or more WWAMI institutions, and the agent will suggest expert peer reviewers.
        </p>
      </div>

      {/* Form */}
      <div className="bg-white rounded-xl border-2 border-[#849B6F]/40 p-6">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-6 h-6 rounded-full bg-[#203E84] flex items-center justify-center">
            <Search className="w-3 h-3 text-white" />
          </div>
          <h3 className="text-gray-900" style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '1.15rem', fontWeight: 700 }}>
            Find Reviewers for An Abstract
          </h3>
        </div>
        <p className="text-sm text-gray-500 mb-5">
          Complete the required fields below to start matching expert peer reviewers.
        </p>

        {formErrors.submit && (
          <p className="text-xs text-red-500 mb-3 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> {formErrors.submit}
          </p>
        )}

        <div className="space-y-5">
          {/* Abstract textarea */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Abstract <span className="text-red-500">*</span>
            </label>
            <textarea
              value={abstractText}
              onChange={(e) => setAbstractText(e.target.value)}
              rows={8}
              placeholder="Paste the abstract text here…"
              className={`w-full px-3 py-2 text-sm bg-gray-50 border rounded-lg outline-none focus:ring-2 focus:ring-[#849B6F]/40 transition-colors resize-y ${
                formErrors.abstract ? 'border-red-400' : 'border-gray-200'
              }`}
            />
            {formErrors.abstract && (
              <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {formErrors.abstract}
              </p>
            )}
          </div>

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
              onClick={handleClear}
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Clear
            </Button>
          </div>
        </div>
      </div>

      {/* Results */}
      {submitting && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 text-center">
          <div className="w-12 h-12 bg-blue-100 rounded-full mx-auto flex items-center justify-center mb-3">
            <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
          </div>
          <p className="font-semibold text-blue-700 mb-1">Running the agent…</p>
          <p className="text-3xl font-mono tabular-nums text-blue-700 my-2" aria-live="polite">
            {formatElapsed(elapsedMs)}
          </p>
          <p className="text-sm text-blue-600">
            This typically takes a few minutes. Please keep this tab open.
          </p>
        </div>
      )}

      {!submitting && reviewers.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="w-4 h-4 text-[#849B6F]" />
            <h3 className="text-gray-900" style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '1.15rem', fontWeight: 700 }}>
              Suggested Reviewers
            </h3>
          </div>

          <div className="space-y-5">
            {Object.entries(reviewersByInstitution).map(([institution, list]) => (
              <div key={institution}>
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="w-3.5 h-3.5 text-[#849B6F]" />
                  <span className="text-xs font-semibold text-[#203E84] uppercase tracking-wide">
                    {institution}
                  </span>
                  <span className="text-xs text-gray-400">({list.length})</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {list.map((r, i) => (
                    <ReviewerCard
                      key={`${institution}-${i}`}
                      reviewer={r}
                      onOpenJustification={setActiveModal}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeModal && <JustificationDialog modal={activeModal} onClose={closeModal} />}
    </div>
  )
}

function JustificationDialog({
  modal,
  onClose,
}: {
  modal: JustificationModalState
  onClose: () => void
}) {
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
                href={
                  modal.openalex_id.startsWith('http')
                    ? modal.openalex_id
                    : `https://openalex.org/authors/${modal.openalex_id}`
                }
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

        <div className="px-6 py-5 overflow-y-auto">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Relevance Justification</p>
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{modal.justification}</p>
        </div>
      </div>
    </div>
  )
}

function ReviewerCard({
  reviewer,
  onOpenJustification,
}: {
  reviewer: ReviewerResult
  onOpenJustification: (modal: JustificationModalState) => void
}) {
  if (reviewer.parse_error) {
    return (
      <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-sm text-red-700 min-w-[240px] max-w-[340px]">
        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-medium">Couldn't parse a result from the agent.</p>
          <p className="text-xs text-red-600 mt-0.5">{reviewer.parse_error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col bg-white border border-[#849B6F]/40 rounded-lg px-3 py-2.5 shadow-sm min-w-[240px] max-w-[340px]">
      {/* Name */}
      <div className="flex items-center gap-1.5 mb-1 min-w-0">
        <User className="w-3 h-3 text-[#849B6F] flex-shrink-0" />
        <span className="text-sm font-semibold text-gray-800 truncate">{reviewer.reviewer_name}</span>
      </div>

      {/* Justification preview + Read more */}
      {reviewer.justification && (
        <div className="mb-2">
          <p className="text-sm text-gray-600 leading-relaxed line-clamp-2">
            {reviewer.justification}
          </p>
          <button
            onClick={() =>
              onOpenJustification({
                reviewerName: reviewer.reviewer_name,
                institution: reviewer.institution ?? '',
                justification: reviewer.justification!,
                orcid: reviewer.orcid,
                openalex_id: reviewer.openalex_id,
              })
            }
            className="text-xs text-[#203E84] hover:underline mt-0.5 font-medium"
          >
            Read more
          </button>
        </div>
      )}

      {/* Profile links footer */}
      <div className="flex items-center gap-3 mt-auto pt-1 border-t border-gray-100">
        {reviewer.orcid && (
          <a
            href={`https://orcid.org/${reviewer.orcid}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-0.5 text-xs text-[#A6CE39] hover:text-[#7aad00] hover:underline font-medium"
          >
            <ExternalLink className="w-2.5 h-2.5" />
            ORCID
          </a>
        )}
        {reviewer.openalex_id && (
          <a
            href={
              reviewer.openalex_id.startsWith('http')
                ? reviewer.openalex_id
                : `https://openalex.org/authors/${reviewer.openalex_id}`
            }
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-0.5 text-xs text-blue-500 hover:text-blue-700 hover:underline font-medium"
          >
            <ExternalLink className="w-2.5 h-2.5" />
            OpenAlex
          </a>
        )}
      </div>
    </div>
  )
}
