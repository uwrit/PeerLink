// Maps an abstract's award program to a reviewer-invitation email template
// (subject + body) and produces a mailto: URL. Templates are derived from the
// ITHS mail-merge letters provided by the program team.

export type ProgramKey =
  | 'Early-Stage Product Development Award'
  | 'New Interdisciplinary Academic Collaborations'
  | 'Academic Community Partnerships'

interface TemplateInputs {
  reviewerName: string
  applicantName: string
  projectTitle: string
}

interface RenderedEmail {
  subject: string
  body: string
}

const SUBJECT = 'Please help ITHS select grant awardees'

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

function lastName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  return parts.length > 0 ? parts[parts.length - 1] : fullName.trim()
}

function buildBody(intro: string, inputs: TemplateInputs): string {
  const reviewerLast = lastName(inputs.reviewerName)
  const applicantLast = lastName(inputs.applicantName)
  const tail = COMMON_TAIL.split('{APPLICANT_LAST}').join(applicantLast)
  return [
    `Dear Dr. ${reviewerLast},`,
    '',
    intro,
    '',
    `As an expert in your field, we request your help in reviewing Dr. ${applicantLast}'s project, ${inputs.projectTitle}.`,
    '',
    REVIEW_PARAGRAPH,
    '',
    tail,
    '',
    SIGNATURE,
  ].join('\n')
}

const INTROS: Record<ProgramKey, string> = {
  'Early-Stage Product Development Award':
    'Even in these days of funding challenges, the Institute of Translational Health Sciences (ITHS) offers Pilot awards up to $100,000 to accelerate translation and improve health through its Early-Stage Product Development Award. This award is designed to support the development of new products based on scientific discovery and drive those products to clinical impact.',
  'New Interdisciplinary Academic Collaborations':
    'Even in these days of funding challenges, the Institute of Translational Health Sciences (ITHS) offers Pilot awards up to $50,000 to accelerate research and improve health through its New Interdisciplinary Academic Partnerships Award. This unique award is designed to support new interdisciplinary partnerships in clinical and translational science that show potential to become long-term collaborations.',
  'Academic Community Partnerships':
    'Even in these days of funding challenges, the Institute of Translational Health Sciences (ITHS) offers Pilot awards up to $50,000 to accelerate research and improve health through its Academic Community Partnerships Award. This unique award is designed to jump start collaborations between academic researchers and community organizations in new projects that investigate a community-based health problem, disseminate evidence-based health innovations into practice, target health promotion or prevention, or examine ways to enhance or implement sustainable health programs in community settings.',
}

export function renderReviewerEmail(
  program: string,
  inputs: TemplateInputs,
): RenderedEmail | null {
  const intro = INTROS[program as ProgramKey]
  if (!intro) return null
  return { subject: SUBJECT, body: buildBody(intro, inputs) }
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
