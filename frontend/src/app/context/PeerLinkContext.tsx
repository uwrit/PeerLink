import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react'
import { api, Abstract as APIAbstract } from '../../api/client'

export const PROGRAMS = [
  'Early-Stage Product Development Award',
  'New Interdisciplinary Academic Collaborations',
  'Academic Community Partnerships',
]

export const INSTITUTIONS: { state: string; universities: string[] }[] = [
  { state: 'Alaska', universities: ['University of Alaska Anchorage', 'University of Alaska Fairbanks', 'University of Alaska Southeast'] },
  { state: 'Idaho', universities: ['Boise State University', 'Idaho State University', 'University of Idaho'] },
  { state: 'Montana', universities: ['Montana State University', 'Montana Technological University', 'University of Montana'] },
  { state: 'Washington', universities: ['Central Washington University', 'Eastern Washington University', 'Gonzaga University', 'University of Washington', 'Washington State University', 'Western Washington University'] },
  { state: 'Wyoming', universities: ['University of Wyoming'] },
]

export type MatchStatus = 'unmatched' | 'processing' | 'in-progress' | 'matched'

export interface Abstract {
  id: number
  applicantName: string
  title: string
  matchStatus: MatchStatus
  program: string
  affiliation: string
  email: string
  invitationSent: boolean
  acceptedReview: boolean
  submitted: string
  abstract: string
}

export interface LiveMatchEntry {
  id: string
  jobId: number
  abstracts: Array<{ id: number; title: string; applicantName: string; program: string }>
  programs: string[]
  status: 'processing' | 'in-progress'
  submittedAt: Date
  isBatch: boolean
}

interface PeerLinkContextType {
  abstracts: Abstract[]
  liveMatchEntries: LiveMatchEntry[]
  loading: boolean
  reload: () => Promise<void>
  submitForReview: (abstractId: number, payload: MatchPayload) => Promise<number>
  updateAbstract: (id: number, updates: Partial<Abstract>) => Promise<void>
  syncGravityForms: () => Promise<{ synced: number }>
}

export interface MatchPayload {
  institutions: { name: string; count: number }[]
  year_from: number
  year_to?: number
}

const PeerLinkContext = createContext<PeerLinkContextType | null>(null)

function toAbstract(a: APIAbstract): Abstract {
  return {
    id: a.id,
    applicantName: a.applicant_name,
    title: a.title,
    matchStatus: a.status as MatchStatus,
    program: a.program,
    affiliation: a.affiliation,
    email: a.applicant_email,
    invitationSent: a.invitation_sent,
    acceptedReview: a.accepted_review,
    submitted: a.submitted_at
      ? new Date(a.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : '',
    abstract: a.abstract_text,
  }
}

export function PeerLinkProvider({ children }: { children: ReactNode }) {
  const [abstracts, setAbstracts] = useState<Abstract[]>([])
  const [liveMatchEntries, setLiveMatchEntries] = useState<LiveMatchEntry[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const abs = await api.getAbstracts()
      setAbstracts(abs.map(toAbstract))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { reload() }, [reload])

  const submitForReview = useCallback(async (abstractId: number, payload: MatchPayload): Promise<number> => {
    const { job_id } = await api.startMatching({ abstract_id: abstractId, ...payload })
    setAbstracts((prev) =>
      prev.map((a) => (a.id === abstractId ? { ...a, matchStatus: 'processing' } : a))
    )
    const abs = abstracts.find((a) => a.id === abstractId)
    if (abs) {
      const entry: LiveMatchEntry = {
        id: `job-${job_id}`,
        jobId: job_id,
        abstracts: [{ id: abs.id, title: abs.title, applicantName: abs.applicantName, program: abs.program }],
        programs: [abs.program],
        status: 'processing',
        submittedAt: new Date(),
        isBatch: false,
      }
      setLiveMatchEntries((prev) => [entry, ...prev])
    }
    return job_id
  }, [abstracts])

  const updateAbstract = useCallback(async (id: number, updates: Partial<Abstract>) => {
    const apiUpdates: Record<string, unknown> = {}
    if (updates.invitationSent !== undefined) apiUpdates.invitation_sent = updates.invitationSent
    if (updates.acceptedReview !== undefined) apiUpdates.accepted_review = updates.acceptedReview
    if (updates.matchStatus !== undefined) apiUpdates.status = updates.matchStatus
    await api.updateAbstract(id, apiUpdates as Parameters<typeof api.updateAbstract>[1])
    setAbstracts((prev) => prev.map((a) => (a.id === id ? { ...a, ...updates } : a)))
  }, [])

  const syncGravityForms = useCallback(async () => {
    const result = await api.syncGravityForms()
    await reload()
    return result
  }, [reload])

  return (
    <PeerLinkContext.Provider value={{
      abstracts, liveMatchEntries,
      loading, reload, submitForReview, updateAbstract,
      syncGravityForms,
    }}>
      {children}
    </PeerLinkContext.Provider>
  )
}

export function usePeerLink() {
  const ctx = useContext(PeerLinkContext)
  if (!ctx) throw new Error('usePeerLink must be used within PeerLinkProvider')
  return ctx
}
