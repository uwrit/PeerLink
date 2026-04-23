import { AlertCircle } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'

export function AccountPage() {
  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold text-[#203E84] mb-2">Account Settings</h1>
          <p className="text-gray-700">Manage your profile and security settings</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5 mb-6 border-l-4 border-[#203E84]">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-[#203E84] flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-[#203E84] mb-1">Privileged Information Access</h3>
              <p className="text-sm text-gray-700">
                This platform contains privileged applicant information and research abstracts.
                Access is restricted to authorized program coordinators. Please maintain the
                confidentiality of all information accessed through this system.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold text-[#203E84] mb-6">Profile Information</h2>
          <div className="space-y-4">
            {[
              { id: 'role', label: 'Role', value: 'Program Coordinator' },
              { id: 'institution', label: 'Institution', value: 'University of Washington ITHS' },
            ].map(({ id, label, value }) => (
              <div key={id}>
                <Label htmlFor={id} className="text-[#203E84]">{label}</Label>
                <Input id={id} type="text" defaultValue={value} className="mt-1.5 bg-white" readOnly />
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-4">Profile management is handled by your system administrator.</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-semibold text-[#203E84] mb-4">System Information</h2>
          <div className="text-sm text-gray-600 space-y-2">
            <p>Authentication is managed externally. Contact your system administrator to change credentials.</p>
          </div>
          <div className="mt-4 flex justify-end">
            <Button disabled className="bg-[#849B6F]/50 text-white cursor-not-allowed">
              Change Password (Managed Externally)
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
