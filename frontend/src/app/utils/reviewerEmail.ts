// (subject + body) and produces a mailto: URL. Default templates are derived
// from the ITHS mail-merge letters provided by the program team. Users can
// override any program's template from the Settings page; overrides are stored
// in localStorage and resolved at render time.

export type ProgramKey =
  | 'Early-Stage Product Development Award'
  | 'New Interdisciplinary Academic Collaborations'
  | 'Academic Community Partnerships'

export const PROGRAM_KEYS: ProgramKey[] = [
  'Early-Stage Product Development Award',
  'New Interdisciplinary Academic Collaborations',
  'Academic Community Partnerships',
]

export interface TemplateInputs {
  reviewerName: string
  applicantName: string
  projectTitle: string
}

export interface RenderedEmail {
  subject: string
  body: string
}

export interface EmailTemplate {
  subject: string
  body: string
}

// Placeholders supported in template bodies and subjects.
export const TEMPLATE_PLACEHOLDERS: Array<{ token: string; description: string }> = [
  { token: '{REVIEWER_LAST}', description: "Reviewer's last name" },
  { token: '{REVIEWER_NAME}', description: "Reviewer's full name" },
  { token: '{APPLICANT_LAST}', description: "Applicant's last name" },
  { token: '{APPLICANT_NAME}', description: "Applicant's full name" },
  { token: '{PROJECT_TITLE}', description: 'Title of the applicant project' },
]

const DEFAULT_SUBJECT = 'Please help ITHS select grant awardees'

const SIGNATURE = `Sincerely,
The ITHS Pilot Awards Team

Nina Isoherranen, PhD
Professor and Milo Gibaldi Chair
Department of Pharmaceutics
School of Pharmacy
Co-Director, ITHS Pilot Awards Program
University of Washington

Teddy Johnson, PE, MBA
Clinical Associate Professor of Pharmacy
Director, ITHS Technology Development Center
Co-Director, ITHS Pilot Awards Program
University of Washington

Rachel Bender Ignacio, MD, MPH
Associate Professor and Robert W. Anderson Endowed Chair
Division of Allergy and Infectious Diseases, Department of Medicine
Adjunct Associate Professor, Department of Epidemiology
Co-Director, ITHS Pilot Awards Program
Assistant Professor, Vaccine and Infectious Disease Division
Fred Hutch Cancer Center

Amaya Gatling, MPH
Project Manager
Institute of Translational Health Sciences
University of Washington`

const COMMON_TAIL = `If you are interested, we ask that you confirm that you have no conflicts of interest: 1. You are not the applicant's mentor, department chair, spouse, or a close relative, or 2. You have not previously or are not currently collaborating on manuscripts, grants, or business ventures with the applicant. Merely sharing the same department or division does not, on its own, constitute a conflict of interest.

If you have a conflict of interest or simply cannot serve as a reviewer at this time, could you suggest a colleague who may be able to fulfill this role?

Please let us know whether you are willing to serve as a reviewer as soon as possible so we can send you Dr. {APPLICANT_LAST}'s proposal for review. If you have any questions, please feel free to contact us at ithspilots@uw.edu.

Thank you for your consideration. Your efforts will help us fulfill our mission of speeding science to clinical practice for the benefit of patients and communities through the Washington, Wyoming, Alaska, Montana, and Idaho (WWAMI) region and beyond.`

const REVIEW_PARAGRAPH = `The burden of review is low. The research section is limited to two pages. The review process is simple, confidential, and will be completed via a REDCap survey. Reviewers remain anonymous, and your responses are invaluable feedback for our applicants. Reviews would be due by November 10, 2025.`

const INTROS: Record<ProgramKey, string> = {
  'Early-Stage Product Development Award':
    'Even in these days of funding challenges, the Institute of Translational Health Sciences (ITHS) offers Pilot awards up to $100,000 to accelerate translation and improve health through its Early-Stage Product Development Award. This award is designed to support the development of new products based on scientific discovery and drive those products to clinical impact.',
  'New Interdisciplinary Academic Collaborations':
    'Even in these days of funding challenges, the Institute of Translational Health Sciences (ITHS) offers Pilot awards up to $50,000 to accelerate research and improve health through its New Interdisciplinary Academic Partnerships Award. This unique award is designed to support new interdisciplinary partnerships in clinical and translational science that show potential to become long-term collaborations.',
  'Academic Community Partnerships':
    'Even in these days of funding challenges, the Institute of Translational Health Sciences (ITHS) offers Pilot awards up to $50,000 to accelerate research and improve health through its Academic Community Partnerships Award. This unique award is designed to jump start collaborations between academic researchers and community organizations in new projects that investigate a community-based health problem, disseminate evidence-based health innovations into practice, target health promotion or prevention, or examine ways to enhance or implement sustainable health programs in community settings.',
}

function lastName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  return parts.length > 0 ? parts[parts.length - 1] : fullName.trim()
}

function buildDefaultBody(program: ProgramKey): string {
  return [
    'Dear Dr. {REVIEWER_LAST},',
    '',
    INTROS[program],
    '',
    "As an expert in your field, we request your help in reviewing Dr. {APPLICANT_LAST}'s project, {PROJECT_TITLE}.",
    '',
    REVIEW_PARAGRAPH,
    '',
    COMMON_TAIL,
    '',
    SIGNATURE,
  ].join('\n')
}

export function getDefaultTemplate(program: ProgramKey): EmailTemplate {
  return {
    subject: DEFAULT_SUBJECT,
    body: buildDefaultBody(program),
  }
}

const STORAGE_KEY = 'peerlink:reviewerEmailTemplates'

type StoredTemplates = Partial<Record<ProgramKey, EmailTemplate>>

function readStored(): StoredTemplates {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeStored(value: StoredTemplates): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  } catch {
    // ignore quota / serialization errors
  }
}

export function loadTemplate(program: ProgramKey): EmailTemplate {
  const stored = readStored()[program]
  if (stored && typeof stored.subject === 'string' && typeof stored.body === 'string') {
    return stored
  }
  return getDefaultTemplate(program)
}

export function saveTemplate(program: ProgramKey, template: EmailTemplate): void {
  const stored = readStored()
  stored[program] = template
  writeStored(stored)
}

export function resetTemplate(program: ProgramKey): void {
  const stored = readStored()
  delete stored[program]
  writeStored(stored)
}

export function hasCustomTemplate(program: ProgramKey): boolean {
  return readStored()[program] !== undefined
}

function applyPlaceholders(text: string, inputs: TemplateInputs): string {
  const reviewerLast = lastName(inputs.reviewerName)
  const applicantLast = lastName(inputs.applicantName)
  return text
    .split('{REVIEWER_LAST}').join(reviewerLast)
    .split('{REVIEWER_NAME}').join(inputs.reviewerName)
    .split('{APPLICANT_LAST}').join(applicantLast)
    .split('{APPLICANT_NAME}').join(inputs.applicantName)
    .split('{PROJECT_TITLE}').join(inputs.projectTitle)
}

export function renderReviewerEmail(
  program: string,
  inputs: TemplateInputs,
): RenderedEmail | null {
  if (!PROGRAM_KEYS.includes(program as ProgramKey)) return null
  const tpl = loadTemplate(program as ProgramKey)
  return {
    subject: applyPlaceholders(tpl.subject, inputs),
    body: applyPlaceholders(tpl.body, inputs),
  }
}

export function buildReviewerMailto(
  program: string,
  inputs: TemplateInputs & { reviewerEmail?: string },
): string | null {
  const rendered = renderReviewerEmail(program, inputs)
  if (!rendered) return null
  const params = new URLSearchParams()
  params.set('subject', rendered.subject)
  params.set('body', rendered.body)
  // URLSearchParams encodes spaces as '+', mailto clients expect %20
  const query = params.toString().replace(/\+/g, '%20')
  const to = inputs.reviewerEmail ? encodeURIComponent(inputs.reviewerEmail) : ''
  return `mailto:${to}?${query}`
}
