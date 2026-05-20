import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { usePeerLink } from '../context/PeerLinkContext'

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

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
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
      </div>
    </div>
  )
}
