# API Contract

**Project:** AI Job Application Tracker
**Version:** v1 (MVP)
**Last updated:** 2026-09-25
**Companions:** [REQUIREMENTS.md](REQUIREMENTS.md) · [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) · [backend/prisma/schema.prisma](backend/prisma/schema.prisma)

Every endpoint below traces to a requirement ID. This document is the contract between the React client (M1), the Express API (M2) and, later, the Chrome extension (M9) — it exists so the frontend and backend can be built in parallel without inventing two different shapes for the same resource.

---

## Contents

- [Conventions](#conventions)
- [Authentication](#authentication)
- [Applications](#applications)
- [Status & history](#status--history)
- [Documents](#documents)
- [Analytics](#analytics)
- [AI](#ai)
- [System](#system)
- [Post-MVP](#post-mvp)
- [Error reference](#error-reference)
- [Decisions made here](#decisions-made-here)

---

## Conventions

### Base URL

```
/api
```

All endpoints are prefixed `/api` except `GET /health`.

### Authentication

Every endpoint requires a bearer token except `register`, `login` and `health`.

```http
Authorization: Bearer <token>
```

Missing, malformed, or expired tokens return `401`. A token is never partially trusted — a failed signature check rejects the request outright. (AUTH-003)

### Content types

- JSON request bodies: `application/json`
- File uploads: `multipart/form-data`
- All responses: `application/json`, except file downloads

### Identifiers and dates

- IDs are opaque strings (`cuid`). Never assume ordering or parse them.
- All timestamps are ISO 8601 in UTC: `2026-09-25T14:32:00.000Z`
- Dates without a time (e.g. `dateApplied`) are still full ISO timestamps, normalised to midnight UTC.

### Collection responses

Collections are wrapped; single resources are returned bare.

```json
{
  "data": [ /* … */ ],
  "meta": { "total": 47, "limit": 25, "offset": 0 }
}
```

Query parameters `limit` (default `25`, max `100`) and `offset` (default `0`) apply to every collection endpoint.

### Ownership

Every resource is scoped to the authenticated user. Requesting a resource belonging to another user returns **`404`, never `403`** — the API does not disclose that the resource exists. A `userId` supplied in a request body is ignored; ownership always comes from the token. (NFR-002)

### Errors

All errors share one shape:

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Request body failed validation.",
    "fields": {
      "company": "Required",
      "jobTitle": "Must be 200 characters or fewer"
    }
  }
}
```

`fields` is present only on validation errors. See the [error reference](#error-reference).

---

## Authentication

### `POST /api/auth/register` — AUTH-001

Create an account.

**Request**

```json
{
  "email": "avnish@example.com",
  "password": "correct-horse-battery",
  "displayName": "Avnish"
}
```

`displayName` is optional. Password must be at least 8 characters.

**`201 Created`**

```json
{
  "user": { "id": "clx7a…", "email": "avnish@example.com", "displayName": "Avnish", "createdAt": "2026-09-25T14:32:00.000Z" },
  "token": "eyJhbGciOi…",
  "expiresAt": "2026-09-26T14:32:00.000Z"
}
```

The response never contains `passwordHash`. (NFR-001)

**Errors** — `400 VALIDATION_FAILED` · `409 EMAIL_TAKEN`

### `POST /api/auth/login` — AUTH-002

**Request**

```json
{ "email": "avnish@example.com", "password": "correct-horse-battery" }
```

**`200 OK`** — same body as register.

**Errors** — `401 INVALID_CREDENTIALS` (identical for a wrong password and an unknown email, so the response does not reveal which emails are registered) · `429 RATE_LIMITED`

### `POST /api/auth/logout` — AUTH-003

**`204 No Content`**

Adds the token's identifier to a server-side denylist until it expires. Without this, a stolen token stays valid until expiry.

### `GET /api/auth/me` — AUTH-003

Returns the authenticated user. Used by the client on boot to decide between the app and the login screen.

**`200 OK`**

```json
{ "id": "clx7a…", "email": "avnish@example.com", "displayName": "Avnish", "createdAt": "2026-09-25T14:32:00.000Z" }
```

---

## Applications

### The application object

```json
{
  "id": "clx8b…",
  "company": "Lennar",
  "jobTitle": "Software Engineer I",
  "jobDescription": "We are seeking a Software Engineer I to…",
  "status": "APPLIED",
  "location": "Miami, FL",
  "salary": "$95,000 – $110,000",
  "url": "https://careers.lennar.com/jobs/12345",
  "dateApplied": "2026-09-18T00:00:00.000Z",
  "notes": "Referred by a former colleague.",
  "source": "MANUAL",
  "resume": { "id": "clx9c…", "label": "Software Engineer Resume v4", "kind": "RESUME" },
  "coverLetter": { "id": "clx9d…", "label": "Lennar Cover Letter v2", "kind": "COVER_LETTER" },
  "createdAt": "2026-09-18T09:12:00.000Z",
  "updatedAt": "2026-09-22T16:40:00.000Z"
}
```

`resume` and `coverLetter` are embedded summaries, not full document objects, and are `null` when nothing is attached. List responses omit `jobDescription` and `notes` — both can be long, and a list of 50 applications does not need them.

### `GET /api/applications` — APP-005, APP-006

**Query parameters**

| Param | Type | Notes |
| --- | --- | --- |
| `q` | string | Case-insensitive substring match on company and job title. Empty or absent returns everything. |
| `status` | repeated | `?status=APPLIED&status=INTERVIEW` returns the union. Absent returns all statuses. |
| `sort` | enum | `createdAt` (default), `-createdAt`, `company`, `dateApplied` |
| `limit`, `offset` | int | Pagination |

`q` and `status` compose — filtering does not clear the search.

**`200 OK`** — wrapped collection of application objects.

### `POST /api/applications` — APP-001

**Request**

```json
{
  "company": "Lennar",
  "jobTitle": "Software Engineer I",
  "jobDescription": "We are seeking…",
  "status": "SAVED",
  "location": "Miami, FL",
  "salary": "$95,000 – $110,000",
  "url": "https://careers.lennar.com/jobs/12345",
  "dateApplied": "2026-09-18",
  "notes": null,
  "resumeId": "clx9c…",
  "coverLetterId": null
}
```

Required: `company`, `jobTitle`, `jobDescription`. `status` defaults to `SAVED`.

Creation writes the initial `ApplicationEvent` with `fromStatus: null`.

**`201 Created`** — the application object.

**Errors** — `400 VALIDATION_FAILED` · `404 DOCUMENT_NOT_FOUND` (an attached document ID that isn't yours) · `400 WRONG_DOCUMENT_KIND`

### `GET /api/applications/:id`

**`200 OK`** — the full application object, including `jobDescription` and `notes`.

**Errors** — `404 NOT_FOUND`

### `PATCH /api/applications/:id` — APP-002, RES-003, DOC-002

Partial update. Send only the fields you are changing; omitted fields are untouched, and an explicit `null` clears a nullable field.

```json
{ "status": "RECRUITER_SCREEN", "notes": "Screen scheduled for Thursday." }
```

Attaching or clearing documents happens here:

```json
{ "resumeId": "clx9c…", "coverLetterId": null }
```

**`200 OK`** — the updated application.

**Errors** — `400 VALIDATION_FAILED` · `404 NOT_FOUND` · `404 DOCUMENT_NOT_FOUND` · `400 WRONG_DOCUMENT_KIND`

> `WRONG_DOCUMENT_KIND` is returned when a `COVER_LETTER` document is sent as `resumeId`, or vice versa. The database cannot enforce this — a foreign key points at a table, not at a condition on it — so the check lives here. This closes the gap identified in RES-003.

> **Note on method:** the plan specifies `PUT`. This contract uses `PATCH`, because every realistic edit in the UI touches one or two fields, and `PUT` semantics would require the client to send the whole resource back and risk clobbering concurrent changes.

### `DELETE /api/applications/:id` — APP-003

Deletes the application, its status history, its analyses and its interview question sets. Attached documents are **not** deleted — they belong to the user, not to this application.

**`204 No Content`**

**Errors** — `404 NOT_FOUND`

---

## Status & history

### `PATCH /api/applications/:id/status` — APP-004

Status changes get their own endpoint because they write history, and analytics depend on that history existing.

**Request**

```json
{ "status": "INTERVIEW", "note": "Onsite loop scheduled." }
```

**`200 OK`**

```json
{
  "application": { /* updated application object */ },
  "event": {
    "id": "clxa1…",
    "fromStatus": "RECRUITER_SCREEN",
    "toStatus": "INTERVIEW",
    "occurredAt": "2026-09-25T14:32:00.000Z",
    "note": "Onsite loop scheduled."
  }
}
```

Any status may follow any other — a user can move an application backwards or skip stages. Setting the status to its current value is a no-op and writes no event.

**Errors** — `400 INVALID_STATUS` · `404 NOT_FOUND`

### `GET /api/applications/:id/events` — APP-004

**`200 OK`** — wrapped collection of events, oldest first.

---

## Documents

Resumes and cover letters share one collection, distinguished by `kind`.

### The document object

```json
{
  "id": "clx9c…",
  "kind": "RESUME",
  "label": "Software Engineer Resume v4",
  "version": "v4",
  "originalFileName": "avnish-swe-resume-v4.pdf",
  "mimeType": "application/pdf",
  "sizeBytes": 184320,
  "hasExtractedText": true,
  "archivedAt": null,
  "usedByApplications": 3,
  "analysisCount": 2,
  "createdAt": "2026-09-10T11:02:00.000Z"
}
```

`storageKey` and `extractedText` are never exposed. `usedByApplications` and `analysisCount` let the UI warn before a destructive action.

### `GET /api/documents` — RES-001, DOC-001

**Query parameters**

| Param | Type | Notes |
| --- | --- | --- |
| `kind` | enum | `RESUME` or `COVER_LETTER`. Absent returns both. |
| `includeArchived` | bool | Default `false`. |
| `limit`, `offset` | int | Pagination |

Sorted newest first. (RES-002)

### `POST /api/documents` — RES-001, RES-002, DOC-001

`multipart/form-data`:

| Field | Type | Notes |
| --- | --- | --- |
| `file` | file | PDF or DOCX, 5 MB maximum |
| `kind` | string | `RESUME` or `COVER_LETTER` |
| `label` | string | Required, e.g. `Software Engineer Resume v4` |
| `version` | string | Optional |

Type is verified by content, not by file extension. The stored filename is generated, never taken from user input. (NFR-004)

**`201 Created`** — the document object.

**Errors** — `400 VALIDATION_FAILED` · `413 FILE_TOO_LARGE` · `415 UNSUPPORTED_FILE_TYPE`

### `GET /api/documents/:id`

**`200 OK`** — the document object.

### `GET /api/documents/:id/download`

Returns the file with `Content-Disposition: attachment` and the original filename. Served through the API rather than a public bucket URL so ownership is checked on every request.

### `PATCH /api/documents/:id` — RES-002

Renames only. `label` and `version` are the sole editable fields.

```json
{ "label": "Software Engineer Resume v4 (ATS)" }
```

> **The file itself can never be replaced.** Swapping the file behind an existing document would silently invalidate every analysis that cites it. To revise a resume, upload a new document. This is what makes AI-003's provenance guarantee meaningful.

### `POST /api/documents/:id/archive`

Hides a document from the default list without deleting it. Sets `archivedAt`. Applications already referencing it keep their attachment, and analyses keep their provenance.

**`200 OK`** — the document object with `archivedAt` set.

This is the recovery path for a document that cannot be deleted — see below.

### `POST /api/documents/:id/unarchive`

Clears `archivedAt`. **`200 OK`**

### `DELETE /api/documents/:id`

Permanently deletes the document and its stored file.

**`204 No Content`**

**`409 DOCUMENT_IN_USE`** when one or more analyses cite this document:

```json
{
  "error": {
    "code": "DOCUMENT_IN_USE",
    "message": "This resume was used in 2 analyses and cannot be deleted. Archive it instead to hide it from your list.",
    "analysisCount": 2
  }
}
```

The client should offer **Archive** in place of **Delete** when `analysisCount > 0`, rather than letting the user discover the refusal by hitting it.

Detaching from applications is not a reason to refuse — deleting an unanalysed document clears `resumeId` on any application using it and succeeds.

---

## Analytics

### `GET /api/analytics` — ANA-001 … ANA-005

**Query parameters** — `from`, `to` (ISO dates, both optional; default is all time).

**`200 OK`**

```json
{
  "totalApplications": 47,
  "byStatus": {
    "SAVED": 6, "APPLIED": 22, "RECRUITER_SCREEN": 9,
    "INTERVIEW": 5, "OFFER": 1, "REJECTED": 4, "WITHDRAWN": 0
  },
  "responseRate": 0.41,
  "interviewConversionRate": 0.56,
  "averageResponseDays": 8.3,
  "range": { "from": null, "to": null }
}
```

Every status appears in `byStatus`, including those at zero, so the client never has to backfill missing keys.

Rates are fractions between `0` and `1`, or **`null`** when the denominator is zero. `null` means "not enough data yet" and must render as such — never as `0%`.

Definitions, all computed from `ApplicationEvent` history rather than current status:

| Metric | Definition |
| --- | --- |
| `responseRate` | ever reached `RECRUITER_SCREEN`+ ÷ ever reached `APPLIED`+ |
| `interviewConversionRate` | ever reached `INTERVIEW`+ ÷ ever reached `RECRUITER_SCREEN`+ |
| `averageResponseDays` | mean days from the `APPLIED` event to the next status change, over applications that received one |

> These definitions are proposed, not specified — confirm them before building Milestone 7. They are open question 1 in REQUIREMENTS.md.

### `GET /api/analytics/activity` — ANA-006

**Query parameters** — `from`, `to`, `bucket` (`day` or `week`, default `week`).

**`200 OK`**

```json
{
  "bucket": "week",
  "series": [
    { "periodStart": "2026-08-31T00:00:00.000Z", "created": 5, "applied": 4 },
    { "periodStart": "2026-09-07T00:00:00.000Z", "created": 0, "applied": 0 },
    { "periodStart": "2026-09-14T00:00:00.000Z", "created": 9, "applied": 7 }
  ]
}
```

Empty periods are returned with zeroes rather than omitted, so charts show a flat stretch instead of silently closing the gap.

---

## AI

### `POST /api/applications/:id/analyze` — AI-001, AI-003

Runs an analysis of the application's job description against its attached resume. Takes no body — the inputs come from the application's current state, which is what binds the result to a specific resume version.

**`201 Created`**

```json
{
  "id": "clxb2…",
  "applicationId": "clx8b…",
  "document": { "id": "clx9c…", "label": "Software Engineer Resume v4" },
  "matchScore": 72,
  "summary": "Strong alignment on backend fundamentals; the posting's cloud requirements are only partially evidenced.",
  "strengths": ["REST API design in Node and TypeScript", "Relational data modelling", "Prior full-stack ownership"],
  "missingSkills": ["Kubernetes", "Terraform", "Java"],
  "relevantExperience": ["Built a full-stack tracker with Express and PostgreSQL"],
  "provider": "MOCK",
  "modelId": "mock-v1",
  "createdAt": "2026-09-25T14:32:00.000Z"
}
```

`matchScore` is an integer `0`–`100`. Repeated analyses are always permitted and each is retained — re-running never overwrites.

**Errors**

- `400 NO_RESUME_ATTACHED` — "Attach a resume to this application before running an analysis."
- `422 RESUME_TEXT_UNAVAILABLE` — text could not be extracted from the file
- `502 AI_PROVIDER_ERROR` — upstream failure; no partial analysis is stored
- `404 NOT_FOUND`

### `GET /api/applications/:id/analyses` — AI-003

**`200 OK`** — wrapped collection, newest first. Each carries the `document` it ran against, so the UI can show *which* resume produced which score.

### `POST /api/applications/:id/interview-questions` — AI-002

Generates questions from the job description alone. No resume required.

**`201 Created`**

```json
{
  "id": "clxc3…",
  "applicationId": "clx8b…",
  "questions": [
    "Walk me through how you'd design a REST API for a resource with versioned attachments.",
    "How do you decide between a foreign key constraint and application-level validation?"
  ],
  "provider": "MOCK",
  "modelId": "mock-v1",
  "createdAt": "2026-09-25T14:32:00.000Z"
}
```

### `GET /api/applications/:id/interview-questions`

**`200 OK`** — wrapped collection, newest first.

---

## System

### `GET /health`

Unauthenticated. Required by Milestone 2.

**`200 OK`**

```json
{ "status": "ok", "version": "0.1.0", "database": "connected", "uptimeSeconds": 4821 }
```

Returns `503` with `"database": "disconnected"` when the database check fails.

---

## Post-MVP

Sketched so the MVP does not paint itself into a corner. Not implemented before Milestone 9.

### `POST /api/extension/jobs` — EXT-002, EXT-003

Accepts a captured posting from the Chrome extension and creates an application with `status: "SAVED"` and `source: "EXTENSION"`.

```json
{
  "company": "Lennar",
  "jobTitle": "Software Engineer I",
  "location": "Miami, FL",
  "url": "https://careers.lennar.com/jobs/12345",
  "jobDescription": "We are seeking…"
}
```

**`201 Created`** — the application object.

Authenticates with the same bearer token as every other endpoint — which is why the token is a header rather than a cookie.

### Email — EMAIL-001 … EMAIL-004

```
POST   /api/email/connect          begin OAuth
DELETE /api/email/accounts/:id     disconnect
POST   /api/email/sync             pull and classify
GET    /api/email/suggestions      pending status suggestions
POST   /api/email/suggestions/:id/confirm
POST   /api/email/suggestions/:id/dismiss
```

There is deliberately no endpoint that changes a status without confirmation.

---

## Error reference

| Status | Code | Meaning |
| --- | --- | --- |
| 400 | `VALIDATION_FAILED` | Body failed schema validation; see `fields` |
| 400 | `INVALID_STATUS` | Not a member of the status enum |
| 400 | `WRONG_DOCUMENT_KIND` | A cover letter was sent as a resume, or vice versa |
| 400 | `NO_RESUME_ATTACHED` | Analysis requested with no resume on the application |
| 401 | `INVALID_CREDENTIALS` | Wrong password or unknown email |
| 401 | `UNAUTHENTICATED` | Missing, malformed or expired token |
| 404 | `NOT_FOUND` | No such resource, or it belongs to another user |
| 404 | `DOCUMENT_NOT_FOUND` | Referenced document is not yours |
| 409 | `EMAIL_TAKEN` | An account with that email exists |
| 409 | `DOCUMENT_IN_USE` | Cited by analyses; archive instead |
| 413 | `FILE_TOO_LARGE` | Over 5 MB |
| 415 | `UNSUPPORTED_FILE_TYPE` | Not PDF or DOCX |
| 422 | `RESUME_TEXT_UNAVAILABLE` | Text extraction failed |
| 429 | `RATE_LIMITED` | Too many attempts |
| 500 | `INTERNAL_ERROR` | Unhandled; never leaks internals |
| 502 | `AI_PROVIDER_ERROR` | Upstream AI failure |
| 503 | `SERVICE_UNAVAILABLE` | Database unreachable |

---

## Decisions made here

Writing the contract forced four choices that the plan left open. Each is reversible, but the reasoning is recorded so it does not have to be rediscovered.

**1. Bearer tokens, not cookies.** This settles open question 2 in REQUIREMENTS.md. A Chrome extension (EXT-002) posting to the API from a third-party page is painful with `SameSite` cookies and straightforward with an `Authorization` header. The extension requirement decides it.

**2. One token, 24-hour expiry, no refresh token.** A deliberate MVP simplification: the user logs in again the next day. The correct design is a short access token plus a long refresh token, and the upgrade is additive — two new endpoints and a client interceptor. Recorded as a known limitation rather than an oversight.

**3. Status changes get their own endpoint.** They write history, and every analytics metric reads that history. Folding status into the generic `PATCH` invites a code path that updates the column and forgets the event, which would corrupt ANA-003 through ANA-006 silently.

**4. Archive is a first-class action, not an error message.** `DELETE` on a cited document returns `409` with an `analysisCount`, and the client shows **Archive** instead of **Delete** when that count is above zero. This turns the schema's `RESTRICT` guard from a dead end into a supported path — the second fault in the schema review.

### Still open

- Resume text extraction: at upload, or lazily at analysis time? Affects `hasExtractedText` and whether `422 RESUME_TEXT_UNAVAILABLE` can occur at upload instead.
- Whether `GET /api/analytics` should accept a status filter, or whether the client filters client-side.
