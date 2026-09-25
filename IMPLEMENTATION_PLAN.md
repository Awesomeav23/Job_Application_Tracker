# AI Job Application Tracker — Implementation Plan

**Status:** Planning
**Last updated:** 2026-09-25

---

## Table of Contents

- [Phase 0: Project Definition](#phase-0-project-definition)
- [Phase 1: Authentication Requirements](#phase-1-authentication-requirements)
- [Phase 2: Application Management Requirements](#phase-2-application-management-requirements)
- [Phase 3: Resume Management](#phase-3-resume-management)
- [Phase 4: Cover Letters](#phase-4-cover-letters)
- [Phase 5: Analytics](#phase-5-analytics)
- [Phase 6: AI Requirements](#phase-6-ai-requirements)
- [Phase 7: Chrome Extension](#phase-7-chrome-extension)
- [Phase 8: Email Integration](#phase-8-email-integration)
- [Phase 9: Technical Design](#phase-9-technical-design)
- [Phase 10: Database Design](#phase-10-database-design)
- [Phase 11: API Design](#phase-11-api-design)
- [Phase 12: UI/UX Design](#phase-12-uiux-design)
- [Phase 13: Implementation Milestones](#phase-13-implementation-milestones)
- [Phase 14: Testing](#phase-14-testing)
- [Phase 15: CI/CD](#phase-15-cicd)
- [Phase 16: Deployment](#phase-16-deployment)
- [Phase 17: Final Acceptance](#phase-17-final-acceptance)
- [Phase 18: Documentation](#phase-18-documentation)
- [Condensed Plan](#condensed-plan)

---

## Phase 0: Project Definition

Before opening VS Code, define what you're actually building.

### 0.1 Problem

Job seekers often track applications manually across spreadsheets, emails, bookmarks, resumes, and job sites. The application should centralize that information and reduce manual work.

### 0.2 Target User

Individual job seekers managing multiple applications.

### 0.3 Primary Goal

Build a full-stack platform that lets users:

- Track job applications
- Save job descriptions
- Associate specific resume / cover-letter versions
- Analyze job/resume compatibility
- Automatically identify relevant application emails
- View application analytics

### 0.4 Success Criteria (MVP)

- [ ] User can create an account
- [ ] User can create and manage applications
- [ ] User can upload resumes
- [ ] User can associate a resume with an application
- [ ] User can see application statistics
- [ ] User can run an AI analysis
- [ ] All user data is isolated between accounts

### 0.5 Out of Scope for MVP

Explicitly defining what is *not* included prevents scope creep. Not in version 1:

- Mobile app
- Automatic job applications
- Scraping LinkedIn / Indeed
- Fully autonomous email status changes
- Complex recommendation algorithms
- Multi-user organizations
- Payment / subscription system

These become future features.

---

## Phase 1: Authentication Requirements

Requirements get identifiers so they can be traced through design and testing.

### AUTH-001 — Account creation

The system shall allow a user to create an account using an email and password.

**Acceptance criteria**

- Valid email + password creates an account
- Duplicate email is rejected
- Password is never stored in plaintext
- Invalid input returns an appropriate error

### AUTH-002 — Login

The system shall allow registered users to log in.

### AUTH-003 — Access control

The system shall prevent unauthenticated users from accessing private application data.

---

## Phase 2: Application Management Requirements

### APP-001 — Create application

User can create a job application.

| Required | Optional |
| --- | --- |
| Company | Location |
| Job title | Salary |
| Status | URL |
| Job description | Date applied |
| | Notes |

### APP-002 — Edit application

User can edit an application.

### APP-003 — Delete application

User can delete an application.

### APP-004 — Change status

User can change application status. Statuses:

- Saved
- Applied
- Recruiter Screen
- Interview
- Offer
- Rejected
- Withdrawn

### APP-005 — Search

User can search applications.

### APP-006 — Filter

User can filter applications by status.

---

## Phase 3: Resume Management

### RES-001 — Multiple resumes

User can upload multiple resumes.

### RES-002 — Naming / versioning

User can name and version resumes, for example:

- Software Engineer Resume v4
- AI Engineer Resume v2
- Cloud Engineer Resume v3

### RES-003 — Association

User can associate a specific resume with an application. This is one of the features that makes the project substantially more interesting than a spreadsheet.

---

## Phase 4: Cover Letters

### DOC-001 — Upload cover letters

User can upload cover letters.

### DOC-002 — Association

User can associate a specific cover letter with an application.

An application then shows:

```
Application
────────────────────────

Company: Lennar
Role: Software Engineer I

Resume:
Software Engineer Resume v4

Cover Letter:
Lennar Cover Letter v2
```

---

## Phase 5: Analytics

| ID | Requirement |
| --- | --- |
| ANA-001 | System shall calculate total applications |
| ANA-002 | System shall calculate applications by status |
| ANA-003 | System shall calculate response rate |
| ANA-004 | System shall calculate interview conversion rate |
| ANA-005 | System shall calculate average response time |
| ANA-006 | System shall display application activity over time |

This is where the dashboard becomes more than "47 applications" — it provides useful information about the user's job search.

---

## Phase 6: AI Requirements

Define exactly what "AI" means. Don't just write "use AI."

### AI-001 — Job/resume analysis

User can request an analysis of a job against an associated resume.

**Input:** Resume + Job Description

**Output:**

- Match score
- Strengths
- Missing skills
- Relevant experience
- Summary

### AI-002 — Interview questions

User can generate interview questions based on a job description.

### AI-003 — Analysis provenance

AI analysis must be associated with the specific application *and* resume version used.

Not this:

```
Application → Random AI Analysis
```

But this:

```
Application
   ↓
Resume v4
   ↓
Analysis #1
```

If the user later uploads Resume v5, they can run another analysis.

---

## Phase 7: Chrome Extension

A Phase 2 feature, not an MVP requirement.

### EXT-001 — Save a job

User can save a job from a supported webpage using the browser extension. The extension captures:

- Company
- Job title
- Location
- URL
- Job description

### EXT-002 — Send to backend

Extension sends captured information to the authenticated backend.

### EXT-003 — Appears in tracker

Application appears in the user's tracker.

**Architecture**

```
Job Website
     ↓
Chrome Extension
     ↓
REST API
     ↓
PostgreSQL
```

A strong full-stack addition: you're now building another client that consumes your API.

---

## Phase 8: Email Integration

A later milestone.

| ID | Requirement |
| --- | --- |
| EMAIL-001 | User can connect a supported email account |
| EMAIL-002 | System can identify job-related emails |
| EMAIL-003 | System attempts to associate an email with an existing application |
| EMAIL-004 | System suggests a status change |

Example suggestion:

```
Possible status update

Lennar
Software Engineer I

Detected:
Interview invitation

Current status:
Applied

Suggested:
Recruiter Screen

[Confirm] [Dismiss]
```

Automatic status changes are deliberately **not** the initial design. User confirmation makes the workflow safer and easier to reason about.

---

## Phase 9: Technical Design

Only after requirements are defined should the architecture be finalized. A proper design phase covers architecture, API contracts, database design, and user flows.

```
                    ┌───────────────────┐
                    │   React + TS      │
                    │    Frontend       │
                    └─────────┬─────────┘
                              │
                           REST API
                              │
                    ┌─────────▼─────────┐
                    │ Node + Express    │
                    │    Backend        │
                    └────┬──────┬───────┘
                         │      │
                    ┌────▼─┐ ┌─▼────────┐
                    │Postgres│ AI Service│
                    └───────┘ └────┬─────┘
                                   │
                              ┌────▼─────┐
                              │ Bedrock  │
                              └──────────┘
```

---

## Phase 10: Database Design

Create the ERD before writing all the database code.

**Core entities**

```
User
 │
 ├──── Application
 │          │
 │          ├──── Analysis
 │          │
 │          ├──── Resume
 │          │
 │          └──── Cover Letter
 │
 ├──── Resume
 │
 └──── Cover Letter
```

**Potential tables**

- `users`
- `applications`
- `resumes`
- `cover_letters`
- `analyses`
- `application_events`
- `email_messages`

Not all of these need to exist in version 1.

---

## Phase 11: API Design

Define the API before implementing it.

```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout

GET    /api/applications
POST   /api/applications
GET    /api/applications/:id
PUT    /api/applications/:id
DELETE /api/applications/:id

GET    /api/resumes
POST   /api/resumes
DELETE /api/resumes/:id

POST   /api/applications/:id/analyze

GET    /api/analytics
```

Later:

```
POST /api/email/connect
POST /api/email/sync
POST /api/extension/jobs
```

This is more deliberate than creating endpoints whenever you need them.

---

## Phase 12: UI/UX Design

Define the user flows before coding every page.

**Flow: Add application**

```
Dashboard
   ↓
Add Application
   ↓
Enter job information
   ↓
Select resume
   ↓
Save
   ↓
Application details
```

**Flow: AI analysis**

```
Application
   ↓
Select resume
   ↓
Analyze
   ↓
Backend
   ↓
AI service
   ↓
Results
```

**Flow: Extension**

```
Job posting
   ↓
Save to Tracker
   ↓
Extension
   ↓
API
   ↓
Application created
```

---

## Phase 13: Implementation Milestones

Implementation is broken into milestones rather than one giant checklist.

### Milestone 1 — Frontend foundation

Vite · React · TypeScript · Routing · Basic layout · Dashboard · Application pages

**Deliverable:** navigable frontend with mock data.

### Milestone 2 — Backend foundation

Node · Express · TypeScript · API structure · Error handling · Environment configuration · `/health` endpoint

**Deliverable:** functioning API.

### Milestone 3 — Database

PostgreSQL · Prisma · Schema · Migrations · Seed data

**Deliverable:** backend can persist applications.

### Milestone 4 — Full-stack CRUD

```
React
 ↓
Express
 ↓
Prisma
 ↓
PostgreSQL
```

Implement Create, Read, Update, Delete.

**Deliverable:** real application tracker.

### Milestone 5 — Authentication

Registration · Login · Password hashing · Sessions/JWT · Protected endpoints · Authorization

**Deliverable:** multiple users can safely use the application.

### Milestone 6 — Resume / document management

Upload · Store metadata · Versioning · Application association

**Deliverable:** each application knows exactly which documents were used.

### Milestone 7 — Analytics

Backend aggregation · Dashboard cards · Charts · Filtering by time/status

**Deliverable:** useful job-search analytics.

### Milestone 8 — AI

Start with a **mock AI**, then move to **Bedrock**.

### Milestone 9 — Chrome extension

A separate extension that consumes the existing API.

### Milestone 10 — Email integration

Gmail/Outlook integration, email classification, application matching, suggested status changes.

---

## Phase 14: Testing

A proper test plan defines test types, test environments, acceptance criteria, pass/fail criteria, and risks.

### Unit tests

Test individual functions.

### API / integration tests

```
POST /applications
GET  /applications
PUT  /applications/:id
```

### Frontend tests

- Forms
- Filtering
- Application display
- Authentication states

### End-to-end tests

```
Register
 ↓
Login
 ↓
Create application
 ↓
Upload resume
 ↓
Run analysis
 ↓
View results
```

### Security tests

- Unauthorized access
- Invalid tokens
- Password handling
- Input validation
- User data isolation

---

## Phase 15: CI/CD

GitHub Actions:

```
Push
 ↓
Install dependencies
 ↓
Lint
 ↓
Unit tests
 ↓
Integration tests
 ↓
Build
 ↓
Deploy
```

Pull requests fail if tests fail.

---

## Phase 16: Deployment

```
                   Internet
                      │
                ┌─────▼─────┐
                │ Frontend  │
                └─────┬─────┘
                      │
                ┌─────▼─────┐
                │ Backend   │
                └──┬─────┬──┘
                   │     │
             ┌─────▼┐ ┌──▼─────┐
             │ DB   │ │   S3   │
             └──────┘ └────────┘
                         │
                    ┌────▼─────┐
                    │ Bedrock  │
                    └──────────┘
```

Then add:

- Environment variables
- Secrets
- Logging
- Error monitoring
- HTTPS
- Database backups
- Deployment documentation

---

## Phase 17: Final Acceptance

Don't just say "I think it's finished." Keep an acceptance checklist:

| Requirement | Result |
| --- | --- |
| AUTH-001 | PASS |
| AUTH-002 | PASS |
| AUTH-003 | PASS |
| APP-001 | PASS |
| APP-002 | PASS |
| APP-003 | PASS |
| RES-001 | PASS |
| RES-002 | PASS |
| AI-001 | PASS |
| AI-002 | PASS |

That creates a traceability chain:

```
Requirement → Implementation → Test → Result
```

This is a real software engineering practice — AHRQ's development guidance explicitly describes tracing requirements through design and testing.

---

## Phase 18: Documentation

The repository should eventually contain:

- `README.md`
- `ARCHITECTURE.md`
- `API.md`
- `DATABASE.md`
- `TESTING.md`
- `DEPLOYMENT.md`

The README should show:

- What problem it solves
- Features
- Architecture
- Tech stack
- Screenshots
- Setup instructions
- Environment variables
- Testing
- Deployment
- Future improvements

---

## Condensed Plan

```
01  Project Definition
        ↓
02  Requirements
        ↓
03  Acceptance Criteria
        ↓
04  Architecture
        ↓
05  Database Design
        ↓
06  API Design
        ↓
07  UI/UX + User Flows
        ↓
08  Frontend Foundation
        ↓
09  Backend Foundation
        ↓
10  Database
        ↓
11  Full-Stack CRUD
        ↓
12  Authentication
        ↓
13  Resume / Document Management
        ↓
14  Analytics
        ↓
15  AI Analysis
        ↓
16  Chrome Extension
        ↓
17  Email Integration
        ↓
18  Testing
        ↓
19  CI/CD
        ↓
20  Deployment
        ↓
21  Acceptance Testing
        ↓
22  Documentation
```
