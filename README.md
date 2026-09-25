# AI Job Application Tracker

A full-stack job search tracker with an Express API and a React frontend. The repository includes the product requirements, architecture, implementation plan, and API contract.

## Current Status

The backend API is implemented for authentication, application management, document management, analytics, and mock AI analysis. Its test suite previously passed 17 tests across five test files.

The frontend currently has a responsive dashboard, Board, Stats, and application create/edit/delete flows. It still uses sample data in browser memory; it is not connected to the backend, so changes do not persist after a reload. The upcoming items and source breakdown are also sample data.

The project is not yet a complete or deployed product.

## Remaining Work

1. **Frontend authentication and API client**
   - Build registration and sign-in screens.
   - Connect authentication to the backend and handle the user session.
   - Configure the frontend API base URL and verify local CORS settings.

2. **Persistent application management**
   - Replace frontend fixture data with the applications API.
   - Connect list, search, status filtering, create, edit, status change, and delete flows.
   - Verify application changes survive a page reload.

3. **Documents, analytics, and AI screens**
   - Build resume and cover-letter upload and association workflows.
   - Replace dashboard sample metrics and upcoming items with real API data.
   - Connect analytics and add job/resume analysis and interview-question views.

4. **Integration testing and traceability**
   - Add end-to-end tests for authentication and the main application workflows.
   - Verify document, analytics, and AI flows through the frontend.
   - Reconcile implementation and test statuses in [REQUIREMENTS.md](REQUIREMENTS.md).

5. **Production readiness and deployment**
   - Choose and configure production AI and file-storage providers.
   - Set production secrets and database configuration outside source control.
   - Deploy the frontend, backend, and database; verify migrations, backups, and access controls.

## Project Documents

- [Requirements and traceability](REQUIREMENTS.md)
- [Architecture](ARCHITECTURE.md)
- [Implementation plan](IMPLEMENTATION_PLAN.md)
- [API contract](API.md)
