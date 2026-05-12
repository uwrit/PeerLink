import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { Save, X, Loader2, CheckCircle2 } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { api } from '../../api/client'
import { PROGRAMS, usePeerLink } from '../context/PeerLinkContext'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const initialState = {
  applicantName: '',
  title: '',
  abstractText: '',
  program: PROGRAMS[0],
  affiliation: '',
  email: '',
  phone: '',
}

export function ManualEntryPage() {
  const navigate = useNavigate()
  const { reload } = usePeerLink()

  const [formData, setFormData] = useState(initialState)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const isDirty = Object.entries(formData).some(([k, v]) => v !== initialState[k as keyof typeof initialState])

  // Warn on tab close / refresh if there are unsaved changes
  useEffect(() => {
    if (!isDirty || success) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty, success])

  const confirmLeave = (msg = 'You have unsaved changes. Are you sure you want to leave?') =>
    !isDirty || success || window.confirm(msg)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Client-side email validation (browser type=email lets through some weird values)
    if (!EMAIL_RE.test(formData.email.trim())) {
      setError('Please enter a valid email address.')
      return
    }

    setSubmitting(true)
    try {
      await api.createAbstract({
        title: formData.title.trim(),
        applicant_name: formData.applicantName.trim(),
        applicant_email: formData.email.trim(),
        affiliation: formData.affiliation.trim(),
        phone: formData.phone.trim(),
        program: formData.program,
        abstract_text: formData.abstractText.trim(),
      })
      await reload()
      setSuccess(true)
      // Brief delay so the success banner is visible before redirecting
      setTimeout(() => navigate('/'), 1200)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save abstract.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleReset = () => {
    if (!confirmLeave('Clear all fields? Any unsaved input will be lost.')) return
    setFormData(initialState)
    setError(null)
  }

  const handleCancel = () => {
    if (!confirmLeave()) return
    navigate('/')
  }

  return (
    <div className="p-8 bg-[#E8F0DD] min-h-full">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-[#203E84] mb-2">
            Add New Abstract Manually
          </h1>
          <p className="text-gray-700">
            Use this form to manually enter abstracts that were submitted via email or other channels outside the standard application system.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-8">
          <div className="space-y-6">
            {/* Applicant Information Section */}
            <div>
              <h2 className="text-xl font-semibold text-[#203E84] mb-4 pb-2 border-b border-gray-200">
                Applicant Information
              </h2>
              <div className="space-y-4">
                <div>
                  <label htmlFor="applicantName" className="block text-sm font-medium text-gray-700 mb-1">
                    Applicant Name <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="applicantName"
                    type="text"
                    required
                    value={formData.applicantName}
                    onChange={(e) => setFormData({ ...formData, applicantName: e.target.value })}
                    placeholder="e.g., John Smith"
                    className="bg-white border-gray-200"
                  />
                </div>

                <div>
                  <label htmlFor="affiliation" className="block text-sm font-medium text-gray-700 mb-1">
                    Affiliation <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="affiliation"
                    type="text"
                    required
                    value={formData.affiliation}
                    onChange={(e) => setFormData({ ...formData, affiliation: e.target.value })}
                    placeholder="e.g., University of Washington"
                    className="bg-white border-gray-200"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <Input
                      id="email"
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="applicant@example.com"
                      className="bg-white border-gray-200"
                    />
                  </div>

                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                      Phone <span className="text-red-500">*</span>
                    </label>
                    <Input
                      id="phone"
                      type="tel"
                      required
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="(206) 555-0100"
                      className="bg-white border-gray-200"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Abstract Details Section */}
            <div>
              <h2 className="text-xl font-semibold text-[#203E84] mb-4 pb-2 border-b border-gray-200">
                Abstract Details
              </h2>
              <div className="space-y-4">
                <div>
                  <label htmlFor="program" className="block text-sm font-medium text-gray-700 mb-1">
                    Program <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="program"
                    required
                    value={formData.program}
                    onChange={(e) => setFormData({ ...formData, program: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 bg-white hover:border-[#849B6F] focus:outline-none focus:ring-2 focus:ring-[#849B6F] focus:border-transparent"
                  >
                    {PROGRAMS.map((program) => (
                      <option key={program} value={program}>{program}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                    Abstract Title <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="title"
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Enter the title of the research abstract"
                    className="bg-white border-gray-200"
                  />
                </div>

                <div>
                  <label htmlFor="abstractText" className="block text-sm font-medium text-gray-700 mb-1">
                    Abstract Text <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="abstractText"
                    required
                    rows={12}
                    value={formData.abstractText}
                    onChange={(e) => setFormData({ ...formData, abstractText: e.target.value })}
                    placeholder="Paste or type the full abstract text here..."
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 bg-white hover:border-[#849B6F] focus:outline-none focus:ring-2 focus:ring-[#849B6F] focus:border-transparent resize-y"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Include the complete abstract as submitted by the applicant
                  </p>
                </div>
              </div>
            </div>
          </div>

          {error && (
            <p className="mt-6 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          {success && (
            <p className="mt-6 text-sm text-[#849B6F] bg-[#E8F0DD] border border-[#849B6F]/40 rounded-lg px-3 py-2 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Abstract successfully added. Redirecting to dashboard…
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200">
            <Button
              type="button"
              variant="outline"
              onClick={handleReset}
              disabled={submitting}
              className="border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              <X className="h-4 w-4 mr-2" />
              Clear Form
            </Button>

            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={submitting}
                className="border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-[#203E84] hover:bg-[#203E84]/90 text-white"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {submitting ? 'Saving…' : 'Save Abstract'}
              </Button>
            </div>
          </div>
        </form>

        {/* Help Text */}
        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">Next Steps</h3>
          <p className="text-sm text-blue-800">
            After saving this abstract, it will appear on the Dashboard with an "Unmatched" status.
            You can then use the batch processing or individual matching features to find suitable peer reviewers.
          </p>
        </div>
      </div>
    </div>
  )
}
