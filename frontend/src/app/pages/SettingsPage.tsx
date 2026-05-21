import { useEffect, useState } from 'react'
import { RefreshCw, Mail, RotateCcw, Check } from 'lucide-react'
import { usePeerLink } from '../context/PeerLinkContext'
import {
  PROGRAM_KEYS,
  TEMPLATE_PLACEHOLDERS,
  type ProgramKey,
  getDefaultTemplate,
  loadTemplate,
  saveTemplate,
  resetTemplate,
  hasCustomTemplate,
} from '../utils/reviewerEmail'

export function SettingsPage() {
  const { syncGravityForms } = usePeerLink()
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)
  const [syncError, setSyncError] = useState(false)

  const handleSync = async () => {
    setSyncing(true)
    setSyncMsg(null)
    setSyncError(false)
    try {
      const { synced } = await syncGravityForms()
      setSyncMsg(`Synced ${synced} abstract${synced !== 1 ? 's' : ''} from Gravity Forms`)
    } catch (e) {
      setSyncError(true)
      setSyncMsg('Sync failed — check backend logs')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold text-[#203E84] mb-2">Settings</h1>
          <p className="text-gray-700">Application data sources and integrations</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-semibold text-[#203E84] mb-2">Gravity Forms</h2>
          <p className="text-sm text-gray-600 mb-5">
            Pull the latest applications from the ITHS Gravity Forms submission form and
            extract abstract text from their PDFs. Existing entries are updated in place.
          </p>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-[#203E84] text-[#203E84] hover:bg-[#203E84] hover:text-white transition-colors text-sm font-medium disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing…' : 'Sync from Gravity Forms'}
            </button>
            {syncMsg && (
              <p className={`text-sm ${syncError ? 'text-red-600' : 'text-gray-600'}`}>
                {syncMsg}
              </p>
            )}
          </div>
        </div>

        <EmailTemplateEditor />
      </div>
    </div>
  )
}

function EmailTemplateEditor() {
  const [program, setProgram] = useState<ProgramKey>(PROGRAM_KEYS[0])
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [isCustom, setIsCustom] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [dirty, setDirty] = useState(false)

  // Load template whenever the selected program changes.
  useEffect(() => {
    const tpl = loadTemplate(program)
    setSubject(tpl.subject)
    setBody(tpl.body)
    setIsCustom(hasCustomTemplate(program))
    setDirty(false)
  }, [program])

  const handleSave = () => {
    saveTemplate(program, { subject, body })
    setIsCustom(true)
    setDirty(false)
    setSavedFlash(true)
    window.setTimeout(() => setSavedFlash(false), 2000)
  }

  const handleReset = () => {
    resetTemplate(program)
    const tpl = getDefaultTemplate(program)
    setSubject(tpl.subject)
    setBody(tpl.body)
    setIsCustom(false)
    setDirty(false)
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-start gap-3 mb-2">
        <Mail className="h-5 w-5 text-[#203E84] mt-0.5" />
        <div>
          <h2 className="text-xl font-semibold text-[#203E84]">Reviewer Invitation Email</h2>
          <p className="text-sm text-gray-600 mt-1">
            Edit the template used when sending invitation emails to reviewers. Each award
            program has its own template. Templates are saved in your browser.
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Award Program
          </label>
          <select
            value={program}
            onChange={(e) => setProgram(e.target.value as ProgramKey)}
            className="w-full text-sm border-2 border-[#849B6F] rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#849B6F] text-gray-700"
          >
            {PROGRAM_KEYS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <div className="mt-1 text-xs text-gray-500">
            {isCustom ? (
              <span className="text-[#4a6741] font-medium">Custom template active for this program.</span>
            ) : (
              <span>Currently using the built-in default for this program.</span>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
            Available placeholders
          </p>
          <div className="flex flex-wrap gap-2">
            {TEMPLATE_PLACEHOLDERS.map((p) => (
              <span
                key={p.token}
                title={p.description}
                className="inline-flex items-center gap-1 text-xs font-mono bg-white border border-gray-200 rounded px-2 py-0.5 text-[#203E84]"
              >
                {p.token}
              </span>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            These tokens are replaced with each reviewer's details when the email is generated.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => { setSubject(e.target.value); setDirty(true) }}
            className="w-full text-sm border-2 border-gray-200 focus:border-[#849B6F] rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#849B6F]/30"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Body</label>
          <textarea
            value={body}
            onChange={(e) => { setBody(e.target.value); setDirty(true) }}
            rows={18}
            className="w-full text-sm font-mono leading-relaxed border-2 border-gray-200 focus:border-[#849B6F] rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#849B6F]/30 whitespace-pre"
          />
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={handleSave}
            disabled={!dirty}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#203E84] text-white hover:bg-[#152a5c] transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Check className="h-4 w-4" />
            Save Template
          </button>
          <button
            onClick={handleReset}
            disabled={!isCustom}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            title="Restore the built-in default template for this program"
          >
            <RotateCcw className="h-4 w-4" />
            Reset to Default
          </button>
          {savedFlash && (
            <span className="text-sm text-[#4a6741] font-medium">Saved</span>
          )}
        </div>
      </div>
    </div>
  )
}
