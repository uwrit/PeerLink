const BASE = '/api'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail ?? res.statusText)
  }
  return res.json()
}

export const api = {
  getAbstracts: (params?: { status?: string; program?: string }) => {
    const q = new URLSearchParams()
    if (params?.status) q.set('status', params.status)
    if (params?.program) q.set('program', params.program)
    return request<Abstract[]>(`/abstracts${q.toString() ? `?${q}` : ''}`)
  },

  createAbstract: (body: CreateAbstractBody) =>
    request<Abstract>('/abstracts', { method: 'POST', body: JSON.stringify(body) }),

  updateAbstract: (id: number, body: Partial<Abstract>) =>
    request<Abstract>(`/abstracts/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  getInstitutions: () =>
    request<InstitutionGroup[]>('/institutions'),

  getPrograms: () =>
    request<string[]>('/programs'),

  startMatching: (body: MatchRequest) =>
    request<{ job_id: number; status: string }>('/matching/start', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  getJob: (jobId: number) =>
    request<MatchJob>(`/matching/${jobId}`),

  getMatchJobs: () =>
    request<MatchJob[]>('/matching/jobs'),

  syncGravityForms: () =>
    request<{ synced: number }>('/sync/gravity-forms', { method: 'POST' }),
}

export interface Abstract {
  id: number
  gf_entry_id: string
  title: string
  abstract_text: string
  pdf_url: string
  program: string
  applicant_name: string
  applicant_email: string
  affiliation: string
  exclude_authors_json: string
  status: 'unmatched' | 'processing' | 'in-progress' | 'matched'
  submitted_at: string | null
  invitation_sent: boolean
  accepted_review: boolean
  created_at: string
  updated_at: string
}

export interface CreateAbstractBody {
  title: string
  abstract_text: string
  program: string
  applicant_name: string
  applicant_email: string
  affiliation: string
}

export interface InstitutionGroup {
  state: string
  universities: string[]
}

export interface MatchRequest {
  abstract_id: number
  institutions: { name: string; count: number }[]
  year_from: number
  year_to?: number
}

export interface MatchJob {
  id: number
  abstract_id: number
  status: string
  created_at: string
  year_from: number
  year_to: number | null
  institutions: { name: string; count: number }[]
  progress: Record<string, string>
  results: ReviewerResult[] | Record<string, ReviewerResult[]>
  logs?: Record<string, string[]>
}

export interface ReviewerResult {
  reviewer_name: string
  institution: string
  openalex_id?: string
  orcid?: string
  affiliation?: string
  h_index?: number
  works_count?: number
  cited_by_count?: number
  top_topics?: string[]
  justification?: string
  raw?: string
  parse_error?: string
}
