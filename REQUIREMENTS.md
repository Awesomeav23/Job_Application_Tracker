# Requirements & Traceability

**Project:** AI Job Application Tracker
**Last updated:** 2026-09-25
**Companion to:** [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)

This document is the single source of truth for *what the system must do*. Every requirement has an ID, acceptance criteria, and a target milestone. Phase 17 acceptance testing reads directly from the status table below.

**Traceability chain:** Requirement → Implementation → Test → Result

---

## Status Summary

Legend: `Not started` · `In progress` · `Implemented` · `Tested` · `PASS` / `FAIL`

### MVP scope

| ID | Requirement | Milestone | Test ref | Status |
| --- | --- | --- | --- | --- |
| AUTH-001 | Create account with email + password | M5 | — | Not started |
| AUTH-002 | Log in | M5 | — | Not started |
| AUTH-003 | Block unauthenticated access to private data | M5 | — | Not started |
| APP-001 | Create job application | M4 | — | Not started |
| APP-002 | Edit application | M4 | — | Not started |
| APP-003 | Delete application | M4 | — | Not started |
| APP-004 | Change application status | M4 | — | Not started |
| APP-005 | Search applications | M4 | — | Not started |
| APP-006 | Filter applications by status | M4 | — | Not started |
| RES-001 | Upload multiple resumes | M6 | — | Not started |
| RES-002 | Name / version resumes | M6 | — | Not started |
| RES-003 | Associate a resume with an application | M6 | — | Not started |
| DOC-001 | Upload cover letters | M6 | — | Not started |
| DOC-002 | Associate a cover letter with an application | M6 | — | Not started |
| ANA-001 | Total applications | M7 | — | Not started |
| ANA-002 | Applications by status | M7 | — | Not started |
| ANA-003 | Response rate | M7 | — | Not started |
| ANA-004 | Interview conversion rate | M7 | — | Not started |
| ANA-005 | Average response time | M7 | — | Not started |
| ANA-006 | Application activity over time | M7 | — | Not started |
| AI-001 | Analyze job against associated resume | M8 | — | Not started |
| AI-002 | Generate interview questions | M8 | — | Not started |
| AI-003 | Analysis bound to application + resume version | M8 | — | Not started |
| NFR-001 | Passwords stored only as salted hashes | M5 | — | Not started |
| NFR-002 | Cross-account data isolation | M5 | — | Not started |
| NFR-003 | All write endpoints validate input | M4 | — | Not started |
| NFR-004 | Uploads restricted by type and size | M6 | — | Not started |

### Post-MVP scope

| ID | Requirement | Milestone | Test ref | Status |
| --- | --- | --- | --- | --- |
| EXT-001 | Save a job from a webpage via extension | M9 | — | Not started |
| EXT-002 | Extension authenticates to backend | M9 | — | Not started |
| EXT-003 | Captured job appears in tracker | M9 | — | Not started |
| EMAIL-001 | Connect a supported email account | M10 | — | Not started |
| EMAIL-002 | Identify job-related emails | M10 | — | Not started |
| EMAIL-003 | Associate an email with an application | M10 | — | Not started |
| EMAIL-004 | Suggest a status change | M10 | — | Not started |

---

## 1. Authentication

### AUTH-001 — Account creation

> The system shall allow a user to create an account using an email and password.

**Acceptance criteria**

- [ ] A valid, unused email with a conforming password creates an account and returns a success response
- [ ] A duplicate email is rejected with `409 Conflict` and no second account is created
- [ ] The stored password is a salted hash; the plaintext appears in no table, log, or API response
- [ ] A malformed email returns `400` with a field-level error
- [ ] A password shorter than 8 characters returns `400` with a field-level error
- [ ] The registration response never contains the password hash

**Depends on:** none · **Blocks:** AUTH-002, AUTH-003

### AUTH-002 — Login

> The system shall allow registered users to log in.

**Acceptance criteria**

- [ ] Correct email + password returns a valid session credential
- [ ] Incorrect password returns `401` with a generic message that does not reveal whether the email exists
- [ ] An unregistered email returns the same generic `401`
- [ ] The issued credential carries an expiry
- [ ] Login attempts are rate-limited per IP

### AUTH-003 — Access control

> The system shall prevent unauthenticated users from accessing private application data.

**Acceptance criteria**

- [ ] Every `/api/*` route except `register`, `login`, and `health` returns `401` without a credential
- [ ] An expired credential returns `401`
- [ ] A malformed or tampered credential returns `401` and is not partially trusted
- [ ] Logout invalidates the credential

---

## 2. Application Management

### APP-001 — Create application

> User can create a job application.

**Required fields:** company, job title, status, job description
**Optional fields:** location, salary, URL, date applied, notes

**Acceptance criteria**

- [ ] Submitting all required fields creates the application and returns it with a generated ID
- [ ] Omitting any required field returns `400` naming the missing field
- [ ] Status defaults to `SAVED` when not supplied
- [ ] The application is owned by the authenticated user and no other user can read it
- [ ] Creation records an `ApplicationEvent` capturing the initial status

### APP-002 — Edit application

**Acceptance criteria**

- [ ] Any editable field can be updated individually
- [ ] Editing another user's application returns `404` (not `403` — existence is not disclosed)
- [ ] `updatedAt` advances on every successful edit

### APP-003 — Delete application

**Acceptance criteria**

- [ ] Deleting removes the application from all list and detail endpoints
- [ ] Associated analyses and status events are removed with it
- [ ] Associated resumes and cover letters are **not** deleted — they belong to the user, not the application
- [ ] Deleting another user's application returns `404`

### APP-004 — Change status

**Statuses:** `SAVED` · `APPLIED` · `RECRUITER_SCREEN` · `INTERVIEW` · `OFFER` · `REJECTED` · `WITHDRAWN`

**Acceptance criteria**

- [ ] Status can be changed to any valid value
- [ ] An invalid status value returns `400`
- [ ] Every change writes an `ApplicationEvent` with the previous status, new status, and timestamp
- [ ] The event history is retrievable and ordered

> **Note:** transitions are intentionally unrestricted — a user may move an application backwards or skip stages. Analytics derive from the event history, not from an assumed linear path.

### APP-005 — Search

**Acceptance criteria**

- [ ] Search matches against company and job title
- [ ] Matching is case-insensitive and substring-based
- [ ] Search is scoped to the authenticated user
- [ ] An empty query returns all applications rather than none

### APP-006 — Filter by status

**Acceptance criteria**

- [ ] Filtering by one status returns only applications in that status
- [ ] Filtering by multiple statuses returns the union
- [ ] Filter composes with search rather than overriding it
- [ ] No filter returns all applications

---

## 3. Resume Management

### RES-001 — Upload multiple resumes

**Acceptance criteria**

- [ ] A user can upload more than one resume and all appear in their list
- [ ] Accepted types: PDF, DOCX
- [ ] A file over 5 MB is rejected with `400`
- [ ] An unsupported type is rejected with `400`
- [ ] File metadata (name, size, type, storage key, upload time) is persisted
- [ ] A user cannot list or download another user's resume

### RES-002 — Name and version resumes

**Acceptance criteria**

- [ ] A label is required at upload time (e.g. `Software Engineer Resume v4`)
- [ ] An optional version string may be supplied
- [ ] The label can be renamed after upload without affecting existing analyses
- [ ] Resumes list in reverse-chronological order by default

### RES-003 — Associate a resume with an application

**Acceptance criteria**

- [ ] An application can have at most one resume attached
- [ ] The attached resume can be changed or cleared
- [ ] Only a resume owned by the same user can be attached
- [ ] The application detail view shows the attached resume's label
- [ ] Deleting a resume that is attached to applications clears the attachment rather than deleting those applications

---

## 4. Cover Letters

### DOC-001 — Upload cover letters

**Acceptance criteria**

- [ ] Same type, size, and ownership rules as RES-001
- [ ] Cover letters are listed separately from resumes

### DOC-002 — Associate a cover letter with an application

**Acceptance criteria**

- [ ] An application can have at most one cover letter attached
- [ ] The application detail view shows company, role, attached resume label, and attached cover letter label together

---

## 5. Analytics

> **Definitions below are proposed, not given.** The source plan names these metrics without defining them. Confirm or adjust before implementing Milestone 7 — the definitions determine the schema queries.

All metrics are scoped to the authenticated user and computed from `ApplicationEvent` history, not from current status alone.

### ANA-001 — Total applications

- [ ] Returns a count of all the user's applications
- [ ] A user with no applications receives `0`, not an error

### ANA-002 — Applications by status

- [ ] Returns a count per status, by *current* status
- [ ] Statuses with zero applications appear with a count of `0` rather than being omitted

### ANA-003 — Response rate

**Proposed definition:** applications that ever reached `RECRUITER_SCREEN` or beyond, divided by applications that ever reached `APPLIED` or beyond. Applications still in `SAVED` are excluded from both sides.

- [ ] Returns a percentage
- [ ] A zero denominator returns `null`, not a division error
- [ ] An application that was rejected after a recruiter screen still counts as a response

### ANA-004 — Interview conversion rate

**Proposed definition:** applications that ever reached `INTERVIEW` or beyond, divided by applications that ever reached `RECRUITER_SCREEN` or beyond.

- [ ] Returns a percentage
- [ ] A zero denominator returns `null`

### ANA-005 — Average response time

**Proposed definition:** mean elapsed days from the `APPLIED` event to the first status change following it, across applications that received one. Applications with no response are excluded rather than counted as infinite.

- [ ] Returns a number of days
- [ ] Applications with no response are excluded from the mean
- [ ] Returns `null` when no application has a response

### ANA-006 — Activity over time

- [ ] Returns application counts bucketed by day or week over a selectable range
- [ ] Buckets with no activity appear with a count of `0` so charts do not skip periods

---

## 6. AI

### AI-001 — Job / resume analysis

**Input:** resume text + job description
**Output:** match score, strengths, missing skills, relevant experience, summary

**Acceptance criteria**

- [ ] Analysis can only run on an application that has a resume attached; otherwise `400` explaining why
- [ ] Match score is an integer 0–100
- [ ] Strengths and missing skills are returned as lists
- [ ] Results persist and are retrievable without re-running the analysis
- [ ] An AI provider failure returns a clear error and stores no partial analysis
- [ ] The same application may be analyzed repeatedly; every run is retained

### AI-002 — Interview questions

**Acceptance criteria**

- [ ] Questions generate from the job description alone; no resume is required
- [ ] Output is a list of discrete questions
- [ ] Results persist against the application

### AI-003 — Analysis provenance

> AI analysis must be associated with the specific application and resume version used.

**Acceptance criteria**

- [ ] Every stored analysis records both the application ID and the exact resume ID used
- [ ] Renaming a resume afterwards does not alter which resume an existing analysis cites
- [ ] Uploading a newer resume does not modify or invalidate existing analyses
- [ ] The UI displays which resume each analysis was run against
- [ ] The model identifier and provider used are recorded alongside the result

> **Design consequence:** an uploaded file is immutable. Replacing a resume means uploading a new record, never overwriting an existing one. Overwriting would silently break the provenance chain this requirement exists to guarantee.

---

## 7. Non-Functional Requirements

> Added here because Phase 14's security tests and Phase 17's acceptance checklist need concrete criteria to point at.

### NFR-001 — Password storage

- [ ] Passwords are hashed with bcrypt or argon2 and a per-user salt
- [ ] No endpoint, log line, or error message contains a plaintext password

### NFR-002 — Data isolation

- [ ] Every query that reads user-owned data filters on the authenticated user ID
- [ ] An integration test attempts cross-account access on every resource type and receives `404`
- [ ] A user ID supplied in a request body is never trusted over the one in the credential

### NFR-003 — Input validation

- [ ] Every write endpoint validates its body against a schema before touching the database
- [ ] Validation failures return `400` with field-level detail
- [ ] String fields have maximum lengths enforced

### NFR-004 — Upload safety

- [ ] File type is verified by content, not by extension alone
- [ ] Size limits are enforced before the file is fully buffered
- [ ] Stored filenames are generated, never taken from user input

---

## 8. Post-MVP Requirements

### EXT-001 / EXT-002 / EXT-003 — Chrome extension

- [ ] The extension captures company, job title, location, URL, and job description from a supported page
- [ ] It authenticates against the same API as the web client
- [ ] A captured job appears in the user's tracker with status `SAVED`
- [ ] Capture failure on an unsupported page degrades to a manual form rather than erroring silently

### EMAIL-001 — EMAIL-004 — Email integration

- [ ] A user can connect a supported email account via OAuth and disconnect it
- [ ] Tokens are stored encrypted and refreshed without user involvement
- [ ] Job-related emails are identified and matched to an existing application where possible
- [ ] A status change is **suggested** with confirm and dismiss actions; the system never changes status autonomously
- [ ] A dismissed suggestion does not reappear for the same email

---

## Open Questions

1. **Analytics definitions** — are the proposed formulas in section 5 the ones you want?
2. **Session strategy** — JWT or server-side sessions? Affects AUTH-002 and the extension's auth in EXT-002.
3. **Resume text extraction** — AI-001 needs the resume as text. Extract at upload time and store it, or extract on demand at analysis time?
4. **File storage in development** — local disk or S3 from day one?
