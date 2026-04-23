import { AlertCircle } from 'lucide-react'

export function AccountPage() {
  return (
    <div className="p-6 space-y-5 max-w-3xl mx-auto">

      {/* Page header */}
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Account Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Profile and system access information</p>
      </div>

      {/* Confidentiality notice */}
      <div className="bg-white rounded border border-[#4b2e83]/20 px-4 py-3">
        <div className="flex gap-3">
          <AlertCircle className="h-4 w-4 text-[#4b2e83] flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-[#4b2e83] mb-0.5">Privileged Information Access</p>
            <p className="text-xs text-gray-600 leading-relaxed">
              This platform contains privileged applicant information and research abstracts.
              Access is restricted to authorized program coordinators. Please maintain the
              confidentiality of all information accessed through this system.
            </p>
          </div>
        </div>
      </div>

      {/* Profile */}
      <div className="bg-white rounded border border-gray-200">
        <div className="px-4 py-2.5 border-b border-gray-100">
          <h2 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Profile Information</h2>
        </div>
        <div className="px-4 py-4 space-y-3">
          {[
            { label: 'Role', value: 'Program Coordinator' },
            { label: 'Institution', value: 'University of Washington ITHS' },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center gap-4">
              <span className="text-xs text-gray-500 w-24 flex-shrink-0">{label}</span>
              <span className="text-sm text-gray-800">{value}</span>
            </div>
          ))}
        </div>
        <div className="px-4 pb-3">
          <p className="text-[11px] text-gray-400">Profile management is handled by your system administrator.</p>
        </div>
      </div>

      {/* System info */}
      <div className="bg-white rounded border border-gray-200">
        <div className="px-4 py-2.5 border-b border-gray-100">
          <h2 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">System Information</h2>
        </div>
        <div className="px-4 py-4">
          <p className="text-sm text-gray-600 mb-4">
            Authentication is managed externally. Contact your system administrator to change credentials.
          </p>
          <button
            disabled
            className="px-3 py-1.5 text-sm border border-gray-200 rounded text-gray-400 cursor-not-allowed bg-gray-50"
          >
            Change Password (Managed Externally)
          </button>
        </div>
      </div>
    </div>
  )
}
