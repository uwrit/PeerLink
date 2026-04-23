import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Save, X } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
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

  return (
    <div className="p-8 bg-[#E8F0DD] min-h-full">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-[#203E84] mb-2">Add New Abstract Manually</h1>
          <p className="text-gray-700">
            Use this form to manually enter abstracts submitted outside the standard Gravity Forms application system.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-8">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
          )}

          <div className="space-y-6">
            {/* Applicant Information */}
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
              </div>
            </div>

            {/* Abstract Details */}
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
                    {programs.map((p) => <option key={p} value={p}>{p}</option>)}
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
                  <p className="text-xs text-gray-500 mt-1">Include the complete abstract as submitted by the applicant</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200">
            <Button type="button" variant="outline" onClick={handleReset} className="border-gray-300 text-gray-700 hover:bg-gray-50">
              <X className="h-4 w-4 mr-2" />
              Clear Form
            </Button>
            <div className="flex items-center gap-3">
              <Button type="button" variant="outline" onClick={() => navigate('/')} className="border-gray-300 text-gray-700 hover:bg-gray-50">
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="bg-[#203E84] hover:bg-[#203E84]/90 text-white">
                <Save className="h-4 w-4 mr-2" />
                {submitting ? 'Saving…' : 'Save Abstract'}
              </Button>
            </div>
          </div>
        </form>

        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">Next Steps</h3>
          <p className="text-sm text-blue-800">
            After saving this abstract, it will appear in the Abstracts list with an "Unmatched" status.
            You can then use the individual matching feature to find suitable peer reviewers.
          </p>
        </div>
      </div>
    </div>
  )
}
