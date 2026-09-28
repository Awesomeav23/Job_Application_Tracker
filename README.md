# AI Job Application Tracker

A full-stack job search tracker with an Express API and a React frontend. The repository includes the product requirements, architecture, implementation plan, and API contract.

## Current Status

The backend API is implemented for authentication (with display-name updates and password change), application management, document management with PDF/DOCX/TXT text extraction, analytics, and mock AI analysis. Its test suite previously passed 17 tests across five test files.

The frontend covers registration/sign-in, session restoration, a Dashboard, Board, Applications table with CRUD, Documents (resumes + cover letters with attach/clear on applications), Stats (with analytics API + weekly activity chart), an AI insights tab on each application (job/resume analysis + interview questions, with resume provenance), a Profile page, a Settings page (data export + saved-email + seed controls), and an account dropdown that separates "View profile" from "Sign out".

The project is not yet deployed and still uses a mock AI provider and local disk storage.

## Remaining Work

### Explicitly deferred

1. **Frontend and end-to-end tests**
   - No `frontend/src/**/*.test.*` files exist. Add Vitest + React Testing Library for the auth flow and the create/edit modal.
   - Add one Playwright test covering: register → create application → change status → reload → verify persisted.
   - Gate CI on `npm test` in both `backend/` and `frontend/`.

2. **Production deployment — attempted, deferred**
   - Backend was configured for Railway (Root Directory `backend`, Build `npm install && npx prisma generate && npm run build`, Start `npx prisma migrate deploy && node dist/server.js`) but Railway's pricing model (no free tier, ~$5/month minimum) made it a bad fit; deferred rather than paid.
   - **Recommended next attempt:** Render (backend, free tier that sleeps when idle) + Neon (Postgres, free forever) + Cloudflare R2 (file storage, free 10 GB) + Vercel (frontend, free).
   - **Already deployment-ready:** `FRONTEND_ORIGIN` and `UPLOAD_ROOT` are wired as env vars in `backend/src/config/env.ts`; secrets are `.env`-based and not in source; `tsc -p tsconfig.json` builds cleanly.
   - **Still needed before real users:** swap `backend/src/services/aiService.ts` mock for a real AI provider, swap local disk uploads for R2/S3 (or a Render volume), rate-limit `/auth/login`, rotate JWTs on password change.

3. **Delete account endpoint**
   - The Settings page has a disabled "Delete account" row. Needs a backend `DELETE /auth/me` route (cascade delete applications, documents, analyses) plus the UI wiring.

### Post-MVP (skip unless you want them)

4. Chrome extension: EXT-001, EXT-002, EXT-003.
5. Email integration: EMAIL-001 through EMAIL-004.

## Project Documents

- [Requirements and traceability](REQUIREMENTS.md)
- [Architecture](ARCHITECTURE.md)
- [Implementation plan](IMPLEMENTATION_PLAN.md)
- [API contract](API.md)
