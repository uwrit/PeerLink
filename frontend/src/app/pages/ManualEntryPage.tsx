import { useState } from 'react'
import { useNavigate } from 'react-router'
import { api } from '../../api/client'
import { usePeerLink } from '../context/PeerLinkContext'

export function ManualEntryPage() {
  const navigate = useNavigate()
  const { programs, reload } = usePeerLink()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    applicantName: '',
    title: '',
    abstractText: '',
    program: programs[0] ?? '',
    affiliation: '',
    email: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await api.createAbstract({
        title: formData.title,
        abstract_text: formData.abstractText,
        program: formData.program,
        applicant_name: formData.applicantName,
        applicant_email: formData.email,
        affiliation: formData.affiliation,
      })
      await reload()
      navigate('/')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleReset = () => {
    setFormData({ applicantName: '', title: '', abstractText: '', program: programs[0] ?? '', affiliation: '', email: '' })
    setError(null)
  }

  const field = (id: string, label: string, required = true) => (
    <div key={id}>
      <label htmlFor={id} className="block text-xs font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
    </div>
  )

  return (
    <div className="p-6 space-y-5 max-w-3xl mx-auto">

      {/* Page header */}
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Add Abstract Manually</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Enter abstracts submitted outside the standard Gravity Forms application system.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="px-3 py-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">{error}</div>
        )}

        {/* Applicant Information */}
        <div className="bg-white rounded border border-gray-200">
          <div className="px-4 py-2.5 border-b border-gray-100">
            <h2 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Applicant Information</h2>
          </div>
          <div className="px-4 py-4 space-y-3">
            <div>
              <label htmlFor="applicantName" className="block text-xs font-medium text-gray-700 mb-1">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                id="applicantName"
                type="text"
                required
                value={formData.applicantName}
                onChange={(e) => setFormData({ ...formData, applicantName: e.target.value })}
                placeholder="e.g., Jane Smith"
                className="w-full text-sm border border-gray-200 rounded px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-[#1e3a6e] focus:border-[#1e3a6e]"
              />
            </div>

            <div>
              <label htmlFor="affiliation" className="block text-xs font-medium text-gray-700 mb-1">
                Affiliation <span className="text-red-500">*</span>
              </label>
              <input
                id="affiliation"
                type="text"
                required
                value={formData.affiliation}
                onChange={(e) => setFormData({ ...formData, affiliation: e.target.value })}
                placeholder="e.g., University of Washington"
                className="w-full text-sm border border-gray-200 rounded px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-[#1e3a6e] focus:border-[#1e3a6e]"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-xs font-medium text-gray-700 mb-1">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                id="email"
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="applicant@example.com"
                className="w-full text-sm border border-gray-200 rounded px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-[#1e3a6e] focus:border-[#1e3a6e]"
              />
            </div>
          </div>
        </div>

        {/* Abstract Details */}
        <div className="bg-white rounded border border-gray-200">
          <div className="px-4 py-2.5 border-b border-gray-100">
            <h2 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Abstract Details</h2>
          </div>
          <div className="px-4 py-4 space-y-3">
            <div>
              <label htmlFor="program" className="block text-xs font-medium text-gray-700 mb-1">
                Program <span className="text-red-500">*</span>
              </label>
              <select
                id="program"
                required
                value={formData.program}
                onChange={(e) => setFormData({ ...formData, program: e.target.value })}
                className="w-full text-sm border border-gray-200 rounded px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-[#1e3a6e] focus:border-[#1e3a6e]"
              >
                {programs.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <div>
              <label htmlFor="title" className="block text-xs font-medium text-gray-700 mb-1">
                Abstract Title <span className="text-red-500">*</span>
              </label>
              <input
                id="title"
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Enter the title of the research abstract"
                className="w-full text-sm border border-gray-200 rounded px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-[#1e3a6e] focus:border-[#1e3a6e]"
              />
            </div>

            <div>
              <label htmlFor="abstractText" className="block text-xs font-medium text-gray-700 mb-1">
                Abstract Text <span className="text-red-500">*</span>
              </label>
              <textarea
                id="abstractText"
                required
                rows={10}
                value={formData.abstractText}
                onChange={(e) => setFormData({ ...formData, abstractText: e.target.value })}
                placeholder="Paste or type the full abstract text here..."
                className="w-full text-sm border border-gray-200 rounded px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-[#1e3a6e] focus:border-[#1e3a6e] resize-y"
              />
              <p className="text-[11px] text-gray-400 mt-1">Include the complete abstract as submitted by the applicant.</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={handleReset}
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            Clear form
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-1.5 text-sm font-medium rounded bg-[#1e3a6e] text-white hover:bg-[#152d56] disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Saving…' : 'Save Abstract'}
            </button>
          </div>
        </div>
      </form>

      {/* Info note */}
      <div className="bg-blue-50 border border-blue-100 rounded px-4 py-3">
        <p className="text-xs font-medium text-blue-900 mb-0.5">Next Steps</p>
        <p className="text-xs text-blue-700">
          After saving, this abstract will appear in the Abstracts list with an "Unmatched" status.
          Use the matching feature from that view to find suitable peer reviewers.
        </p>
      </div>
    </div>
  )
}
