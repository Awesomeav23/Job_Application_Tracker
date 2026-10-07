import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronDown,
  CircleHelp,
  FileText,
  FileUp,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Mail,
  MapPin,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Settings2,
  Sparkles,
  Trash2,
  Upload,
  UserRound,
  X,
} from 'lucide-react'
import './App.css'
import confetti from 'canvas-confetti'
import { ApiError, apiFetch, authenticate, clearSession, downloadDocument, getCurrentUser, hasSession, type AuthUser } from './lib/api'

type Status = 'SAVED' | 'APPLIED' | 'RECRUITER_SCREEN' | 'INTERVIEW' | 'OFFER' | 'REJECTED' | 'WITHDRAWN'
type View = 'overview' | 'board' | 'applications' | 'stats' | 'documents' | 'profile' | 'settings'
type DocumentKind = 'RESUME' | 'COVER_LETTER'

interface DocumentAttachment {
  id: string
  label: string
}

interface Application {
  id: string
  company: string
  jobTitle: string
  status: Status
  location: string
  dateApplied: string
  salary: string
  url: string
  jobDescription: string
  notes: string
  source?: string
  resumeId: string | null
  coverLetterId: string | null
  resume: DocumentAttachment | null
  coverLetter: DocumentAttachment | null
}

type ApplicationDraft = Omit<Application, 'id'>

interface ApiDocumentAttachment {
  id: string
  label: string
}

interface ApiApplication extends Omit<Application, 'dateApplied' | 'source' | 'location' | 'salary' | 'url' | 'notes' | 'resume' | 'coverLetter'> {
  dateApplied: string | null
  location: string | null
  salary: string | null
  url: string | null
  notes: string | null
  source: 'MANUAL' | 'EXTENSION'
  resume: ApiDocumentAttachment | null
  coverLetter: ApiDocumentAttachment | null
}

interface AppDocument {
  id: string
  kind: DocumentKind
  label: string
  version: string | null
  originalFileName: string
  sizeBytes: number
  createdAt: string
  archivedAt: string | null
}

interface ApiDocument extends Omit<AppDocument, 'version' | 'archivedAt'> {
  version: string | null
  archivedAt: string | null
}

interface DocumentListResponse {
  items: ApiDocument[]
  total: number
}

interface AnalyticsSummary {
  totalApplications: number
  byStatus: Record<Status, number>
  responseRate: number | null
  interviewConversionRate: number | null
  averageResponseDays: number | null
}

interface AnalysisDocumentRef {
  id: string
  label: string
}

interface Analysis {
  id: string
  applicationId: string
  document: AnalysisDocumentRef | null
  matchScore: number
  summary: string
  strengths: string[]
  missingSkills: string[]
  relevantExperience: string[]
  provider: string
  modelId: string
  createdAt: string
}

interface AnalysisListResponse {
  items: Analysis[]
}

interface InterviewQuestionSet {
  id: string
  applicationId: string
  questions: string[]
  provider: string
  modelId: string
  createdAt: string
}

interface InterviewQuestionListResponse {
  items: InterviewQuestionSet[]
}

type ApplicationModalTab = 'details' | 'ai'

const statuses: Status[] = ['SAVED', 'APPLIED', 'RECRUITER_SCREEN', 'INTERVIEW', 'OFFER', 'REJECTED', 'WITHDRAWN']
const sources = ['MANUAL', 'EXTENSION'] as const
const SAVED_EMAILS_KEY = 'fieldnote.savedEmails'
const SAMPLE_SEEDED_PREFIX = 'fieldnote.sampleApplicationsSeeded.v5:'

function getSavedEmails(): string[] {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVED_EMAILS_KEY) || '[]')
    return Array.isArray(saved) ? saved.filter((email): email is string => typeof email === 'string') : []
  } catch {
    return []
  }
}

function rememberEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase()
  if (!normalizedEmail) return
  const emails = getSavedEmails().filter((savedEmail) => savedEmail.toLowerCase() !== normalizedEmail)
  localStorage.setItem(SAVED_EMAILS_KEY, JSON.stringify([normalizedEmail, ...emails].slice(0, 5)))
}

const statusLabels: Record<Status, string> = {
  SAVED: 'Saved',
  APPLIED: 'Applied',
  RECRUITER_SCREEN: 'Recruiter screen',
  INTERVIEW: 'Interview',
  OFFER: 'Offer',
  REJECTED: 'Rejected',
  WITHDRAWN: 'Withdrawn',
}

const emptyDraft: ApplicationDraft = {
  company: '', jobTitle: '', status: 'SAVED', location: '', dateApplied: new Date().toISOString().slice(0, 10),
  salary: '', url: '', jobDescription: '', notes: '', source: 'Company website',
  resumeId: null, coverLetterId: null, resume: null, coverLetter: null,
}

const sampleCompanies = [
  { name: 'Northstar Analytics', location: 'Remote · US' },
  { name: 'Cedar Labs', location: 'Boston, MA · Hybrid' },
  { name: 'Harbor Health', location: 'Remote · US' },
  { name: 'Juniper Works', location: 'Chicago, IL' },
  { name: 'Mosaic Learning', location: 'Remote · US' },
  { name: 'Redwood Mobility', location: 'Portland, OR · Hybrid' },
  { name: 'Blue Oak Finance', location: 'New York, NY' },
  { name: 'Summit Climate', location: 'Denver, CO · Hybrid' },
  { name: 'Atlas Commerce', location: 'Remote · US' },
  { name: 'Kindred Care', location: 'Austin, TX' },
  { name: 'Lantern Studio', location: 'Los Angeles, CA · Hybrid' },
  { name: 'Fieldstone Systems', location: 'Seattle, WA' },
] as const

const sampleRoles = [
  { title: 'Junior Data Analyst', salary: '$72,000–$88,000', description: 'Build clear reports, validate datasets, and explain trends to product and operations teams. SQL, spreadsheets, and strong communication are useful.' },
  { title: 'Associate Product Designer', salary: '$88,000–$108,000', description: 'Turn customer problems into accessible interface designs. Share prototypes, collaborate with engineers, and iterate based on research.' },
  { title: 'Software Engineer I', salary: '$96,000–$120,000', description: 'Build reliable web features, write automated tests, and work with product and design. TypeScript experience is helpful.' },
  { title: 'Customer Success Associate', salary: '$64,000–$78,000', description: 'Help customers onboard, answer product questions, and share customer feedback with the product team.' },
  { title: 'Content Strategist', salary: '$82,000–$98,000', description: 'Plan and create useful learning content across web and email. Partner with subject experts and measure engagement.' },
  { title: 'Operations Coordinator', salary: '$68,000–$82,000', description: 'Coordinate schedules, improve internal workflows, and keep cross-functional projects moving.' },
  { title: 'Product Manager', salary: '$110,000–$138,000', description: 'Set product priorities with customer research, define clear outcomes, and coordinate delivery across design and engineering.' },
] as const

const sampleNotes = [
  'Tailor the resume to the role before the next step.',
  'Follow up if there is no response by next week.',
  'Prepare a short overview of relevant project experience.',
  'Review the company product and recent announcements.',
  'Capture interview notes and follow-up actions here.',
  'Check the role requirements against the portfolio.',
] as const

const baseSampleApplications = Array.from({ length: 84 }, (_, index) => {
  const company = sampleCompanies[Math.floor(index / sampleRoles.length)]
  const role = sampleRoles[index % sampleRoles.length]
  const status = statuses[(index * 3) % statuses.length]
  return {
    company: company.name,
    jobTitle: role.title,
    jobDescription: role.description,
    status,
    location: company.location,
    salary: role.salary,
    url: `https://example.com/jobs/${company.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${role.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    notes: sampleNotes[index % sampleNotes.length],
    daysAgo: (index * 11) % 91,
  }
})

// Second batch: recent interview- and offer-heavy applications so the
// trend line has a story to tell (interview rate climbing over time).
const recentInterviewBatch: Array<{
  company: string
  jobTitle: string
  jobDescription: string
  status: Status
  location: string
  salary: string
  url: string
  notes: string
  daysAgo: number
}> = [
  { company: 'Northstar Analytics', jobTitle: 'Senior Data Analyst', jobDescription: 'Lead analytics for the growth pod, mentor junior analysts, and drive experiment design.', status: 'INTERVIEW', location: 'Remote · US', salary: '$118,000–$142,000', url: 'https://example.com/jobs/northstar-senior-data-analyst', notes: 'Onsite panel next Tuesday.', daysAgo: 0 },
  { company: 'Cedar Labs', jobTitle: 'Full Stack Engineer', jobDescription: 'Own features end-to-end across React and Node services.', status: 'OFFER', location: 'Boston, MA · Hybrid', salary: '$140,000–$168,000', url: 'https://example.com/jobs/cedar-full-stack-engineer', notes: 'Offer received, negotiating equity.', daysAgo: 1 },
  { company: 'Harbor Health', jobTitle: 'Clinical Analytics Manager', jobDescription: 'Own reporting for population health programs.', status: 'INTERVIEW', location: 'Remote · US', salary: '$132,000–$158,000', url: 'https://example.com/jobs/harbor-clinical-analytics', notes: 'Case study submitted, awaiting feedback.', daysAgo: 2 },
  { company: 'Juniper Works', jobTitle: 'Growth Product Manager', jobDescription: 'Drive activation and retention experiments.', status: 'INTERVIEW', location: 'Chicago, IL', salary: '$128,000–$150,000', url: 'https://example.com/jobs/juniper-growth-pm', notes: 'Meeting the CPO on Thursday.', daysAgo: 3 },
  { company: 'Mosaic Learning', jobTitle: 'Learning Experience Designer', jobDescription: 'Design K-12 curriculum modules and instructor tooling.', status: 'INTERVIEW', location: 'Remote · US', salary: '$96,000–$118,000', url: 'https://example.com/jobs/mosaic-lx-designer', notes: 'Portfolio walkthrough scheduled.', daysAgo: 4 },
  { company: 'Redwood Mobility', jobTitle: 'Machine Learning Engineer', jobDescription: 'Build routing models for last-mile logistics.', status: 'OFFER', location: 'Portland, OR · Hybrid', salary: '$155,000–$185,000', url: 'https://example.com/jobs/redwood-ml-engineer', notes: 'Verbal offer, written to follow.', daysAgo: 6 },
  { company: 'Blue Oak Finance', jobTitle: 'Senior Backend Engineer', jobDescription: 'Design payment infrastructure and internal risk services.', status: 'INTERVIEW', location: 'New York, NY', salary: '$168,000–$198,000', url: 'https://example.com/jobs/blue-oak-senior-backend', notes: 'System design round next week.', daysAgo: 7 },
  { company: 'Summit Climate', jobTitle: 'Data Engineering Lead', jobDescription: 'Own the emissions data pipeline from ingest to reporting.', status: 'INTERVIEW', location: 'Denver, CO · Hybrid', salary: '$148,000–$172,000', url: 'https://example.com/jobs/summit-data-eng-lead', notes: 'Team fit interview booked.', daysAgo: 9 },
  { company: 'Atlas Commerce', jobTitle: 'Staff Software Engineer', jobDescription: 'Lead architecture for the merchant platform.', status: 'INTERVIEW', location: 'Remote · US', salary: '$185,000–$220,000', url: 'https://example.com/jobs/atlas-staff-engineer', notes: 'Awaiting hiring manager sync.', daysAgo: 11 },
  { company: 'Kindred Care', jobTitle: 'Product Analytics Lead', jobDescription: 'Bring product decisions closer to patient outcomes.', status: 'RECRUITER_SCREEN', location: 'Austin, TX', salary: '$134,000–$158,000', url: 'https://example.com/jobs/kindred-product-analytics', notes: 'Recruiter follow-up on Friday.', daysAgo: 34 },
  { company: 'Lantern Studio', jobTitle: 'Senior Product Designer', jobDescription: 'Shape the studio\'s flagship editing tools.', status: 'APPLIED', location: 'Los Angeles, CA · Hybrid', salary: '$130,000–$156,000', url: 'https://example.com/jobs/lantern-senior-product-designer', notes: 'Applied through referral.', daysAgo: 40 },
  { company: 'Fieldstone Systems', jobTitle: 'Platform Engineer', jobDescription: 'Own the internal developer platform and CI/CD tooling.', status: 'APPLIED', location: 'Seattle, WA', salary: '$150,000–$180,000', url: 'https://example.com/jobs/fieldstone-platform-engineer', notes: 'Awaiting first response.', daysAgo: 46 },
  { company: 'Northstar Analytics', jobTitle: 'Analytics Engineer', jobDescription: 'Model core business metrics in dbt.', status: 'REJECTED', location: 'Remote · US', salary: '$118,000–$140,000', url: 'https://example.com/jobs/northstar-analytics-engineer', notes: 'Team paused hiring.', daysAgo: 52 },
  { company: 'Cedar Labs', jobTitle: 'Frontend Engineer', jobDescription: 'Ship React features and improve design-system adoption.', status: 'APPLIED', location: 'Boston, MA · Hybrid', salary: '$120,000–$146,000', url: 'https://example.com/jobs/cedar-frontend-engineer', notes: 'Application submitted.', daysAgo: 58 },
  { company: 'Harbor Health', jobTitle: 'Data Scientist', jobDescription: 'Predictive models for chronic-care programs.', status: 'REJECTED', location: 'Remote · US', salary: '$132,000–$158,000', url: 'https://example.com/jobs/harbor-data-scientist', notes: 'Role closed after final round.', daysAgo: 66 },
]

// Real applications sent by the project owner (Sep 30 – Oct 6, 2026). Shown
// alongside synthetic samples so the demo reflects actual recent activity.
const realApplications: Array<{
  company: string
  jobTitle: string
  jobDescription: string
  status: Status
  location: string
  salary: string
  url: string
  notes: string
  daysAgo: number
}> = [
  { company: 'Roku', jobTitle: 'Software Engineer (Project Ahsoka)', jobDescription: 'Role sourced from company careers page.', status: 'APPLIED', location: '', salary: '', url: '', notes: '', daysAgo: 1 },
  { company: 'Lockheed Martin', jobTitle: 'Associate Member Engineering Staff', jobDescription: 'Role sourced from company careers page.', status: 'APPLIED', location: '', salary: '', url: '', notes: '', daysAgo: 1 },
  { company: 'Caris Life Sciences', jobTitle: 'Associate Software Engineer', jobDescription: 'Role sourced from company careers page.', status: 'APPLIED', location: '', salary: '', url: '', notes: '', daysAgo: 1 },
  { company: 'Capgemini', jobTitle: 'Associate Software Engineer', jobDescription: 'Role sourced from company careers page.', status: 'APPLIED', location: '', salary: '', url: '', notes: '', daysAgo: 2 },
  { company: 'Pave', jobTitle: 'Software Engineer 1', jobDescription: 'Role sourced from company careers page.', status: 'APPLIED', location: '', salary: '', url: '', notes: '', daysAgo: 2 },
  { company: 'LSEG', jobTitle: 'Software Engineer', jobDescription: 'Role sourced from company careers page.', status: 'APPLIED', location: '', salary: '', url: '', notes: '', daysAgo: 2 },
  { company: 'FedEx', jobTitle: 'Full Stack Engineer II', jobDescription: 'Role sourced from company careers page.', status: 'APPLIED', location: '', salary: '', url: '', notes: '', daysAgo: 2 },
  { company: 'Ascendion', jobTitle: 'Software Engineer II', jobDescription: 'Role sourced from company careers page.', status: 'APPLIED', location: '', salary: '', url: '', notes: '', daysAgo: 2 },
  { company: 'Voltus', jobTitle: 'Software Engineer', jobDescription: 'Role sourced from company careers page.', status: 'APPLIED', location: '', salary: '', url: '', notes: '', daysAgo: 2 },
  { company: 'Cynet Systems', jobTitle: 'Full Stack Web Developer', jobDescription: 'Role sourced from company careers page.', status: 'APPLIED', location: '', salary: '', url: '', notes: '', daysAgo: 5 },
  { company: 'SAS', jobTitle: 'Software Developer (Emerging Careers)', jobDescription: 'Role sourced from company careers page.', status: 'APPLIED', location: '', salary: '', url: '', notes: '', daysAgo: 5 },
  { company: 'State Farm', jobTitle: 'Software Engineer', jobDescription: 'Role sourced from company careers page.', status: 'REJECTED', location: '', salary: '', url: '', notes: 'Rejected the next day.', daysAgo: 5 },
  { company: 'Visa', jobTitle: 'Software Engineer', jobDescription: 'Role sourced from company careers page.', status: 'APPLIED', location: '', salary: '', url: '', notes: '', daysAgo: 5 },
  { company: 'AWS', jobTitle: 'Associate Solutions Architect', jobDescription: 'Role sourced from company careers page.', status: 'APPLIED', location: '', salary: '', url: '', notes: '', daysAgo: 5 },
  { company: 'ElevenLabs', jobTitle: 'Full-Stack Engineer', jobDescription: 'Role sourced from company careers page.', status: 'APPLIED', location: '', salary: '', url: '', notes: '', daysAgo: 6 },
  { company: 'Fonzi', jobTitle: 'Full Stack Engineer', jobDescription: 'Role sourced from company careers page.', status: 'APPLIED', location: '', salary: '', url: '', notes: 'Talent marketplace.', daysAgo: 6 },
  { company: 'Bain & Company', jobTitle: 'Full Stack Software Engineer', jobDescription: 'Role sourced from company careers page.', status: 'APPLIED', location: '', salary: '', url: '', notes: '', daysAgo: 7 },
  { company: 'Sunwest Bank', jobTitle: 'Technology Analyst Program', jobDescription: 'Role sourced from company careers page.', status: 'APPLIED', location: '', salary: '', url: '', notes: '', daysAgo: 7 },
  { company: 'Steadfast AI', jobTitle: 'Software Engineer', jobDescription: 'Role sourced from company careers page.', status: 'APPLIED', location: '', salary: '', url: '', notes: '', daysAgo: 7 },
  { company: 'Clerkie', jobTitle: 'Full-Stack Engineer', jobDescription: 'Role sourced from company careers page.', status: 'APPLIED', location: '', salary: '', url: '', notes: '', daysAgo: 7 },
]

const sampleApplications = [...baseSampleApplications, ...recentInterviewBatch, ...realApplications]

function formatDate(value: string) {
  if (!value) return 'Not set'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(`${value}T12:00:00`))
}

function fromApiApplication(application: ApiApplication): Application {
  return {
    ...application,
    dateApplied: application.dateApplied?.slice(0, 10) ?? '',
    location: application.location ?? '',
    salary: application.salary ?? '',
    url: application.url ?? '',
    notes: application.notes ?? '',
    resumeId: application.resumeId ?? null,
    coverLetterId: application.coverLetterId ?? null,
    resume: application.resume ? { id: application.resume.id, label: application.resume.label } : null,
    coverLetter: application.coverLetter ? { id: application.coverLetter.id, label: application.coverLetter.label } : null,
  }
}

function fromApiDocument(document: ApiDocument): AppDocument {
  return {
    id: document.id,
    kind: document.kind,
    label: document.label,
    version: document.version,
    originalFileName: document.originalFileName,
    sizeBytes: document.sizeBytes,
    createdAt: document.createdAt,
    archivedAt: document.archivedAt,
  }
}

function formatBytes(bytes: number) {
  if (!bytes) return '0 KB'
  const units = ['KB', 'MB']
  const inKb = bytes / 1024
  if (inKb < 1024) return `${inKb.toFixed(inKb < 10 ? 1 : 0)} ${units[0]}`
  return `${(inKb / 1024).toFixed(2)} ${units[1]}`
}

function documentKindLabel(kind: DocumentKind, plural = false) {
  if (kind === 'RESUME') return plural ? 'resumes' : 'resume'
  return plural ? 'cover letters' : 'cover letter'
}

function applicationErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    const fieldErrors = Object.entries(error.fields ?? {}).map(([field, message]) => `${field}: ${message}`)
    return fieldErrors.length ? `${error.message} ${fieldErrors.join('; ')}` : error.message
  }
  return error instanceof Error ? error.message : fallback
}

async function askBrowserToSavePassword(user: AuthUser, password: string) {
  const PasswordCredential = (window as Window & {
    PasswordCredential?: new (data: { id: string; name?: string; password: string }) => Credential
  }).PasswordCredential
  if (!PasswordCredential || typeof navigator.credentials?.store !== 'function') return false

  try {
    const credential = new PasswordCredential({
      id: user.email,
      name: user.displayName || user.email,
      password,
    })
    await navigator.credentials.store(credential)
    return true
  } catch {
    return false
  }
}

function ApplicationTable({
  applications,
  onEdit,
  onStatusChange,
  onDelete,
}: {
  applications: Application[]
  onEdit: (application: Application) => void
  onStatusChange: (id: string, status: Status) => void
  onDelete: (application: Application) => void
}) {
  if (applications.length === 0) {
    return <div className="empty-state"><BriefcaseBusiness size={25} /><strong>No applications match</strong><span>Try another search or clear the status filter.</span></div>
  }

  return (
    <div className="table-scroll">
      <table className="applications-table">
        <thead><tr><th>Role</th><th>Status</th><th>Applied</th><th>Location</th><th><span className="sr-only">Actions</span></th></tr></thead>
        <tbody>
          {applications.map((application) => (
            <tr key={application.id}>
              <td>
                <button className="role-button" onClick={() => onEdit(application)}>
                  <span className="company-mark">{application.company.slice(0, 1)}</span>
                  <span className="role-copy"><strong>{application.jobTitle}</strong><small>{application.company}</small></span>
                </button>
              </td>
              <td>
                <label className={`status-select-wrap status-select-${application.status.toLowerCase()}`}>
                  <span className="sr-only">Status for {application.jobTitle} at {application.company}</span>
                  <select value={application.status} onChange={(event) => onStatusChange(application.id, event.target.value as Status)}>
                    {statuses.filter((status) => status !== 'SAVED' || application.status === 'SAVED').map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
                  </select>
                  <ChevronDown size={13} aria-hidden="true" />
                </label>
              </td>
              <td className="date-cell">{formatDate(application.dateApplied)}</td>
              <td className="location-cell">
                <MapPin size={13} aria-hidden="true" />
                <span className="location-copy">
                  <span>{application.location || '—'}</span>
                  {(application.resume || application.coverLetter) && (
                    <span className="attachment-tags">
                      {application.resume && <span className="attachment-tag" title={`Resume · ${application.resume.label}`}><FileText size={11} />{application.resume.label}</span>}
                      {application.coverLetter && <span className="attachment-tag" title={`Cover letter · ${application.coverLetter.label}`}><FileText size={11} />{application.coverLetter.label}</span>}
                    </span>
                  )}
                </span>
              </td>
              <td>
                <div className="row-actions">
                  <button className="icon-button" aria-label={`Edit ${application.jobTitle} at ${application.company}`} title="Edit application" onClick={() => onEdit(application)}><MoreHorizontal size={17} /></button>
                  <button className="icon-button delete-action" aria-label={`Delete ${application.jobTitle} at ${application.company}`} title="Delete application" onClick={() => onDelete(application)}><Trash2 size={15} /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function App() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [authLoading, setAuthLoading] = useState(() => hasSession())
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [authError, setAuthError] = useState('')
  const [authSuccess, setAuthSuccess] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [passwordOptionsOpen, setPasswordOptionsOpen] = useState(false)
  const [savedEmails, setSavedEmails] = useState<string[]>(getSavedEmails)
  const [authFields, setAuthFields] = useState({ email: '', password: '', displayName: '' })
  const [view, setView] = useState<View>('overview')
  const [applications, setApplications] = useState<Application[]>([])
  const [applicationsLoaded, setApplicationsLoaded] = useState(false)
  const [applicationError, setApplicationError] = useState('')
  const [applicationSaving, setApplicationSaving] = useState(false)
  const [documents, setDocuments] = useState<AppDocument[]>([])
  const [documentsLoaded, setDocumentsLoaded] = useState(false)
  const [documentError, setDocumentError] = useState('')
  const [documentTab, setDocumentTab] = useState<DocumentKind>('RESUME')
  const [documentUploading, setDocumentUploading] = useState(false)
  const [uploadLabel, setUploadLabel] = useState('')
  const [uploadVersion, setUploadVersion] = useState('')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [renamingDocumentId, setRenamingDocumentId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [documentBusyId, setDocumentBusyId] = useState<string | null>(null)
  const [documentDeleteTarget, setDocumentDeleteTarget] = useState<AppDocument | null>(null)
  const [accountMenu, setAccountMenu] = useState<'sidebar' | 'topbar' | null>(null)
  const [displayNameModalOpen, setDisplayNameModalOpen] = useState(false)
  const [displayNameDraft, setDisplayNameDraft] = useState('')
  const [displayNameSaving, setDisplayNameSaving] = useState(false)
  const [displayNameError, setDisplayNameError] = useState('')
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)
  const [passwordFields, setPasswordFields] = useState({ current: '', next: '', confirm: '' })
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null)
  const [analyticsLoaded, setAnalyticsLoaded] = useState(false)
  const [modalTab, setModalTab] = useState<ApplicationModalTab>('details')
  const [analyses, setAnalyses] = useState<Analysis[]>([])
  const [analysesLoaded, setAnalysesLoaded] = useState(false)
  const [analysisError, setAnalysisError] = useState('')
  const [analysisRunning, setAnalysisRunning] = useState(false)
  const [questionSets, setQuestionSets] = useState<InterviewQuestionSet[]>([])
  const [questionsLoaded, setQuestionsLoaded] = useState(false)
  const [questionsError, setQuestionsError] = useState('')
  const [questionsRunning, setQuestionsRunning] = useState(false)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Application | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Application | null>(null)
  const [draft, setDraft] = useState<ApplicationDraft>(emptyDraft)
  const [notice, setNotice] = useState('')

  const filteredApplications = useMemo(() => applications.filter((application) => {
    const searchText = `${application.company} ${application.jobTitle}`.toLowerCase()
    return searchText.includes(query.toLowerCase()) && (statusFilter === 'ALL' || application.status === statusFilter)
  }), [applications, query, statusFilter])

  const activeApplications = applications.filter((application) => !['REJECTED', 'WITHDRAWN'].includes(application.status))
  const sentApplications = applications.filter((application) => !['SAVED', 'WITHDRAWN'].includes(application.status))
  const repliedApplications = applications.filter((application) => ['RECRUITER_SCREEN', 'INTERVIEW', 'OFFER', 'REJECTED'].includes(application.status))
  const responseRate = analytics?.responseRate != null
    ? Math.round(analytics.responseRate * 100)
    : (sentApplications.length ? Math.round((repliedApplications.length / sentApplications.length) * 100) : 0)
  const interviews = analytics?.byStatus?.INTERVIEW ?? applications.filter((application) => application.status === 'INTERVIEW').length
  const offers = analytics?.byStatus?.OFFER ?? applications.filter((application) => application.status === 'OFFER').length
  const needsChasing = analytics?.byStatus?.APPLIED ?? applications.filter((application) => application.status === 'APPLIED').length
  const statusCounts = statuses.map((status) => ({
    status,
    count: analytics?.byStatus?.[status] ?? applications.filter((application) => application.status === status).length,
  }))
  const maxStatusCount = Math.max(1, ...statusCounts.map((item) => item.count))
  const averageResponseDays = analytics?.averageResponseDays ?? null
  const interviewConversionRate = analytics?.interviewConversionRate ?? null
  const sourceCounts = sources.map((source) => ({
    source,
    count: applications.filter((application) => application.source === source).length,
  }))
  const maxSourceCount = Math.max(1, ...sourceCounts.map((item) => item.count))
  const applicationsLoading = Boolean(authUser) && !applicationsLoaded

  useEffect(() => {
    let cancelled = false
    if (!hasSession()) {
      return () => { cancelled = true }
    }
    getCurrentUser()
      .then((user) => { if (!cancelled) setAuthUser(user) })
      .catch(() => { if (!cancelled) clearSession() })
      .finally(() => { if (!cancelled) setAuthLoading(false) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!authUser) return
    const userId = authUser.id
    let cancelled = false
    async function loadApplications() {
      try {
        const items = await apiFetch<ApiApplication[]>('/applications')
        if (cancelled) return

        const seedKey = `${SAMPLE_SEEDED_PREFIX}${userId}`
        const existingApplications = items.map(fromApiApplication)
        setApplications(existingApplications)

        if (localStorage.getItem(seedKey) === 'true') {
          return
        }

        const existingKeys = new Set(existingApplications.map((application) => `${application.company.toLowerCase()}|${application.jobTitle.toLowerCase()}`))
        const missingSamples = sampleApplications.filter((sample) => !existingKeys.has(`${sample.company.toLowerCase()}|${sample.jobTitle.toLowerCase()}`))
        if (missingSamples.length === 0) {
          localStorage.setItem(seedKey, 'true')
          return
        }

        for (const sample of missingSamples) {
          const appliedDate = new Date()
          appliedDate.setUTCDate(appliedDate.getUTCDate() - sample.daysAgo)
          const saved = await apiFetch<ApiApplication>('/applications', {
            method: 'POST',
            body: JSON.stringify({
              company: sample.company,
              jobTitle: sample.jobTitle,
              jobDescription: sample.jobDescription,
              status: sample.status,
              location: sample.location,
              salary: sample.salary,
              url: sample.url,
              notes: sample.notes,
              dateApplied: appliedDate.toISOString(),
            }),
          })
          if (!cancelled) setApplications((current) => [fromApiApplication(saved), ...current])
          if (cancelled) return
        }
        localStorage.setItem(seedKey, 'true')
        setNotice(`${missingSamples.length} sample applications were added so you can explore the tracker. You can edit or delete them anytime.`)
        void refreshAnalytics()
      } catch (error) {
        if (!cancelled) {
          const latestApplications = await apiFetch<ApiApplication[]>('/applications').catch(() => [])
          if (latestApplications.length) setApplications(latestApplications.map(fromApiApplication))
          setApplicationError(applicationErrorMessage(error, 'Unable to load applications.'))
        }
      } finally {
        if (!cancelled) setApplicationsLoaded(true)
      }
    }
    void loadApplications()
    return () => { cancelled = true }
  }, [authUser])

  useEffect(() => {
    if (!authUser) return
    let cancelled = false
    async function loadDocuments() {
      try {
        const response = await apiFetch<DocumentListResponse>('/documents')
        if (!cancelled) setDocuments(response.items.map(fromApiDocument))
      } catch (error) {
        if (!cancelled) setDocumentError(applicationErrorMessage(error, 'Unable to load documents.'))
      } finally {
        if (!cancelled) setDocumentsLoaded(true)
      }
    }
    void loadDocuments()
    return () => { cancelled = true }
  }, [authUser])

  useEffect(() => {
    if (!authUser) return
    void refreshAnalytics()
  }, [authUser])

  const visibleDocuments = useMemo(() => documents.filter((document) => document.kind === documentTab), [documents, documentTab])
  const documentsLoading = Boolean(authUser) && !documentsLoaded
  const resumeOptions = useMemo(() => documents.filter((document) => document.kind === 'RESUME'), [documents])
  const coverLetterOptions = useMemo(() => documents.filter((document) => document.kind === 'COVER_LETTER'), [documents])
  const analyticsLoading = Boolean(authUser) && !analyticsLoaded

  async function refreshAnalytics() {
    try {
      const summary = await apiFetch<AnalyticsSummary>('/analytics')
      setAnalytics(summary)
    } catch {
      // analytics is a secondary read; surface silently and let the user retry via reload
    } finally {
      setAnalyticsLoaded(true)
    }
  }

  function resetUploadForm() {
    setUploadLabel('')
    setUploadVersion('')
    setUploadFile(null)
  }

  async function uploadDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!uploadFile) {
      setDocumentError('Choose a file to upload.')
      return
    }
    const label = uploadLabel.trim()
    if (!label) {
      setDocumentError('Give the document a label so you can find it later.')
      return
    }
    setDocumentUploading(true)
    setDocumentError('')
    try {
      const form = new FormData()
      form.append('file', uploadFile)
      form.append('kind', documentTab)
      form.append('label', label)
      if (uploadVersion.trim()) form.append('version', uploadVersion.trim())
      const saved = await apiFetch<ApiDocument>('/documents', { method: 'POST', body: form })
      const document = fromApiDocument(saved)
      setDocuments((current) => [document, ...current])
      resetUploadForm()
      setNotice(`${documentKindLabel(documentTab)} uploaded`)
    } catch (error) {
      setDocumentError(applicationErrorMessage(error, 'Unable to upload document.'))
    } finally {
      setDocumentUploading(false)
    }
  }

  async function handleDownloadDocument(item: AppDocument) {
    setDocumentError('')
    setDocumentBusyId(item.id)
    try {
      const blob = await downloadDocument(item.id)
      const url = URL.createObjectURL(blob)
      const anchor = window.document.createElement('a')
      anchor.href = url
      anchor.download = item.originalFileName || item.label
      window.document.body.appendChild(anchor)
      anchor.click()
      window.document.body.removeChild(anchor)
      URL.revokeObjectURL(url)
    } catch (error) {
      setDocumentError(applicationErrorMessage(error, 'Unable to download document.'))
    } finally {
      setDocumentBusyId(null)
    }
  }

  function beginRenameDocument(document: AppDocument) {
    setRenamingDocumentId(document.id)
    setRenameValue(document.label)
    setDocumentError('')
  }

  function cancelRenameDocument() {
    setRenamingDocumentId(null)
    setRenameValue('')
  }

  async function submitRenameDocument(documentId: string) {
    const label = renameValue.trim()
    if (!label) {
      setDocumentError('Label cannot be empty.')
      return
    }
    setDocumentBusyId(documentId)
    setDocumentError('')
    try {
      const saved = await apiFetch<ApiDocument>(`/documents/${documentId}`, { method: 'PATCH', body: JSON.stringify({ label }) })
      const updated = fromApiDocument(saved)
      setDocuments((current) => current.map((document) => document.id === documentId ? updated : document))
      setApplications((current) => current.map((application) => ({
        ...application,
        resume: application.resume?.id === documentId ? { id: updated.id, label: updated.label } : application.resume,
        coverLetter: application.coverLetter?.id === documentId ? { id: updated.id, label: updated.label } : application.coverLetter,
      })))
      cancelRenameDocument()
      setNotice('Document renamed')
    } catch (error) {
      setDocumentError(applicationErrorMessage(error, 'Unable to rename document.'))
    } finally {
      setDocumentBusyId(null)
    }
  }

  async function confirmDocumentDelete() {
    if (!documentDeleteTarget) return
    const documentId = documentDeleteTarget.id
    setDocumentBusyId(documentId)
    setDocumentError('')
    try {
      await apiFetch<null>(`/documents/${documentId}`, { method: 'DELETE' })
      setDocuments((current) => current.filter((document) => document.id !== documentId))
      setApplications((current) => current.map((application) => ({
        ...application,
        resumeId: application.resumeId === documentId ? null : application.resumeId,
        coverLetterId: application.coverLetterId === documentId ? null : application.coverLetterId,
        resume: application.resume?.id === documentId ? null : application.resume,
        coverLetter: application.coverLetter?.id === documentId ? null : application.coverLetter,
      })))
      setDocumentDeleteTarget(null)
      setNotice('Document deleted')
    } catch (error) {
      setDocumentError(applicationErrorMessage(error, 'Unable to delete document.'))
    } finally {
      setDocumentBusyId(null)
    }
  }

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const creatingAccount = authMode === 'register'
    setAuthBusy(true)
    setAuthError('')
    try {
      const user = await authenticate(authMode, {
        email: authFields.email.trim(),
        password: authFields.password,
        ...(authMode === 'register' && authFields.displayName.trim() ? { displayName: authFields.displayName.trim() } : {}),
      })
      if (creatingAccount) {
        rememberEmail(user.email)
        setSavedEmails(getSavedEmails())
        const browserSaveRequested = await askBrowserToSavePassword(user, authFields.password)
        setAuthMode('login')
        setAuthSuccess(browserSaveRequested
          ? `Account created for ${user.email}. Your browser was asked to save this password. Sign in below.`
          : `Account created for ${user.email}. Sign in below; your password is still filled in.`)
        return
      }
      rememberEmail(user.email)
      setSavedEmails(getSavedEmails())
      setApplicationsLoaded(false)
      setApplicationError('')
      setDocuments([])
      setDocumentsLoaded(false)
      setDocumentError('')
      resetUploadForm()
      setDocumentTab('RESUME')
      setAnalytics(null)
      setAnalyticsLoaded(false)
      setAnalyses([])
      setAnalysesLoaded(false)
      setAnalysisError('')
      setQuestionSets([])
      setQuestionsLoaded(false)
      setQuestionsError('')
      setModalTab('details')
      setAuthUser(user)
      setApplications([])
      setNotice('')
    } catch (error) {
      setAuthError(error instanceof ApiError ? error.message : 'Unable to authenticate. Please try again.')
    } finally {
      setAuthBusy(false)
    }
  }

  function suggestStrongPassword() {
    const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*?'
    const randomValues = crypto.getRandomValues(new Uint32Array(20))
    const password = Array.from(randomValues, (value) => characters[value % characters.length]).join('')
    setAuthFields((current) => ({ ...current, password }))
  }

  function openDisplayNameModal() {
    setDisplayNameDraft(authUser?.displayName ?? '')
    setDisplayNameError('')
    setDisplayNameModalOpen(true)
  }

  async function submitDisplayName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setDisplayNameSaving(true)
    setDisplayNameError('')
    try {
      const trimmed = displayNameDraft.trim()
      const updated = await apiFetch<AuthUser>('/auth/me', {
        method: 'PATCH',
        body: JSON.stringify({ displayName: trimmed || null }),
      })
      setAuthUser(updated)
      setDisplayNameModalOpen(false)
      setNotice('Display name updated')
    } catch (error) {
      setDisplayNameError(applicationErrorMessage(error, 'Unable to update display name.'))
    } finally {
      setDisplayNameSaving(false)
    }
  }

  function openPasswordModal() {
    setPasswordFields({ current: '', next: '', confirm: '' })
    setPasswordError('')
    setPasswordModalOpen(true)
  }

  async function submitPasswordChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (passwordFields.next !== passwordFields.confirm) {
      setPasswordError('New password and confirmation do not match.')
      return
    }
    if (passwordFields.next.length < 8) {
      setPasswordError('New password must be at least 8 characters.')
      return
    }
    setPasswordSaving(true)
    setPasswordError('')
    try {
      await apiFetch<null>('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: passwordFields.current,
          newPassword: passwordFields.next,
        }),
      })
      setPasswordModalOpen(false)
      setPasswordFields({ current: '', next: '', confirm: '' })
      setNotice('Password updated')
    } catch (error) {
      setPasswordError(applicationErrorMessage(error, 'Unable to change password.'))
    } finally {
      setPasswordSaving(false)
    }
  }

  function signOut() {
    clearSession()
    setAuthUser(null)
    setAuthFields({ email: '', password: '', displayName: '' })
    setAuthMode('login')
    setAuthError('')
    setAuthSuccess('')
    setPasswordOptionsOpen(false)
    setApplications([])
    setApplicationsLoaded(false)
    setDocuments([])
    setDocumentsLoaded(false)
    setDocumentError('')
    setDocumentTab('RESUME')
    resetUploadForm()
    setRenamingDocumentId(null)
    setRenameValue('')
    setDocumentDeleteTarget(null)
    setAnalytics(null)
    setAnalyticsLoaded(false)
    setAnalyses([])
    setAnalysesLoaded(false)
    setAnalysisError('')
    setQuestionSets([])
    setQuestionsLoaded(false)
    setQuestionsError('')
    setModalTab('details')
    setView('overview')
    setNotice('')
  }

  if (authLoading) {
    return <main className="auth-loading"><span className="auth-loading-mark"><BriefcaseBusiness size={20} /></span><span>Checking your session…</span></main>
  }

  if (!authUser) {
    return (
      <main className="auth-screen">
        <section className="auth-brand-panel">
          <a className="auth-brand" href="#signin"><span className="auth-brand-mark"><BriefcaseBusiness size={19} /></span><span>fieldnote<small>JOB SEARCH, IN FOCUS</small></span></a>
          <div className="auth-message"><span className="auth-kicker">A CLEARER WAY FORWARD</span><h1>Keep your<br />next move<br /><em>in view.</em></h1><p>Every application, conversation, and possibility, gathered in one thoughtful place.</p></div>
          <div className="auth-trust"><ShieldCheck size={16} /><span>Your job search stays private to your account.</span></div>
          <span className="auth-orbit orbit-one" /><span className="auth-orbit orbit-two" />
        </section>
        <section className="auth-form-panel">
          <div className="auth-mobile-brand"><span className="auth-brand-mark"><BriefcaseBusiness size={18} /></span><span>fieldnote</span></div>
          <div className="auth-form-wrap">
            <span className="auth-kicker">{authMode === 'login' ? 'WELCOME BACK' : 'GET STARTED'}</span>
            <h2>{authMode === 'login' ? 'Sign in to Fieldnote' : 'Create your account'}</h2>
            <p className="auth-intro">{authMode === 'login' ? 'Pick up where your job search left off.' : 'A focused home for everything in your job search.'}</p>
            <div className="auth-switch" role="tablist" aria-label="Authentication mode">
              <button type="button" className={authMode === 'login' ? 'selected' : ''} role="tab" aria-selected={authMode === 'login'} onClick={() => { setAuthMode('login'); setAuthError(''); setAuthSuccess(''); setPasswordOptionsOpen(false) }}>Sign in</button>
              <button type="button" className={authMode === 'register' ? 'selected' : ''} role="tab" aria-selected={authMode === 'register'} onClick={() => { setAuthMode('register'); setAuthError(''); setAuthSuccess(''); setPasswordOptionsOpen(false) }}>Create account</button>
            </div>
            {authError && <div className="auth-error" role="alert">{authError}</div>}
            {authSuccess && <div className="auth-success" role="status">{authSuccess}</div>}
            <form className="auth-form" onSubmit={submitAuth}>
              {authMode === 'register' && <label className="auth-field"><span>Your name <small>Optional</small></span><input autoComplete="name" maxLength={100} value={authFields.displayName} onChange={(event) => setAuthFields({ ...authFields, displayName: event.target.value })} placeholder="How should we address you?" /></label>}
              <label className="auth-field"><span>Email address</span><input type="email" required autoComplete="username" list={authMode === 'login' && savedEmails.length ? 'saved-account-emails' : undefined} value={authFields.email} onChange={(event) => setAuthFields({ ...authFields, email: event.target.value })} placeholder="you@example.com" />{authMode === 'login' && savedEmails.length > 0 && <datalist id="saved-account-emails">{savedEmails.map((email) => <option key={email} value={email} />)}</datalist>}</label>
              <div className="password-entry" onBlur={(event) => { if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setPasswordOptionsOpen(false) }}>
                <label className="auth-field"><span>Password{authMode === 'register' && <small>At least 8 characters</small>}</span><input type="password" required minLength={8} autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} value={authFields.password} onFocus={() => { if (authMode === 'register') setPasswordOptionsOpen(true) }} onChange={(event) => setAuthFields({ ...authFields, password: event.target.value })} placeholder="Enter your password" />{authMode === 'register' && passwordOptionsOpen && <span className="password-guidance">Choose your own, use Chrome’s suggested password, or generate one here.</span>}</label>
                {authMode === 'register' && passwordOptionsOpen && <button className="password-suggest" type="button" onClick={suggestStrongPassword}><KeyRound size={14} />Suggest a strong password</button>}
              </div>
              <button className="auth-submit" type="submit" disabled={authBusy}>{authBusy ? 'Please wait…' : authMode === 'login' ? 'Sign in' : 'Create account'}<ArrowUpRight size={16} /></button>
            </form>
            <p className="auth-footnote">By continuing, your application data will be stored securely in your account.</p>
          </div>
          <span className="auth-copyright">FIELDNOTE · YOUR SEARCH, ORGANIZED</span>
        </section>
      </main>
    )
  }

  function resetAiState() {
    setAnalyses([])
    setAnalysesLoaded(false)
    setAnalysisError('')
    setQuestionSets([])
    setQuestionsLoaded(false)
    setQuestionsError('')
  }

  function openCreateForm() {
    setEditing(null)
    setApplicationError('')
    setDraft({ ...emptyDraft, dateApplied: new Date().toISOString().slice(0, 10) })
    setModalTab('details')
    resetAiState()
    setFormOpen(true)
  }

  function openEditForm(application: Application) {
    setEditing(application)
    setApplicationError('')
    setDraft({ ...application })
    setModalTab('details')
    resetAiState()
    setFormOpen(true)
    void loadAiForApplication(application.id)
  }

  async function loadAiForApplication(applicationId: string) {
    try {
      const [analysisResponse, questionResponse] = await Promise.all([
        apiFetch<AnalysisListResponse>(`/applications/${applicationId}/analyses`),
        apiFetch<InterviewQuestionListResponse>(`/applications/${applicationId}/interview-questions`),
      ])
      setAnalyses(analysisResponse.items)
      setQuestionSets(questionResponse.items)
    } catch (error) {
      const message = applicationErrorMessage(error, 'Unable to load AI history.')
      setAnalysisError(message)
      setQuestionsError(message)
    } finally {
      setAnalysesLoaded(true)
      setQuestionsLoaded(true)
    }
  }

  async function runAnalysis() {
    if (!editing) return
    setAnalysisRunning(true)
    setAnalysisError('')
    try {
      const analysis = await apiFetch<Analysis>(`/applications/${editing.id}/analyze`, { method: 'POST' })
      setAnalyses((current) => [analysis, ...current])
      setNotice('Analysis complete')
    } catch (error) {
      setAnalysisError(applicationErrorMessage(error, 'Unable to run analysis.'))
    } finally {
      setAnalysisRunning(false)
    }
  }

  async function generateInterviewQuestions() {
    if (!editing) return
    setQuestionsRunning(true)
    setQuestionsError('')
    try {
      const set = await apiFetch<InterviewQuestionSet>(`/applications/${editing.id}/interview-questions`, { method: 'POST' })
      setQuestionSets((current) => [set, ...current])
      setNotice('Interview questions generated')
    } catch (error) {
      setQuestionsError(applicationErrorMessage(error, 'Unable to generate questions.'))
    } finally {
      setQuestionsRunning(false)
    }
  }

  async function saveApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setApplicationSaving(true)
    setApplicationError('')
    const dateApplied = draft.dateApplied ? new Date(`${draft.dateApplied}T00:00:00.000Z`).toISOString() : null
    try {
      const basePayload = {
        company: draft.company.trim(),
        jobTitle: draft.jobTitle.trim(),
        jobDescription: draft.jobDescription.trim(),
        status: draft.status,
      }
      const payload = editing
        ? {
            ...basePayload,
            location: draft.location.trim() || null,
            salary: draft.salary.trim() || null,
            url: draft.url.trim() || null,
            dateApplied,
            notes: draft.notes.trim() || null,
            resumeId: draft.resumeId ?? null,
            coverLetterId: draft.coverLetterId ?? null,
          }
        : {
            ...basePayload,
            ...(draft.location.trim() ? { location: draft.location.trim() } : {}),
            ...(draft.salary.trim() ? { salary: draft.salary.trim() } : {}),
            ...(draft.url.trim() ? { url: draft.url.trim() } : {}),
            ...(dateApplied ? { dateApplied } : {}),
            ...(draft.notes.trim() ? { notes: draft.notes.trim() } : {}),
            ...(draft.resumeId ? { resumeId: draft.resumeId } : {}),
            ...(draft.coverLetterId ? { coverLetterId: draft.coverLetterId } : {}),
          }
      const saved = editing
        ? await apiFetch<ApiApplication>(`/applications/${editing.id}`, { method: 'PATCH', body: JSON.stringify(payload) })
        : await apiFetch<ApiApplication>('/applications', { method: 'POST', body: JSON.stringify(payload) })
      const application = fromApiApplication(saved)
      if (editing) {
        setApplications((current) => current.map((item) => item.id === editing.id ? application : item))
        setNotice('Application updated')
      } else {
        setApplications((current) => [application, ...current])
        setNotice('Application added')
      }
      setFormOpen(false)
      void refreshAnalytics()
    } catch (error) {
      setApplicationError(applicationErrorMessage(error, 'Unable to save application.'))
    } finally {
      setApplicationSaving(false)
    }
  }

  function celebrateOffer() {
    const duration = 1200
    const end = Date.now() + duration
    ;(function frame() {
      confetti({ particleCount: 4, angle: 60, spread: 55, origin: { x: 0 } })
      confetti({ particleCount: 4, angle: 120, spread: 55, origin: { x: 1 } })
      if (Date.now() < end) requestAnimationFrame(frame)
    })()
  }

  async function updateStatus(id: string, status: Status) {
    setApplicationError('')
    // Withdrawing an application removes it from the tracker entirely.
    if (status === 'WITHDRAWN') {
      try {
        await apiFetch<{ deleted: boolean }>(`/applications/${id}`, { method: 'DELETE' })
        setApplications((current) => current.filter((item) => item.id !== id))
        setNotice('Application withdrawn and removed')
        void refreshAnalytics()
      } catch (error) {
        setApplicationError(applicationErrorMessage(error, 'Unable to withdraw application.'))
      }
      return
    }
    try {
      const updated = await apiFetch<ApiApplication>(`/applications/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      })
      const application = fromApiApplication(updated)
      setApplications((current) => current.map((item) => item.id === id ? application : item))
      setNotice('Status updated')
      if (status === 'OFFER') celebrateOffer()
      void refreshAnalytics()
    } catch (error) {
      setApplicationError(applicationErrorMessage(error, 'Unable to update status.'))
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setApplicationError('')
    try {
      await apiFetch<{ deleted: boolean }>(`/applications/${deleteTarget.id}`, { method: 'DELETE' })
      setApplications((current) => current.filter((application) => application.id !== deleteTarget.id))
      setNotice('Application deleted')
      setDeleteTarget(null)
      void refreshAnalytics()
    } catch (error) {
      setApplicationError(applicationErrorMessage(error, 'Unable to delete application.'))
    }
  }

  return (
    <div className="app-frame">
      <aside className="sidebar">
        <a className="brand" href="#dashboard" onClick={(event) => { event.preventDefault(); setView('overview') }}>
          <span className="brand-symbol"><BriefcaseBusiness size={17} strokeWidth={2.2} /></span>
          <span>fieldnote<small>JOB SEARCH, IN FOCUS</small></span>
        </a>
        <button className="sidebar-add-button" onClick={openCreateForm}><Plus size={15} />Add application</button>
        <div className="workspace-label">YOUR WORKSPACE</div>
        <nav className="primary-nav" aria-label="Main navigation">
          <button className={view === 'overview' ? 'nav-link active' : 'nav-link'} onClick={() => setView('overview')}><LayoutDashboard size={17} />Dashboard</button>
          <button className={view === 'board' ? 'nav-link active' : 'nav-link'} onClick={() => setView('board')}><LayoutDashboard size={17} />Board</button>
          <button className={view === 'applications' ? 'nav-link active' : 'nav-link'} onClick={() => setView('applications')}><BriefcaseBusiness size={17} />Applications<span className="nav-count">{applications.length}</span></button>
          <button className={view === 'documents' ? 'nav-link active' : 'nav-link'} onClick={() => setView('documents')}><FileText size={17} />Documents<span className="nav-count">{documents.length}</span></button>
          <button className={view === 'stats' ? 'nav-link active' : 'nav-link'} onClick={() => setView('stats')}><Sparkles size={17} />Stats</button>
        </nav>
        <div className="sidebar-bottom">
          <button className="nav-link muted-link" onClick={() => setView('settings')}><Settings2 size={17} />Settings</button>
          <button className="nav-link muted-link" onClick={() => setNotice('Help will be available in a later milestone.')}><CircleHelp size={17} />Help</button>
          <div
            className="account-anchor sidebar-account"
            onBlur={(event) => { if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setAccountMenu((current) => current === 'sidebar' ? null : current) }}
          >
            <button
              className="user-chip"
              aria-haspopup="menu"
              aria-expanded={accountMenu === 'sidebar'}
              onClick={() => setAccountMenu((current) => current === 'sidebar' ? null : 'sidebar')}
            >
              <span className="avatar">{(authUser.displayName || authUser.email).slice(0, 1).toUpperCase()}</span>
              <span><strong>{authUser.displayName || authUser.email}</strong><small>{authUser.email}</small></span>
              <ChevronDown size={14} aria-hidden="true" />
            </button>
            {accountMenu === 'sidebar' && (
              <div className="account-menu-panel account-menu-panel-up" role="menu">
                <div className="account-menu-heading">
                  <span className="avatar avatar-sm">{(authUser.displayName || authUser.email).slice(0, 1).toUpperCase()}</span>
                  <div><strong>{authUser.displayName || 'No display name'}</strong><small>{authUser.email}</small></div>
                </div>
                <button role="menuitem" className="account-menu-item" onClick={() => { setAccountMenu(null); setView('profile') }}><UserRound size={14} />View profile</button>
                <button role="menuitem" className="account-menu-item" onClick={() => { setAccountMenu(null); setView('settings') }}><Settings2 size={14} />Settings</button>
                <div className="account-menu-divider" />
                <button role="menuitem" className="account-menu-item danger" onClick={() => { setAccountMenu(null); signOut() }}><LogOut size={14} />Sign out</button>
              </div>
            )}
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb"><span>Workspace</span><span className="crumb-separator">/</span><strong>{view === 'overview' ? 'Dashboard' : view === 'board' ? 'Board' : view === 'stats' ? 'Stats' : view === 'documents' ? 'Documents' : view === 'profile' ? 'Profile' : view === 'settings' ? 'Settings' : 'Applications'}</strong></div>
          <div className="topbar-actions">
            <span className="today-label"><CalendarDays size={14} />{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</span>
            <button className="help-button" aria-label="Help" title="Help"><CircleHelp size={18} /></button>
            <div
              className="account-anchor topbar-account"
              onBlur={(event) => { if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setAccountMenu((current) => current === 'topbar' ? null : current) }}
            >
              <button
                className="account-menu"
                aria-haspopup="menu"
                aria-expanded={accountMenu === 'topbar'}
                onClick={() => setAccountMenu((current) => current === 'topbar' ? null : 'topbar')}
              >
                <span className="top-avatar">{(authUser.displayName || authUser.email).slice(0, 1).toUpperCase()}</span>
                <span>{authUser.displayName || authUser.email}</span>
                <ChevronDown size={14} aria-hidden="true" />
              </button>
              {accountMenu === 'topbar' && (
                <div className="account-menu-panel account-menu-panel-down" role="menu">
                  <div className="account-menu-heading">
                    <span className="avatar avatar-sm">{(authUser.displayName || authUser.email).slice(0, 1).toUpperCase()}</span>
                    <div><strong>{authUser.displayName || 'No display name'}</strong><small>{authUser.email}</small></div>
                  </div>
                  <button role="menuitem" className="account-menu-item" onClick={() => { setAccountMenu(null); setView('profile') }}><UserRound size={14} />View profile</button>
                  <button role="menuitem" className="account-menu-item" onClick={() => { setAccountMenu(null); setView('settings') }}><Settings2 size={14} />Settings</button>
                  <div className="account-menu-divider" />
                  <button role="menuitem" className="account-menu-item danger" onClick={() => { setAccountMenu(null); signOut() }}><LogOut size={14} />Sign out</button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="page-content">
          {notice && <div className="notice" role="status"><Check size={15} />{notice}<button aria-label="Dismiss notification" onClick={() => setNotice('')}><X size={14} /></button></div>}
          {applicationError && !formOpen && <div className="api-error-banner" role="alert">{applicationError}<button aria-label="Dismiss error" onClick={() => setApplicationError('')}><X size={14} /></button></div>}
          {applicationsLoading && <div className="api-loading-banner" role="status">Loading your saved applications…</div>}

          {view === 'overview' ? (
            <>
              <section className="page-heading dashboard-heading">
                <div><div className="eyebrow">JOB APPLICATION TRACKER</div><h1>Dashboard</h1><p>Your job search at a glance.</p></div>
                <div className="heading-actions"><button className="secondary-button" onClick={() => setView('board')}>Open board</button><button className="primary-button" onClick={openCreateForm}><Plus size={16} />Add application</button></div>
              </section>

              <section className="dashboard-hero" aria-label="Applications in play">
                <div className="hero-summary"><span className="hero-label">APPLICATIONS IN PLAY</span><strong>{activeApplications.length}</strong><p>{activeApplications.length} applications awaiting an outcome · {applications.filter((application) => application.status === 'SAVED').length} saved to apply to</p></div>
                <div className="hero-breakdown">
                  <div><strong>{sentApplications.length}</strong><span>APPLIED</span></div>
                  <div><strong>{repliedApplications.length}</strong><span>REPLIED</span></div>
                  <div><strong>{interviews}</strong><span>INTERVIEWING</span></div>
                  <div><strong>{offers}</strong><span>OFFER</span></div>
                </div>
              </section>

              <section className="metric-grid dashboard-kpis" aria-label="Application metrics">
                <button className="metric-panel kpi-response" onClick={() => setView('stats')}><span className="kpi-icon"><ArrowUpRight size={15} /></span><span className="kpi-label">Response rate</span><strong>{responseRate}%</strong><small>{averageResponseDays != null ? `Avg ${averageResponseDays.toFixed(1)} days to first response` : 'Recruiter replies from applied roles'}</small></button>
                <button className="metric-panel kpi-interviews" onClick={() => { setStatusFilter('INTERVIEW'); setView('applications') }}><span className="kpi-icon"><CalendarDays size={15} /></span><span className="kpi-label">Interviews</span><strong>{interviews}</strong><small>in progress</small></button>
                <button className="metric-panel kpi-offers" onClick={() => { setStatusFilter('OFFER'); setView('applications') }}><span className="kpi-icon"><Check size={15} /></span><span className="kpi-label">Offers</span><strong>{offers}</strong><small>on the table</small></button>
                <button className="metric-panel kpi-chasing" onClick={() => { setStatusFilter('APPLIED'); setView('applications') }}><span className="kpi-icon"><CalendarDays size={15} /></span><span className="kpi-label">Needs chasing</span><strong>{needsChasing}</strong><small>follow-ups due</small></button>
              </section>

              <section className="dashboard-panels">
                <article className="panel dashboard-widget funnel-widget">
                  <div className="widget-heading"><div><h2>Response funnel</h2><p>How far your applications get.</p></div><strong>{responseRate}%</strong></div>
                  {[
                    { label: 'Applied', count: sentApplications.length },
                    { label: 'Reached interview', count: applications.filter((application) => ['INTERVIEW', 'OFFER'].includes(application.status)).length },
                    { label: 'Reached offer', count: offers },
                  ].map((step) => <div className="funnel-step" key={step.label}><div><span>{step.label}</span><strong>{step.count}</strong></div><span className="funnel-track"><span style={{ width: `${sentApplications.length ? (step.count / sentApplications.length) * 100 : 0}%` }} /></span></div>)}
                  <div className="widget-footnote">Of {sentApplications.length} applications sent, {repliedApplications.length} received a response.</div>
                </article>

                <article className="panel dashboard-widget upcoming-widget">
                  <div className="widget-heading"><div><h2>Needs follow-up</h2><p>Applied over a week ago and still waiting.</p></div><span className="week-label">7+ DAYS</span></div>
                  {(() => {
                    const now = Date.now()
                    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000
                    const followUps = applications
                      .filter((application) => application.status === 'APPLIED' && application.dateApplied && (now - new Date(`${application.dateApplied}T12:00:00`).getTime()) >= sevenDaysMs)
                      .sort((a, b) => new Date(a.dateApplied).getTime() - new Date(b.dateApplied).getTime())
                      .slice(0, 4)
                    if (followUps.length === 0) {
                      return <div className="upcoming-empty">Nothing to chase right now — every recent application is fresh.</div>
                    }
                    return followUps.map((application) => {
                      const daysAgo = Math.floor((now - new Date(`${application.dateApplied}T12:00:00`).getTime()) / (24 * 60 * 60 * 1000))
                      return (
                        <button className="upcoming-row upcoming-row-button" key={application.id} onClick={() => openEditForm(application)}>
                          <span className="calendar-tile"><CalendarDays size={14} /></span>
                          <span className="upcoming-copy"><strong>{application.company}</strong><small>{application.jobTitle} · Applied {daysAgo}d ago</small></span>
                          <span className="upcoming-status">Follow up</span>
                        </button>
                      )
                    })
                  })()}
                  <button className="widget-link" onClick={() => { setStatusFilter('APPLIED'); setView('applications') }}>View all applied <ArrowUpRight size={13} /></button>
                </article>

                <article className="panel dashboard-widget source-widget">
                  <div className="widget-heading"><div><h2>Where roles come from</h2><p>Channels your applications came from.</p></div></div>
                  {sourceCounts.map(({ source, count }) => <button className="source-row" key={source} onClick={() => setView('applications')}><span>{source === 'MANUAL' ? 'Manual entry' : 'Browser extension'}</span><span className="source-track"><span style={{ width: `${count ? Math.max(10, (count / maxSourceCount) * 100) : 0}%` }} /></span><strong>{count}</strong></button>)}
                  <div className="widget-footnote">Source breakdown from your current applications.</div>
                </article>
              </section>
              <footer className="page-footer"><span>FIELDNOTE <span className="footer-dot">·</span> YOUR SEARCH, ORGANIZED</span><button onClick={() => setNotice('Your data is currently saved for this session only. API connection is the next step.')}><FileText size={13} /> Data status</button></footer>
            </>
          ) : view === 'board' ? (
            <>
              <section className="page-heading"><div><div className="eyebrow">YOUR PIPELINE</div><h1>Board</h1><p>Applications grouped by their current stage.</p></div><button className="primary-button" onClick={openCreateForm}><Plus size={16} />Add application</button></section>
              <section className="board-grid" aria-label="Applications by status">
                {statuses.map((status) => {
                  const stageApplications = applications.filter((application) => application.status === status)
                  return <section className="board-column" key={status}><div className="board-column-heading"><span className={`pipeline-dot status-${status.toLowerCase()}`} /><strong>{statusLabels[status]}</strong><span>{stageApplications.length}</span></div>{stageApplications.length ? stageApplications.map((application) => <button className="board-card" key={application.id} onClick={() => openEditForm(application)}><strong>{application.jobTitle}</strong><span>{application.company}</span><small><CalendarDays size={12} />{formatDate(application.dateApplied)}</small></button>) : <div className="board-empty">No applications</div>}</section>
                })}
              </section>
            </>
          ) : view === 'stats' ? (
            <>
              <section className="page-heading"><div><div className="eyebrow">YOUR JOB SEARCH</div><h1>Stats</h1><p>A clear read on your search so far.</p></div><button className="secondary-button" onClick={() => setView('overview')}>Back to dashboard</button></section>
              <section className="stats-layout">
                <article className="panel stats-panel">
                  <div className="widget-heading"><div><h2>Applications by status</h2><p>Current stage across your pipeline.</p></div></div>
                  {analyticsLoading ? <div className="api-loading-table">Loading analytics…</div> : statusCounts.map(({ status, count }) => <button className="stats-status-row" key={status} onClick={() => { setStatusFilter(status); setView('applications') }}><span className={`pipeline-dot status-${status.toLowerCase()}`} /><span>{statusLabels[status]}</span><span className="stats-track"><span style={{ width: `${count ? Math.max(8, (count / maxStatusCount) * 100) : 0}%` }} /></span><strong>{count}</strong></button>)}
                </article>
                <article className="panel response-summary">
                  <div className="eyebrow">RESPONSE RATE</div>
                  <strong>{responseRate}%</strong>
                  <p>{analytics?.responseRate != null ? 'Of applications that reached "Applied", this share received a recruiter reply.' : 'Sign in and add applications to see your response rate.'}</p>
                  <div className="stats-secondary">
                    <div><span>Interview conversion</span><strong>{interviewConversionRate != null ? `${Math.round(interviewConversionRate * 100)}%` : '—'}</strong></div>
                    <div><span>Avg days to first reply</span><strong>{averageResponseDays != null ? averageResponseDays.toFixed(1) : '—'}</strong></div>
                  </div>
                  <button className="widget-link" onClick={() => setView('applications')}>Review applications <ArrowUpRight size={13} /></button>
                </article>
              </section>
              <section className="panel activity-panel">
                <div className="widget-heading"><div><h2>Recent applications</h2><p>Your latest 20 applications by stage · trend line tracks interview-reach rate over time.</p></div></div>
                {applicationsLoading ? (
                  <div className="api-loading-table">Loading applications…</div>
                ) : applications.length === 0 ? (
                  <div className="empty-state"><CalendarDays size={22} /><strong>No applications yet</strong><span>Add applications to see their status distribution over time.</span></div>
                ) : (
                  (() => {
                    const stageForStatus: Record<Status, number> = {
                      SAVED: 0,
                      APPLIED: 1,
                      RECRUITER_SCREEN: 2,
                      INTERVIEW: 3,
                      OFFER: 4,
                      REJECTED: 5,
                      WITHDRAWN: 5,
                    }
                    const stageLabels = ['Saved', 'Applied', 'Screen', 'Interview', 'Offer', 'Rejected']
                    const recent = applications
                      .slice()
                      .sort((a, b) => new Date(b.dateApplied).getTime() - new Date(a.dateApplied).getTime())
                      .slice(0, 20)
                      .reverse()
                    const dates = recent.map((application) => new Date(application.dateApplied).getTime())
                    const minDate = Math.min(...dates)
                    const maxDate = Math.max(...dates)
                    const dateRange = Math.max(1, maxDate - minDate)
                    const width = 720
                    const height = 260
                    const padLeft = 70
                    const padRight = 14
                    const padTop = 14
                    const padBottom = 34
                    const innerWidth = width - padLeft - padRight
                    const innerHeight = height - padTop - padBottom
                    const xOf = (ts: number) => padLeft + ((ts - minDate) / dateRange) * innerWidth
                    const yOf = (stage: number) => padTop + innerHeight - (stage / (stageLabels.length - 1)) * innerHeight
                    const tickCount = Math.min(6, recent.length)
                    const dateTicks = Array.from({ length: tickCount }, (_, i) => minDate + ((maxDate - minDate) * i) / Math.max(1, tickCount - 1))
                    return (
                      <div className="activity-chart">
                        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Recent applications scatter plot" preserveAspectRatio="none">
                          {stageLabels.map((label, stage) => {
                            const y = yOf(stage)
                            return (
                              <g key={label + '-' + stage}>
                                <line x1={padLeft} y1={y} x2={width - padRight} y2={y} className="activity-grid" />
                                <text x={padLeft - 8} y={y + 3} className="activity-axis-label" textAnchor="end">{label}</text>
                              </g>
                            )
                          })}
                          {dateTicks.map((ts, i) => {
                            const label = new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                            return (
                              <text key={ts + '-' + i} x={xOf(ts)} y={height - padBottom + 18} className="activity-axis-label" textAnchor="middle">{label}</text>
                            )
                          })}
                          {recent.length > 1 && (() => {
                            // Least-squares regression of interview-reached rate over time.
                            // Each application scores 1 if it reached INTERVIEW/OFFER, else 0.
                            // The trend line then shows whether recent apps are more likely
                            // than older ones to advance to an interview.
                            const xs = recent.map((application) => new Date(application.dateApplied).getTime())
                            const ys: number[] = recent.map((application) => (application.status === 'INTERVIEW' || application.status === 'OFFER' ? 1 : 0))
                            const meanX = xs.reduce((a, b) => a + b, 0) / xs.length
                            const meanY = ys.reduce((a, b) => a + b, 0) / ys.length
                            let numerator = 0
                            let denominator = 0
                            for (let i = 0; i < xs.length; i++) {
                              numerator += (xs[i] - meanX) * (ys[i] - meanY)
                              denominator += (xs[i] - meanX) ** 2
                            }
                            const slope = denominator === 0 ? 0 : numerator / denominator
                            const intercept = meanY - slope * meanX
                            // Map the 0-1 rate to the visual band between "Applied" (stage 1)
                            // at rate 0 and "Interview" (stage 3) at rate 1, so the trend
                            // line lands on stages the user is trying to reach.
                            const rateToY = (rate: number) => yOf(1 + Math.max(0, Math.min(1, rate)) * 2)
                            const y1 = rateToY(slope * minDate + intercept)
                            const y2 = rateToY(slope * maxDate + intercept)
                            const interviewCount = ys.reduce((a, b) => a + b, 0)
                            return (
                              <>
                                <line
                                  className="activity-trend-line"
                                  x1={xOf(minDate)}
                                  y1={y1}
                                  x2={xOf(maxDate)}
                                  y2={y2}
                                />
                                <text x={width - padRight} y={padTop + 4} className="activity-trend-label" textAnchor="end">
                                  Interview rate: {interviewCount}/{recent.length} ({Math.round((interviewCount / recent.length) * 100)}%)
                                </text>
                              </>
                            )
                          })()}
                          {recent.map((application) => {
                            const stage = stageForStatus[application.status]
                            const ts = new Date(application.dateApplied).getTime()
                            return (
                              <g key={application.id}>
                                <circle cx={xOf(ts)} cy={yOf(stage)} r={6} className={`activity-scatter-point status-scatter-${application.status.toLowerCase()}`} />
                                <title>{application.jobTitle} · {application.company} — {statusLabels[application.status]} ({new Date(application.dateApplied).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })})</title>
                              </g>
                            )
                          })}
                        </svg>
                      </div>
                    )
                  })()
                )}
                <div className="activity-legend">
                  <span><span className="activity-swatch scatter-swatch-saved" /> Saved</span>
                  <span><span className="activity-swatch scatter-swatch-applied" /> Applied</span>
                  <span><span className="activity-swatch scatter-swatch-recruiter_screen" /> Screen</span>
                  <span><span className="activity-swatch scatter-swatch-interview" /> Interview</span>
                  <span><span className="activity-swatch scatter-swatch-offer" /> Offer</span>
                  <span><span className="activity-swatch scatter-swatch-rejected" /> Rejected</span>
                </div>
              </section>
            </>
          ) : view === 'settings' ? (
            <>
              <section className="page-heading">
                <div><div className="eyebrow">YOUR WORKSPACE</div><h1>Settings</h1><p>Data controls, sign-in preferences, and account management.</p></div>
                <button className="secondary-button" onClick={() => setView('overview')}>Back to dashboard</button>
              </section>
              <section className="settings-layout">
                <article className="panel settings-panel">
                  <div className="widget-heading"><div><h2>Data</h2><p>Export what you have or reset sample content.</p></div></div>
                  <div className="settings-row">
                    <div><strong>Export applications</strong><span>Download every application in your workspace as a JSON file.</span></div>
                    <button className="secondary-button" disabled={applications.length === 0} onClick={() => {
                      const payload = { exportedAt: new Date().toISOString(), user: authUser.email, count: applications.length, applications }
                      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
                      const url = URL.createObjectURL(blob)
                      const anchor = window.document.createElement('a')
                      anchor.href = url
                      anchor.download = `fieldnote-applications-${new Date().toISOString().slice(0, 10)}.json`
                      anchor.click()
                      URL.revokeObjectURL(url)
                      setNotice(`Exported ${applications.length} applications`)
                    }}><FileText size={14} />Export {applications.length} applications</button>
                  </div>
                  <div className="settings-row">
                    <div><strong>Export document metadata</strong><span>Labels, filenames, and sizes for every uploaded document. The file contents themselves are not included.</span></div>
                    <button className="secondary-button" disabled={documents.length === 0} onClick={() => {
                      const payload = { exportedAt: new Date().toISOString(), user: authUser.email, count: documents.length, documents }
                      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
                      const url = URL.createObjectURL(blob)
                      const anchor = window.document.createElement('a')
                      anchor.href = url
                      anchor.download = `fieldnote-documents-${new Date().toISOString().slice(0, 10)}.json`
                      anchor.click()
                      URL.revokeObjectURL(url)
                      setNotice(`Exported ${documents.length} document records`)
                    }}><FileText size={14} />Export {documents.length} records</button>
                  </div>
                  <div className="settings-row">
                    <div><strong>Re-seed sample applications</strong><span>Clear the local flag so the 84 sample applications get added again on your next sign-in (only ones that don't already exist).</span></div>
                    <button className="secondary-button" onClick={() => {
                      localStorage.removeItem(`${SAMPLE_SEEDED_PREFIX}${authUser.id}`)
                      setNotice('Sample seed flag cleared. Sign out and back in to re-seed.')
                    }}>Clear seed flag</button>
                  </div>
                </article>

                <article className="panel settings-panel">
                  <div className="widget-heading"><div><h2>Sign-in preferences</h2><p>What the sign-in screen remembers on this browser.</p></div></div>
                  <div className="settings-row">
                    <div><strong>Saved email addresses</strong><span>{savedEmails.length === 0 ? 'No emails saved on this browser.' : `${savedEmails.length} email${savedEmails.length === 1 ? '' : 's'} suggested on the sign-in screen: ${savedEmails.join(', ')}.`}</span></div>
                    <button className="secondary-button" disabled={savedEmails.length === 0} onClick={() => {
                      localStorage.removeItem(SAVED_EMAILS_KEY)
                      setSavedEmails([])
                      setNotice('Saved sign-in emails cleared')
                    }}>Clear saved emails</button>
                  </div>
                </article>

                <article className="panel settings-panel">
                  <div className="widget-heading"><div><h2>Account</h2><p>Shortcuts to profile-level actions.</p></div></div>
                  <div className="settings-row">
                    <div><strong>Profile</strong><span>Update display name, change password, sign out.</span></div>
                    <button className="secondary-button" onClick={() => setView('profile')}>Open profile</button>
                  </div>
                  <div className="settings-row settings-row-danger">
                    <div><strong>Delete account</strong><span>Permanently remove your account and all associated data. Backend endpoint not implemented yet.</span></div>
                    <button className="danger-button" disabled>Coming soon</button>
                  </div>
                </article>
              </section>
            </>
          ) : view === 'profile' ? (
            <>
              <section className="page-heading">
                <div><div className="eyebrow">YOUR ACCOUNT</div><h1>Profile</h1><p>Account details and session summary.</p></div>
                <button className="secondary-button" onClick={() => setView('overview')}>Back to dashboard</button>
              </section>
              <section className="profile-layout">
                <article className="panel profile-identity">
                  <div className="profile-avatar">{(authUser.displayName || authUser.email).slice(0, 1).toUpperCase()}</div>
                  <div className="profile-identity-copy">
                    <strong>{authUser.displayName || 'No display name set'}</strong>
                    <span><Mail size={13} />{authUser.email}</span>
                    <small>Member since {new Date(authUser.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</small>
                  </div>
                </article>
                <article className="panel profile-summary">
                  <div className="widget-heading"><div><h2>At a glance</h2><p>Your activity in this workspace.</p></div></div>
                  <div className="profile-stats">
                    <div><span>Applications</span><strong>{applications.length}</strong></div>
                    <div><span>Interviews</span><strong>{interviews}</strong></div>
                    <div><span>Offers</span><strong>{offers}</strong></div>
                    <div><span>Documents</span><strong>{documents.length}</strong></div>
                  </div>
                </article>
                <article className="panel profile-actions">
                  <div className="widget-heading"><div><h2>Account actions</h2><p>Manage your session.</p></div></div>
                  <div className="profile-action-row">
                    <div><strong>Sign out</strong><span>End this browser session. You'll need to sign in again next time.</span></div>
                    <button className="danger-button" onClick={signOut}><LogOut size={14} />Sign out</button>
                  </div>
                  <div className="profile-action-row">
                    <div><strong>Change password</strong><span>Update the password used to sign in to Fieldnote.</span></div>
                    <button className="secondary-button" onClick={openPasswordModal}><KeyRound size={14} />Change password</button>
                  </div>
                  <div className="profile-action-row">
                    <div><strong>Update display name</strong><span>{authUser.displayName ? `Currently "${authUser.displayName}".` : 'No display name set yet.'}</span></div>
                    <button className="secondary-button" onClick={openDisplayNameModal}><Pencil size={14} />Update name</button>
                  </div>
                </article>
              </section>
            </>
          ) : view === 'documents' ? (
            <>
              <section className="page-heading">
                <div><div className="eyebrow">YOUR MATERIALS</div><h1>Documents</h1><p>Upload resumes and cover letters, then attach them to applications.</p></div>
              </section>
              {documentError && <div className="api-error-banner" role="alert">{documentError}<button aria-label="Dismiss error" onClick={() => setDocumentError('')}><X size={14} /></button></div>}
              <section className="panel documents-panel">
                <div className="documents-tabs" role="tablist" aria-label="Document type">
                  {(['RESUME', 'COVER_LETTER'] as DocumentKind[]).map((kind) => {
                    const count = documents.filter((document) => document.kind === kind).length
                    const label = kind === 'RESUME' ? 'Resumes' : 'Cover letters'
                    return (
                      <button
                        key={kind}
                        role="tab"
                        aria-selected={documentTab === kind}
                        className={documentTab === kind ? 'documents-tab active' : 'documents-tab'}
                        onClick={() => { setDocumentTab(kind); setRenamingDocumentId(null); setDocumentError('') }}
                      >
                        {label}<span className="documents-tab-count">{count}</span>
                      </button>
                    )
                  })}
                </div>

                <form className="documents-upload" onSubmit={uploadDocument}>
                  <div className="documents-upload-fields">
                    <label className="form-field">
                      <span>Label <b>*</b></span>
                      <input required maxLength={200} value={uploadLabel} onChange={(event) => setUploadLabel(event.target.value)} placeholder={documentTab === 'RESUME' ? 'e.g. Product Designer resume v3' : 'e.g. Product Designer cover letter'} />
                    </label>
                    <label className="form-field">
                      <span>Version <small>Optional</small></span>
                      <input maxLength={100} value={uploadVersion} onChange={(event) => setUploadVersion(event.target.value)} placeholder="v1, tailored, etc." />
                    </label>
                    <label className="form-field documents-file-field">
                      <span>File <b>*</b> <small>PDF, DOCX, TXT · up to 5 MB</small></span>
                      <input type="file" accept=".pdf,.doc,.docx,.txt,.rtf,.odt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)} />
                      {uploadFile && <small className="documents-file-name">{uploadFile.name} · {formatBytes(uploadFile.size)}</small>}
                      {documentTab === 'RESUME' && <small className="form-hint">PDF, DOCX, and plain-text resumes are all parsed for AI job/resume analysis.</small>}
                    </label>
                  </div>
                  <div className="documents-upload-actions">
                    <button type="submit" className="primary-button" disabled={documentUploading}><Upload size={15} />{documentUploading ? 'Uploading…' : `Upload ${documentKindLabel(documentTab)}`}</button>
                  </div>
                </form>

                {documentsLoading ? (
                  <div className="api-loading-table">Loading your documents…</div>
                ) : visibleDocuments.length === 0 ? (
                  <div className="empty-state"><FileUp size={25} /><strong>No {documentKindLabel(documentTab, true)} yet</strong><span>Upload one above to attach it to applications.</span></div>
                ) : (
                  <ul className="documents-list">
                    {visibleDocuments.map((document) => {
                      const busy = documentBusyId === document.id
                      const isRenaming = renamingDocumentId === document.id
                      return (
                        <li className="documents-item" key={document.id}>
                          <span className="documents-item-icon"><FileText size={16} /></span>
                          <div className="documents-item-body">
                            {isRenaming ? (
                              <form
                                className="documents-rename"
                                onSubmit={(event) => { event.preventDefault(); void submitRenameDocument(document.id) }}
                              >
                                <input autoFocus maxLength={200} value={renameValue} onChange={(event) => setRenameValue(event.target.value)} />
                                <button type="submit" className="secondary-button" disabled={busy}><Check size={14} />Save</button>
                                <button type="button" className="secondary-button" onClick={cancelRenameDocument}><X size={14} />Cancel</button>
                              </form>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  className="documents-item-name"
                                  onClick={() => void handleDownloadDocument(document)}
                                  disabled={busy}
                                  title={`Download ${document.originalFileName}`}
                                >
                                  {document.label}
                                </button>
                                <small>{document.originalFileName} · {formatBytes(document.sizeBytes)}{document.version ? ` · ${document.version}` : ''} · Uploaded {formatDate(document.createdAt.slice(0, 10))}</small>
                              </>
                            )}
                          </div>
                          {!isRenaming && (
                            <div className="documents-item-actions">
                              <button className="icon-button" title="Rename" aria-label={`Rename ${document.label}`} onClick={() => beginRenameDocument(document)}><Pencil size={14} /></button>
                              <button className="icon-button delete-action" title="Delete" aria-label={`Delete ${document.label}`} onClick={() => { setDocumentDeleteTarget(document); setDocumentError('') }}><Trash2 size={14} /></button>
                            </div>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </section>
            </>
          ) : (
            <>
              <section className="page-heading applications-heading">
                <div><div className="eyebrow">YOUR JOB SEARCH</div><h1>Applications</h1><p>Keep every opportunity and next step in one place.</p></div>
                <button className="primary-button" onClick={openCreateForm}><Plus size={17} />Add application</button>
              </section>
              <section className="applications-summary"><div><strong>{filteredApplications.length}</strong><span>{filteredApplications.length === 1 ? 'application' : 'applications'}</span></div><div className="summary-divider" /><div><strong>{interviews}</strong><span>active conversations</span></div><div className="summary-note"><span className="summary-spark"><Sparkles size={14} /></span>One clear next step is enough for today.</div></section>
              <section className="panel applications-panel">
                <div className="table-toolbar"><div className="toolbar-title"><h2>All applications</h2><span>{applications.length.toString().padStart(2, '0')} total</span></div><div className="table-controls"><label className="search-box"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search roles or companies" aria-label="Search roles or companies" />{query && <button aria-label="Clear search" onClick={() => setQuery('')}><X size={14} /></button>}</label><label className="filter-select"><span className="sr-only">Filter by status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="ALL">All statuses</option>{statuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}</select><ChevronDown size={14} /></label></div></div>
                {applicationsLoading ? <div className="api-loading-table">Loading your applications…</div> : <ApplicationTable applications={filteredApplications} onEdit={openEditForm} onStatusChange={updateStatus} onDelete={setDeleteTarget} />}
                <div className="table-footer"><span>Showing {filteredApplications.length} of {applications.length} applications</span><button onClick={openCreateForm}><Plus size={14} />New application</button></div>
              </section>
              <footer className="page-footer"><span>FIELDNOTE <span className="footer-dot">·</span> YOUR SEARCH, ORGANIZED</span><button onClick={() => setNotice('Your data is currently saved for this session only. API connection is the next step.')}><FileText size={13} /> Data status</button></footer>
            </>
          )}
        </div>
      </main>

      {formOpen && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setFormOpen(false) }}>
          <section className="application-modal" role="dialog" aria-modal="true" aria-labelledby="form-title">
            <div className="modal-heading"><div><div className="eyebrow">APPLICATION DETAILS</div><h2 id="form-title">{editing ? 'Update application' : 'Add an application'}</h2></div><button className="icon-button modal-close" aria-label="Close form" onClick={() => setFormOpen(false)}><X size={18} /></button></div>
            {editing && (
              <div className="modal-tabs" role="tablist" aria-label="Application sections">
                <button type="button" role="tab" aria-selected={modalTab === 'details'} className={modalTab === 'details' ? 'modal-tab active' : 'modal-tab'} onClick={() => setModalTab('details')}>Details</button>
                <button type="button" role="tab" aria-selected={modalTab === 'ai'} className={modalTab === 'ai' ? 'modal-tab active' : 'modal-tab'} onClick={() => setModalTab('ai')}><Sparkles size={13} />AI insights</button>
              </div>
            )}
            {editing && modalTab === 'ai' ? (
              <div className="modal-body ai-body">
                <section className="ai-section">
                  <div className="ai-section-heading">
                    <div>
                      <h3>Job / resume match</h3>
                      <p>Score this application against the attached resume.</p>
                    </div>
                    <button
                      type="button"
                      className="primary-button"
                      onClick={runAnalysis}
                      disabled={!editing.resumeId || analysisRunning}
                      title={!editing.resumeId ? 'Attach a resume in the Details tab first.' : undefined}
                    >
                      <Sparkles size={14} />
                      {analysisRunning ? 'Analyzing…' : 'Run analysis'}
                    </button>
                  </div>
                  {!editing.resumeId && <div className="ai-hint">Attach a resume in the Details tab to enable analysis.</div>}
                  {analysisError && <div className="api-error-banner" role="alert">{analysisError}<button type="button" aria-label="Dismiss error" onClick={() => setAnalysisError('')}><X size={14} /></button></div>}
                  {!analysesLoaded ? (
                    <div className="api-loading-table">Loading analyses…</div>
                  ) : analyses.length === 0 ? (
                    <div className="empty-state"><Sparkles size={22} /><strong>No analyses yet</strong><span>Run one to see a match score, strengths, and gaps.</span></div>
                  ) : (
                    <ul className="ai-history">
                      {analyses.map((analysis) => (
                        <li className="ai-card" key={analysis.id}>
                          <div className="ai-card-heading">
                            <div>
                              <div className="ai-card-score" data-tone={analysis.matchScore >= 70 ? 'high' : analysis.matchScore >= 40 ? 'mid' : 'low'}>
                                <strong>{analysis.matchScore}</strong><small>/ 100 match</small>
                              </div>
                              <div className="ai-card-meta">
                                Resume: <strong>{analysis.document?.label ?? '(deleted)'}</strong>
                                <span className="ai-card-dot">·</span>
                                {new Date(analysis.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                <span className="ai-card-dot">·</span>
                                {analysis.provider} {analysis.modelId}
                              </div>
                            </div>
                          </div>
                          <p className="ai-card-summary">{analysis.summary}</p>
                          <div className="ai-card-lists">
                            <div>
                              <span className="ai-card-list-label">Strengths</span>
                              <ul>{analysis.strengths.map((item) => <li key={item}>{item}</li>)}</ul>
                            </div>
                            <div>
                              <span className="ai-card-list-label">Missing skills</span>
                              <ul>{analysis.missingSkills.map((item) => <li key={item}>{item}</li>)}</ul>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="ai-section">
                  <div className="ai-section-heading">
                    <div>
                      <h3>Interview questions</h3>
                      <p>Generated from the job description.</p>
                    </div>
                    <button type="button" className="primary-button" onClick={generateInterviewQuestions} disabled={questionsRunning}>
                      <Sparkles size={14} />
                      {questionsRunning ? 'Generating…' : 'Generate questions'}
                    </button>
                  </div>
                  {questionsError && <div className="api-error-banner" role="alert">{questionsError}<button type="button" aria-label="Dismiss error" onClick={() => setQuestionsError('')}><X size={14} /></button></div>}
                  {!questionsLoaded ? (
                    <div className="api-loading-table">Loading questions…</div>
                  ) : questionSets.length === 0 ? (
                    <div className="empty-state"><Sparkles size={22} /><strong>No question sets yet</strong><span>Generate a set to prepare for the next conversation.</span></div>
                  ) : (
                    <ul className="ai-history">
                      {questionSets.map((set) => (
                        <li className="ai-card" key={set.id}>
                          <div className="ai-card-meta">
                            {new Date(set.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                            <span className="ai-card-dot">·</span>
                            {set.provider} {set.modelId}
                          </div>
                          <ol className="ai-question-list">
                            {set.questions.map((question, index) => <li key={index}>{question}</li>)}
                          </ol>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
                <div className="modal-actions"><span /><div><button type="button" className="secondary-button" onClick={() => setFormOpen(false)}>Close</button></div></div>
              </div>
            ) : (
            <form onSubmit={saveApplication}>
              {applicationError && <div className="api-error-banner" role="alert">{applicationError}<button type="button" aria-label="Dismiss error" onClick={() => setApplicationError('')}><X size={14} /></button></div>}
              <div className="form-grid">
                <label className="form-field"><span>Company <b>*</b></span><input required maxLength={120} value={draft.company} onChange={(event) => setDraft({ ...draft, company: event.target.value })} placeholder="e.g. Acme Studio" autoFocus /></label>
                <label className="form-field"><span>Job title <b>*</b></span><input required maxLength={200} value={draft.jobTitle} onChange={(event) => setDraft({ ...draft, jobTitle: event.target.value })} placeholder="e.g. Product Designer" /></label>
                <label className="form-field"><span>Status</span><span className="form-select"><select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as Status })}>{statuses.filter((status) => status !== 'SAVED' || !editing || editing.status === 'SAVED').map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}</select><ChevronDown size={14} /></span></label>
                <label className="form-field"><span>Date applied</span><input type="date" value={draft.dateApplied} onChange={(event) => setDraft({ ...draft, dateApplied: event.target.value })} /></label>
                <label className="form-field"><span>Location</span><input maxLength={120} value={draft.location} onChange={(event) => setDraft({ ...draft, location: event.target.value })} placeholder="Remote, city, or hybrid" /></label>
                <label className="form-field"><span>Salary range</span><input maxLength={80} value={draft.salary} onChange={(event) => setDraft({ ...draft, salary: event.target.value })} placeholder="Optional" /></label>
                <label className="form-field form-wide"><span>Job posting URL</span><input type="url" maxLength={500} value={draft.url} onChange={(event) => setDraft({ ...draft, url: event.target.value })} placeholder="https://" /></label>
                <label className="form-field form-wide"><span>Job description <b>*</b></span><textarea required maxLength={12000} rows={4} value={draft.jobDescription} onChange={(event) => setDraft({ ...draft, jobDescription: event.target.value })} placeholder="Paste the job description or a short summary" /></label>
                <label className="form-field form-wide"><span>Notes</span><textarea maxLength={4000} rows={3} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} placeholder="Follow-ups, people, or details to remember" /></label>
                <label className="form-field">
                  <span>Resume</span>
                  <span className="form-select">
                    <select value={draft.resumeId ?? ''} onChange={(event) => setDraft({ ...draft, resumeId: event.target.value || null })}>
                      <option value="">— None —</option>
                      {resumeOptions.map((document) => <option key={document.id} value={document.id}>{document.label}</option>)}
                    </select>
                    <ChevronDown size={14} />
                  </span>
                  {resumeOptions.length === 0 && <small className="form-hint">No resumes yet. Upload one from the Documents page.</small>}
                </label>
                <label className="form-field">
                  <span>Cover letter</span>
                  <span className="form-select">
                    <select value={draft.coverLetterId ?? ''} onChange={(event) => setDraft({ ...draft, coverLetterId: event.target.value || null })}>
                      <option value="">— None —</option>
                      {coverLetterOptions.map((document) => <option key={document.id} value={document.id}>{document.label}</option>)}
                    </select>
                    <ChevronDown size={14} />
                  </span>
                  {coverLetterOptions.length === 0 && <small className="form-hint">No cover letters yet. Upload one from the Documents page.</small>}
                </label>
              </div>
              <div className="modal-actions"><span><b>*</b> Required fields</span><div><button type="button" className="secondary-button" onClick={() => setFormOpen(false)}>Cancel</button><button type="submit" className="primary-button" disabled={applicationSaving}><Check size={16} />{applicationSaving ? 'Saving…' : editing ? 'Save changes' : 'Save application'}</button></div></div>
            </form>
            )}
          </section>
        </div>
      )}

      {deleteTarget && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setDeleteTarget(null) }}>
          <section className="confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-title" aria-describedby="delete-copy">
            <span className="confirm-icon"><Trash2 size={19} /></span><h2 id="delete-title">Delete this application?</h2><p id="delete-copy">{deleteTarget.jobTitle} at {deleteTarget.company} will be removed from this list.</p>
            <div className="confirm-actions"><button className="secondary-button" onClick={() => setDeleteTarget(null)}>Keep it</button><button className="danger-button" onClick={confirmDelete}>Delete application</button></div>
          </section>
        </div>
      )}

      {displayNameModalOpen && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setDisplayNameModalOpen(false) }}>
          <section className="profile-modal" role="dialog" aria-modal="true" aria-labelledby="display-name-title">
            <div className="modal-heading"><div><div className="eyebrow">YOUR ACCOUNT</div><h2 id="display-name-title">Update display name</h2></div><button className="icon-button modal-close" aria-label="Close" onClick={() => setDisplayNameModalOpen(false)}><X size={18} /></button></div>
            <form onSubmit={submitDisplayName} className="profile-form">
              {displayNameError && <div className="api-error-banner" role="alert">{displayNameError}<button type="button" aria-label="Dismiss error" onClick={() => setDisplayNameError('')}><X size={14} /></button></div>}
              <label className="form-field form-wide">
                <span>Display name <small>Leave blank to clear</small></span>
                <input autoFocus maxLength={100} value={displayNameDraft} onChange={(event) => setDisplayNameDraft(event.target.value)} placeholder="How should we address you?" />
              </label>
              <div className="modal-actions"><span /><div><button type="button" className="secondary-button" onClick={() => setDisplayNameModalOpen(false)}>Cancel</button><button type="submit" className="primary-button" disabled={displayNameSaving}><Check size={16} />{displayNameSaving ? 'Saving…' : 'Save name'}</button></div></div>
            </form>
          </section>
        </div>
      )}

      {passwordModalOpen && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setPasswordModalOpen(false) }}>
          <section className="profile-modal" role="dialog" aria-modal="true" aria-labelledby="password-title">
            <div className="modal-heading"><div><div className="eyebrow">YOUR ACCOUNT</div><h2 id="password-title">Change password</h2></div><button className="icon-button modal-close" aria-label="Close" onClick={() => setPasswordModalOpen(false)}><X size={18} /></button></div>
            <form onSubmit={submitPasswordChange} className="profile-form">
              {passwordError && <div className="api-error-banner" role="alert">{passwordError}<button type="button" aria-label="Dismiss error" onClick={() => setPasswordError('')}><X size={14} /></button></div>}
              <label className="form-field form-wide">
                <span>Current password <b>*</b></span>
                <input required type="password" autoComplete="current-password" value={passwordFields.current} onChange={(event) => setPasswordFields({ ...passwordFields, current: event.target.value })} />
              </label>
              <label className="form-field form-wide">
                <span>New password <b>*</b> <small>At least 8 characters</small></span>
                <input required type="password" minLength={8} autoComplete="new-password" value={passwordFields.next} onChange={(event) => setPasswordFields({ ...passwordFields, next: event.target.value })} />
              </label>
              <label className="form-field form-wide">
                <span>Confirm new password <b>*</b></span>
                <input required type="password" minLength={8} autoComplete="new-password" value={passwordFields.confirm} onChange={(event) => setPasswordFields({ ...passwordFields, confirm: event.target.value })} />
              </label>
              <div className="modal-actions"><span /><div><button type="button" className="secondary-button" onClick={() => setPasswordModalOpen(false)}>Cancel</button><button type="submit" className="primary-button" disabled={passwordSaving}><Check size={16} />{passwordSaving ? 'Updating…' : 'Update password'}</button></div></div>
            </form>
          </section>
        </div>
      )}

      {documentDeleteTarget && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setDocumentDeleteTarget(null) }}>
          <section className="confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="doc-delete-title" aria-describedby="doc-delete-copy">
            <span className="confirm-icon"><Trash2 size={19} /></span>
            <h2 id="doc-delete-title">Delete this {documentKindLabel(documentDeleteTarget.kind)}?</h2>
            <p id="doc-delete-copy">{documentDeleteTarget.label} will be removed. Any application currently attached to it will lose the attachment.</p>
            <div className="confirm-actions">
              <button className="secondary-button" onClick={() => setDocumentDeleteTarget(null)}>Keep it</button>
              <button className="danger-button" onClick={confirmDocumentDelete} disabled={documentBusyId === documentDeleteTarget.id}>Delete {documentKindLabel(documentDeleteTarget.kind)}</button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

export default App