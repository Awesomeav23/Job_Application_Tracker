import { useMemo, useState, type FormEvent } from 'react'
import {
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronDown,
  CircleHelp,
  FileText,
  LayoutDashboard,
  MapPin,
  MoreHorizontal,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import './App.css'

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

const statuses: Status[] = ['SAVED', 'APPLIED', 'RECRUITER_SCREEN', 'INTERVIEW', 'OFFER', 'REJECTED', 'WITHDRAWN']
const sources = ['LinkedIn', 'Company website', 'Referral', 'Indeed', 'Other']

const statusLabels: Record<Status, string> = {
  SAVED: 'Saved',
  APPLIED: 'Applied',
  RECRUITER_SCREEN: 'Recruiter screen',
  INTERVIEW: 'Interview',
  OFFER: 'Offer',
  REJECTED: 'Rejected',
  WITHDRAWN: 'Withdrawn',
}

const initialApplications: Application[] = [
  {
    id: 'app-1', company: 'Linear', jobTitle: 'Product Designer', status: 'INTERVIEW', location: 'New York, NY', source: 'LinkedIn',
    dateApplied: '2026-09-22', salary: '$145k–$175k', url: 'https://linear.app/careers',
    jobDescription: 'Shape the tools that help product teams do their best work.', notes: 'Portfolio review with Maya on Thursday.',
  },
  {
    id: 'app-2', company: 'Figma', jobTitle: 'Senior UX Designer', status: 'RECRUITER_SCREEN', location: 'Remote · US', source: 'LinkedIn',
    dateApplied: '2026-09-19', salary: '$160k–$195k', url: 'https://figma.com/careers',
    jobDescription: 'Help make design accessible to more teams and communities.', notes: 'Recruiter call booked for next week.',
  },
  {
    id: 'app-3', company: 'Notion', jobTitle: 'Product Designer, Growth', status: 'APPLIED', location: 'San Francisco, CA', source: 'Company website',
    dateApplied: '2026-09-16', salary: '$150k–$180k', url: 'https://notion.so/careers',
    jobDescription: 'Design thoughtful experiences that help teams build momentum.', notes: '',
  },
  {
    id: 'app-4', company: 'Airtable', jobTitle: 'Design Systems Lead', status: 'SAVED', location: 'Remote · US', source: 'Company website',
    dateApplied: '2026-09-14', salary: '$155k–$190k', url: 'https://airtable.com/careers',
    jobDescription: 'Build and evolve a design system used across a flexible platform.', notes: 'Tailor portfolio to component systems.',
  },
  {
    id: 'app-5', company: 'Webflow', jobTitle: 'Staff Product Designer', status: 'OFFER', location: 'Remote · US', source: 'Referral',
    dateApplied: '2026-09-11', salary: '$175k–$210k', url: 'https://webflow.com/careers',
    jobDescription: 'Help people build for the web through visual development.', notes: 'Offer received. Decision due October 2.',
  },
  {
    id: 'app-6', company: 'Dropbox', jobTitle: 'Product Designer', status: 'REJECTED', location: 'Austin, TX', source: 'Indeed',
    dateApplied: '2026-09-08', salary: '$140k–$170k', url: 'https://dropbox.com/jobs',
    jobDescription: 'Create calm, useful experiences for distributed work.', notes: '',
  },
]

const emptyDraft: ApplicationDraft = {
  company: '', jobTitle: '', status: 'SAVED', location: '', dateApplied: new Date().toISOString().slice(0, 10),
  salary: '', url: '', jobDescription: '', notes: '', source: 'Company website',
}

function formatDate(value: string) {
  if (!value) return 'Not set'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(`${value}T12:00:00`))
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
  const [view, setView] = useState<View>('overview')
  const [applications, setApplications] = useState(initialApplications)
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

  function openCreateForm() {
    setEditing(null)
    setDraft({ ...emptyDraft, dateApplied: new Date().toISOString().slice(0, 10) })
    setFormOpen(true)
  }

  function openEditForm(application: Application) {
    setEditing(application)
    setDraft({ ...application })
    setFormOpen(true)
  }

  function saveApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (editing) {
      setApplications((current) => current.map((application) => application.id === editing.id ? { ...draft, id: editing.id } : application))
      setNotice('Application updated')
    } else {
      setApplications((current) => [{ ...draft, id: `app-${Date.now()}` }, ...current])
      setNotice('Application added')
    }
    setFormOpen(false)
  }

  function updateStatus(id: string, status: Status) {
    setApplications((current) => current.map((application) => application.id === id ? { ...application, status } : application))
    setNotice('Status updated')
  }

  function confirmDelete() {
    if (!deleteTarget) return
    setApplications((current) => current.filter((application) => application.id !== deleteTarget.id))
    setNotice('Application deleted')
    setDeleteTarget(null)
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
          <div className="user-chip"><span className="avatar">A</span><span><strong>Alex Morgan</strong><small>Personal workspace</small></span><MoreHorizontal size={16} /></div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb"><span>Workspace</span><span className="crumb-separator">/</span><strong>{view === 'overview' ? 'Dashboard' : view === 'board' ? 'Board' : view === 'stats' ? 'Stats' : 'Applications'}</strong></div>
          <div className="topbar-actions"><span className="today-label"><CalendarDays size={14} />Friday, September 25</span><button className="help-button" aria-label="Help" title="Help"><CircleHelp size={18} /></button><span className="top-avatar">A</span></div>
        </header>

        <div className="page-content">
          {notice && <div className="notice" role="status"><Check size={15} />{notice}<button aria-label="Dismiss notification" onClick={() => setNotice('')}><X size={14} /></button></div>}

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
                  {sourceCounts.map(({ source, count }) => <button className="source-row" key={source} onClick={() => setView('applications')}><span>{source}</span><span className="source-track"><span style={{ width: `${count ? Math.max(10, (count / maxSourceCount) * 100) : 0}%` }} /></span><strong>{count}</strong></button>)}
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
                <ApplicationTable applications={filteredApplications} onEdit={openEditForm} onStatusChange={updateStatus} onDelete={setDeleteTarget} />
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
              <div className="form-grid">
                <label className="form-field"><span>Company <b>*</b></span><input required maxLength={120} value={draft.company} onChange={(event) => setDraft({ ...draft, company: event.target.value })} placeholder="e.g. Acme Studio" autoFocus /></label>
                <label className="form-field"><span>Job title <b>*</b></span><input required maxLength={200} value={draft.jobTitle} onChange={(event) => setDraft({ ...draft, jobTitle: event.target.value })} placeholder="e.g. Product Designer" /></label>
                <label className="form-field"><span>Status</span><span className="form-select"><select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as Status })}>{statuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}</select><ChevronDown size={14} /></span></label>
                <label className="form-field"><span>Date applied</span><input type="date" value={draft.dateApplied} onChange={(event) => setDraft({ ...draft, dateApplied: event.target.value })} /></label>
                <label className="form-field"><span>Location</span><input maxLength={120} value={draft.location} onChange={(event) => setDraft({ ...draft, location: event.target.value })} placeholder="Remote, city, or hybrid" /></label>
                <label className="form-field"><span>Salary range</span><input maxLength={80} value={draft.salary} onChange={(event) => setDraft({ ...draft, salary: event.target.value })} placeholder="Optional" /></label>
                <label className="form-field form-wide"><span>Job posting URL</span><input type="url" value={draft.url} onChange={(event) => setDraft({ ...draft, url: event.target.value })} placeholder="https://" /></label>
                <label className="form-field form-wide"><span>Job description <b>*</b></span><textarea required maxLength={12000} rows={4} value={draft.jobDescription} onChange={(event) => setDraft({ ...draft, jobDescription: event.target.value })} placeholder="Paste the job description or a short summary" /></label>
                <label className="form-field form-wide"><span>Notes</span><textarea maxLength={4000} rows={3} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} placeholder="Follow-ups, people, or details to remember" /></label>
              </div>
              <div className="modal-actions"><span><b>*</b> Required fields</span><div><button type="button" className="secondary-button" onClick={() => setFormOpen(false)}>Cancel</button><button type="submit" className="primary-button"><Check size={16} />{editing ? 'Save changes' : 'Save application'}</button></div></div>
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