import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronDown,
  CircleHelp,
  FileText,
  KeyRound,
  LayoutDashboard,
  MapPin,
  MoreHorizontal,
  Plus,
  Search,
  ShieldCheck,
  Settings2,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import './App.css'
import { ApiError, apiFetch, authenticate, clearSession, getCurrentUser, hasSession, type AuthUser } from './lib/api'

type Status = 'SAVED' | 'APPLIED' | 'RECRUITER_SCREEN' | 'INTERVIEW' | 'OFFER' | 'REJECTED' | 'WITHDRAWN'
type View = 'overview' | 'board' | 'applications' | 'stats'

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
}

type ApplicationDraft = Omit<Application, 'id'>

interface ApiApplication extends Omit<Application, 'dateApplied' | 'source' | 'location' | 'salary' | 'url' | 'notes'> {
  dateApplied: string | null
  location: string | null
  salary: string | null
  url: string | null
  notes: string | null
  source: 'MANUAL' | 'EXTENSION'
}

const statuses: Status[] = ['SAVED', 'APPLIED', 'RECRUITER_SCREEN', 'INTERVIEW', 'OFFER', 'REJECTED', 'WITHDRAWN']
const sources = ['MANUAL', 'EXTENSION'] as const
const SAVED_EMAILS_KEY = 'fieldnote.savedEmails'
const SAMPLE_SEEDED_PREFIX = 'fieldnote.sampleApplicationsSeeded.v2:'

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

const sampleApplications = Array.from({ length: 84 }, (_, index) => {
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
  }
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
                <label className="status-select-wrap">
                  <span className="sr-only">Status for {application.jobTitle} at {application.company}</span>
                  <select value={application.status} onChange={(event) => onStatusChange(application.id, event.target.value as Status)}>
                    {statuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
                  </select>
                  <ChevronDown size={13} aria-hidden="true" />
                </label>
              </td>
              <td className="date-cell">{formatDate(application.dateApplied)}</td>
              <td className="location-cell"><MapPin size={13} aria-hidden="true" />{application.location || '—'}</td>
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
  const responseRate = sentApplications.length ? Math.round((repliedApplications.length / sentApplications.length) * 100) : 0
  const interviews = applications.filter((application) => application.status === 'INTERVIEW').length
  const offers = applications.filter((application) => application.status === 'OFFER').length
  const needsChasing = applications.filter((application) => application.status === 'APPLIED').length
  const statusCounts = statuses.map((status) => ({
    status,
    count: applications.filter((application) => application.status === status).length,
  }))
  const maxStatusCount = Math.max(1, ...statusCounts.map((item) => item.count))
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

  function openCreateForm() {
    setEditing(null)
    setApplicationError('')
    setDraft({ ...emptyDraft, dateApplied: new Date().toISOString().slice(0, 10) })
    setFormOpen(true)
  }

  function openEditForm(application: Application) {
    setEditing(application)
    setApplicationError('')
    setDraft({ ...application })
    setFormOpen(true)
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
          }
        : {
            ...basePayload,
            ...(draft.location.trim() ? { location: draft.location.trim() } : {}),
            ...(draft.salary.trim() ? { salary: draft.salary.trim() } : {}),
            ...(draft.url.trim() ? { url: draft.url.trim() } : {}),
            ...(dateApplied ? { dateApplied } : {}),
            ...(draft.notes.trim() ? { notes: draft.notes.trim() } : {}),
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
    } catch (error) {
      setApplicationError(applicationErrorMessage(error, 'Unable to save application.'))
    } finally {
      setApplicationSaving(false)
    }
  }

  async function updateStatus(id: string, status: Status) {
    setApplicationError('')
    try {
      const updated = await apiFetch<ApiApplication>(`/applications/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      })
      const application = fromApiApplication(updated)
      setApplications((current) => current.map((item) => item.id === id ? application : item))
      setNotice('Status updated')
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
          <button className={view === 'stats' ? 'nav-link active' : 'nav-link'} onClick={() => setView('stats')}><Sparkles size={17} />Stats</button>
        </nav>
        <div className="sidebar-bottom">
          <button className="nav-link muted-link" onClick={() => setNotice('Settings will be available in a later milestone.')}><Settings2 size={17} />Settings</button>
          <button className="nav-link muted-link" onClick={() => setNotice('Help will be available in a later milestone.')}><CircleHelp size={17} />Help</button>
          <button className="user-chip" onClick={signOut} title="Sign out"><span className="avatar">{(authUser.displayName || authUser.email).slice(0, 1).toUpperCase()}</span><span><strong>{authUser.displayName || authUser.email}</strong><small>Sign out</small></span><MoreHorizontal size={16} /></button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb"><span>Workspace</span><span className="crumb-separator">/</span><strong>{view === 'overview' ? 'Dashboard' : view === 'board' ? 'Board' : view === 'stats' ? 'Stats' : 'Applications'}</strong></div>
          <div className="topbar-actions"><span className="today-label"><CalendarDays size={14} />Friday, September 25</span><button className="help-button" aria-label="Help" title="Help"><CircleHelp size={18} /></button><button className="account-menu" onClick={signOut} title="Sign out"><span className="top-avatar">{(authUser.displayName || authUser.email).slice(0, 1).toUpperCase()}</span><span>{authUser.displayName || authUser.email}</span><span className="signout-label">Sign out</span></button></div>
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
                <button className="metric-panel kpi-response" onClick={() => setView('stats')}><span className="kpi-icon"><ArrowUpRight size={15} /></span><span className="kpi-label">Response rate</span><strong>{responseRate}%</strong><small>{repliedApplications.length} of {sentApplications.length} replied</small></button>
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
                  <div className="widget-heading"><div><h2>Coming up</h2><p>Follow-ups and next steps.</p></div><span className="week-label">NEXT 2 WEEKS</span></div>
                  {[
                    { company: 'Figma', task: 'Recruiter call', date: 'Tue · Sep 29', status: 'Screen' },
                    { company: 'Linear', task: 'Portfolio review', date: 'Thu · Oct 1', status: 'Interview' },
                    { company: 'Webflow', task: 'Offer decision', date: 'Fri · Oct 2', status: 'Offer' },
                  ].map((item) => <div className="upcoming-row" key={item.company}><span className="calendar-tile"><CalendarDays size={14} /></span><span className="upcoming-copy"><strong>{item.company}</strong><small>{item.task} · {item.date}</small></span><span className="upcoming-status">{item.status}</span></div>)}
                  <button className="widget-link" onClick={() => setNotice('Calendar sync will be added in a later milestone.')}>View schedule <ArrowUpRight size={13} /></button>
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
                <article className="panel stats-panel"><div className="widget-heading"><div><h2>Applications by status</h2><p>Current stage across your pipeline.</p></div></div>{statusCounts.map(({ status, count }) => <button className="stats-status-row" key={status} onClick={() => { setStatusFilter(status); setView('applications') }}><span className={`pipeline-dot status-${status.toLowerCase()}`} /><span>{statusLabels[status]}</span><span className="stats-track"><span style={{ width: `${count ? Math.max(8, (count / maxStatusCount) * 100) : 0}%` }} /></span><strong>{count}</strong></button>)}</article>
                <article className="panel response-summary"><div className="eyebrow">RESPONSE RATE</div><strong>{responseRate}%</strong><p>{repliedApplications.length} responses from {sentApplications.length} applications sent.</p><button className="widget-link" onClick={() => setView('applications')}>Review applications <ArrowUpRight size={13} /></button></article>
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
            <form onSubmit={saveApplication}>
              {applicationError && <div className="api-error-banner" role="alert">{applicationError}<button type="button" aria-label="Dismiss error" onClick={() => setApplicationError('')}><X size={14} /></button></div>}
              <div className="form-grid">
                <label className="form-field"><span>Company <b>*</b></span><input required maxLength={120} value={draft.company} onChange={(event) => setDraft({ ...draft, company: event.target.value })} placeholder="e.g. Acme Studio" autoFocus /></label>
                <label className="form-field"><span>Job title <b>*</b></span><input required maxLength={200} value={draft.jobTitle} onChange={(event) => setDraft({ ...draft, jobTitle: event.target.value })} placeholder="e.g. Product Designer" /></label>
                <label className="form-field"><span>Status</span><span className="form-select"><select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as Status })}>{statuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}</select><ChevronDown size={14} /></span></label>
                <label className="form-field"><span>Date applied</span><input type="date" value={draft.dateApplied} onChange={(event) => setDraft({ ...draft, dateApplied: event.target.value })} /></label>
                <label className="form-field"><span>Location</span><input maxLength={120} value={draft.location} onChange={(event) => setDraft({ ...draft, location: event.target.value })} placeholder="Remote, city, or hybrid" /></label>
                <label className="form-field"><span>Salary range</span><input maxLength={80} value={draft.salary} onChange={(event) => setDraft({ ...draft, salary: event.target.value })} placeholder="Optional" /></label>
                <label className="form-field form-wide"><span>Job posting URL</span><input type="url" maxLength={500} value={draft.url} onChange={(event) => setDraft({ ...draft, url: event.target.value })} placeholder="https://" /></label>
                <label className="form-field form-wide"><span>Job description <b>*</b></span><textarea required maxLength={12000} rows={4} value={draft.jobDescription} onChange={(event) => setDraft({ ...draft, jobDescription: event.target.value })} placeholder="Paste the job description or a short summary" /></label>
                <label className="form-field form-wide"><span>Notes</span><textarea maxLength={4000} rows={3} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} placeholder="Follow-ups, people, or details to remember" /></label>
              </div>
              <div className="modal-actions"><span><b>*</b> Required fields</span><div><button type="button" className="secondary-button" onClick={() => setFormOpen(false)}>Cancel</button><button type="submit" className="primary-button" disabled={applicationSaving}><Check size={16} />{applicationSaving ? 'Saving…' : editing ? 'Save changes' : 'Save application'}</button></div></div>
            </form>
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
    </div>
  )
}

export default App