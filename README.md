# AI Job Application Tracker

A full-stack job search tracker with an Express API and a React frontend. The repository includes the product requirements, architecture, implementation plan, and API contract.

## Current Status

The backend API is implemented for authentication (with display-name updates and password change), application management, document management with PDF/DOCX/TXT text extraction, analytics, and mock AI analysis. Its test suite previously passed 17 tests across five test files.

The frontend covers registration/sign-in, session restoration, a Dashboard, Board, Applications table with CRUD, Documents (resumes + cover letters with attach/clear on applications), Stats (with analytics API + weekly activity chart), an AI insights tab on each application (job/resume analysis + interview questions, with resume provenance), a Profile page, a Settings page (data export + saved-email + seed controls), and an account dropdown that separates "View profile" from "Sign out".

The project is not yet deployed and still uses a mock AI provider and local disk storage.

## Remaining Work

### Minor polish — resume when you come back

1. **Dynamic topbar date**
   - `frontend/src/App.tsx` hard-codes "Friday, September 25" in the topbar. Replace with today's date via `new Date().toLocaleDateString(...)`.

2. **Reconcile `REQUIREMENTS.md`**
   - Every row still says `Not started` with no test refs. Update the status table to reflect the 17 backend tests and everything shipped this session (auth, applications, documents, analytics, AI screens, profile actions, settings).

### Explicitly deferred

3. **Frontend and end-to-end tests**
   - No `frontend/src/**/*.test.*` files exist. Add Vitest + React Testing Library for the auth flow and the create/edit modal.
   - Add one Playwright test covering: register → create application → change status → reload → verify persisted.
   - Gate CI on `npm test` in both `backend/` and `frontend/`.

4. **Backend `tsc --noEmit` errors**
   - `backend/src/lib/jwt.ts` and `backend/src/routes/auth.ts` have pre-existing strict-type errors that don't affect runtime (dev uses `tsx watch`). Fix before turning on strict CI type-check.

5. **Production readiness**
   - Swap the mock AI service (`backend/src/services/aiService.ts`) for a real provider; record provider + model per AI-003.
   - Swap local disk uploads (`backend/uploads/`) for S3 or equivalent.
   - Move secrets out of source (Postgres URL, JWT secret, AI key, storage creds).
   - Add rate limiting on `/auth/login`.
   - Rotate/invalidate JWTs on password change.
   - Deploy backend + Postgres + frontend; verify migrations and CORS for the prod frontend origin.

6. **Delete account endpoint**
   - The Settings page has a disabled "Delete account" row. Needs a backend `DELETE /auth/me` route (cascade delete applications, documents, analyses) plus the UI wiring.

### Post-MVP (skip unless you want them)

7. Chrome extension: EXT-001, EXT-002, EXT-003.
8. Email integration: EMAIL-001 through EMAIL-004.

## Project Documents

- [Requirements and traceability](REQUIREMENTS.md)
- [Architecture](ARCHITECTURE.md)
- [Implementation plan](IMPLEMENTATION_PLAN.md)
- [API contract](API.md)
