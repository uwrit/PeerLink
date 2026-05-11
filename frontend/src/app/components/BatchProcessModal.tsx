import { useState, useRef, useEffect } from 'react'
import {
  X, ChevronDown, Plus, Minus, AlertCircle, Loader2, Layers,
} from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { INSTITUTIONS, MatchPayload, usePeerLink } from '../context/PeerLinkContext'

interface Props {
  selectedIds: number[]
  onClose: () => void
  onSuccess: () => void
}

export function BatchProcessModal({ selectedIds, onClose, onSuccess }: Props) {
  const { abstracts, submitBatch } = usePeerLink()
  const selectedAbstracts = abstracts.filter((a) => selectedIds.includes(a.id))

  const [selectedInstitutions, setSelectedInstitutions] = useState<string[]>([])
  const [reviewerCounts, setReviewerCounts] = useState<Record<string, number>>({})
  const [institutionDropdownOpen, setInstitutionDropdownOpen] = useState(false)
  const [fromYear, setFromYear] = useState(2021)
  const [endYear, setEndYear] = useState(2026)
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setInstitutionDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

  const toggleInstitution = (uni: string) => {
    setSelectedInstitutions((prev) => {
      if (prev.includes(uni)) return prev.filter((u) => u !== uni)
      setReviewerCounts((c) => ({ ...c, [uni]: c[uni] ?? 3 }))
      return [...prev, uni]
    })
  }

  const validate = () => {
    const errs: Record<string, string> = {}
    if (selectedInstitutions.length === 0) errs.institutions = 'Select at least one institution.'
    if (fromYear > endYear) errs.years = 'Start year cannot be after end year.'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setSubmitting(true)
    try {
      const payload: MatchPayload = {
        institutions: selectedInstitutions.map((name) => ({ name, count: reviewerCounts[name] ?? 3 })),
        year_from: fromYear,
        year_to: endYear,
      }
      await submitBatch(selectedIds, payload)
      onSuccess()
      onClose()
    } catch (e) {
      setErrors({ submit: (e as Error).message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#203E84] flex items-center justify-center flex-shrink-0">
              <Layers className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-[#203E84]" style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '1.2rem' }}>
                Batch Reviewer Matching
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {selectedIds.length} abstract{selectedIds.length !== 1 ? 's' : ''} selected
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Selected abstracts preview */}
        <div className="px-6 py-3 bg-[#E8F0DD]/40 border-b border-gray-100 max-h-28 overflow-y-auto">
          {selectedAbstracts.map((a) => (
            <p key={a.id} className="text-xs text-gray-700 py-0.5 leading-relaxed truncate">
              <span className="font-medium">{a.applicantName}</span>
              {' — '}
              <span className="text-gray-500">{a.title}</span>
            </p>
          ))}
        </div>

        {/* Form */}
        <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">
          {errors.submit && (
            <p className="text-xs text-red-500 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {errors.submit}
            </p>
          )}

          {/* Institution multi-select */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Find Reviewers From <span className="text-red-500">*</span>
            </label>
            <div ref={dropdownRef} className="relative">
              <button
                type="button"
                onClick={() => setInstitutionDropdownOpen((o) => !o)}
                className="w-full flex items-center justify-between px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg hover:bg-[#E8F0DD]/40 focus:ring-2 focus:ring-[#849B6F]/40 focus:outline-none transition-colors"
              >
                <span className={selectedInstitutions.length === 0 ? 'text-gray-400' : 'text-gray-700'}>
                  {selectedInstitutions.length === 0
                    ? 'Select WWAMI institutions…'
                    : `${selectedInstitutions.length} institution${selectedInstitutions.length > 1 ? 's' : ''} selected`}
                </span>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${institutionDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {institutionDropdownOpen && (
                <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
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
                    <button
                      type="button"
                      onClick={() => setSelectedInstitutions((prev) => prev.filter((u) => u !== uni))}
                      className="text-gray-300 hover:text-gray-500 transition-colors flex-shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {errors.institutions && (
              <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {errors.institutions}
              </p>
            )}
          </div>

          {/* Year range */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Year Range <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-gray-400 mb-2">Applied to all selected abstracts.</p>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={fromYear}
                onChange={(e) => setFromYear(Number(e.target.value))}
                placeholder="Start Year"
                className={`bg-gray-50 ${errors.years ? 'border-red-400' : 'border-gray-200'}`}
              />
              <span className="text-gray-500">to</span>
              <Input
                type="number"
                value={endYear}
                onChange={(e) => setEndYear(Number(e.target.value))}
                placeholder="End Year"
                className={`bg-gray-50 ${errors.years ? 'border-red-400' : 'border-gray-200'}`}
              />
            </div>
            {errors.years && (
              <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {errors.years}
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center gap-3">
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 bg-[#203E84] hover:bg-[#162d61] text-white"
          >
            {submitting ? (
              <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Starting…</>
            ) : (
              `Run Matching for ${selectedIds.length} Abstract${selectedIds.length !== 1 ? 's' : ''}`
            )}
          </Button>
          <Button variant="outline" onClick={onClose} className="border-gray-200 text-gray-600 hover:bg-gray-50">
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}
