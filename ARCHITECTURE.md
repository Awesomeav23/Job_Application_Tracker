# Architecture

**Project:** AI Job Application Tracker
**Last updated:** 2026-09-25
**Companions:** [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) · [REQUIREMENTS.md](REQUIREMENTS.md) · [API.md](API.md)

Structural decisions, made before any code exists. Short by design — this file settles layout and boundaries, nothing more.

---

## 1. Repository: one, not three

**Decision: monorepo.**

Why:

- All three clients share the API contract. One repo means one place it can drift out of sync.
- Types can be shared between frontend and backend without publishing a package.
- One CI pipeline. Phase 15 gets simpler.
- One `git clone` for a reviewer. This is a portfolio project — the reader's first two minutes matter.

The cost:

- The repo root isn't directly deployable. Frontend and backend deploy separately from subdirectories.
- Acceptable. Both Vercel and Render support a subdirectory root.

Not doing: npm workspaces, Turborepo, Nx. Three directories with their own `package.json` is enough at this size. Add tooling when there's pain, not before.

---

## 2. Layout

```
job-application-tracker/
├── frontend/          React + TypeScript + Vite       (M1)
├── backend/           Node + Express + TypeScript     (M2, M3)
│   └── prisma/        schema, migrations, seed
├── extension/         Chrome extension, Manifest v3   (M9)
├── docs/              the .md files in this repo root
└── .github/workflows/ CI                              (M15)
```

`extension/` stays empty until Milestone 9. It's listed now so the layout doesn't get reshaped later.

---

## 3. System shape

```
┌──────────────┐     ┌──────────────┐
│  React SPA   │     │  Extension   │
└──────┬───────┘     └──────┬───────┘
       │                    │
       └────── REST ────────┘
                 │
                 ▼
       ┌──────────────────┐
       │  Express API     │
       │  routes          │
       │  services        │
       │  prisma          │
       └───┬──────────┬───┘
           │          │
     ┌─────▼────┐  ┌──▼──────────┐
     │ Postgres │  │ AI provider │
     └──────────┘  └──────┬──────┘
                          │
                   mock → Bedrock
```

Two clients, one API. That's the point of the extension — it proves the API is a real interface, not a backend glued to one frontend.

---

## 4. Backend layers

Three layers. Each may only call the one below it.

**Routes** — `backend/src/routes/`
- Parse and validate the request body (Zod).
- Call one service function.
- Map the result to a status code.
- No Prisma calls. No business logic.

**Services** — `backend/src/services/`
- All business logic lives here.
- Owns the rules the database can't express — e.g. the `kind` check on document attachment.
- Takes `userId` as an explicit argument. Never reads the request.
- Returns plain objects, not Express responses.

**Data** — Prisma client
- Called only from services.
- No raw SQL unless an analytics query genuinely needs it.

Why the discipline: services stay unit-testable without HTTP, and the extension and web client hit identical logic because they share the service beneath the route.

---

## 5. Request lifecycle

```
request
  → auth middleware        verify token, attach req.user
  → validation middleware  Zod schema per route
  → route handler          call service with req.user.id
  → service                business rules, Prisma
  → response
  → error middleware       catch, map, log
```

Rules:

- Auth middleware runs before everything except `/health`, register and login.
- `userId` always comes from the token. A `userId` in a request body is ignored. (NFR-002)
- Only the error middleware formats errors. No route builds its own error shape.

---

## 6. Ownership and isolation

The single most important invariant: **every service function that touches user data takes `userId` and filters on it.**

- Not "most". Every one.
- Enforced by convention plus an integration test per resource type that attempts cross-account access. (NFR-002)
- Cross-account reads return `404`, never `403`. Existence isn't disclosed.

---

## 7. The AI boundary

One interface, two implementations.

```ts
interface AiProvider {
  analyzeMatch(resumeText: string, jobDescription: string): Promise<MatchResult>
  generateQuestions(jobDescription: string): Promise<string[]>
}
```

- `MockProvider` — deterministic, no network, no credentials. Milestone 8 starts here.
- `BedrockProvider` — the real one. Same interface.
- Selected by `AI_PROVIDER` env var.

Why it matters:

- The whole app can be built and tested without AWS credentials.
- Tests never call a paid API.
- Every stored analysis records `provider` and `modelId`, so mock results stay identifiable once real ones exist. Without that column your first dashboard silently mixes fake scores with real ones.

---

## 8. File storage

- Metadata in Postgres. Files never in Postgres.
- One `StorageProvider` interface, same pattern as AI.
- `LocalDiskProvider` for development — `backend/uploads/`, gitignored.
- `S3Provider` for production.
- Downloads are served **through the API**, not from a public bucket URL, so ownership is checked on every request.
- Stored filenames are generated. User input never becomes a path. (NFR-004)

---

## 9. Configuration

- All config from environment variables. No config files with secrets.
- Validate the whole environment at boot with Zod. Crash immediately on a missing variable rather than failing at first use.
- `.env.example` is committed. `.env` is not.

**Postgres runs on port 5435.**

- 5432, 5433 and 5434 are already taken on this machine.
- 5433 is the Pet Services / Pitchwise collision — don't repeat it.
- Own Docker container, own database name, own port.

---

## 10. Deliberately not doing

Worth recording so these read as decisions, not oversights:

- **No repository pattern over Prisma.** Prisma is already the abstraction. Wrapping it adds a layer that only forwards calls.
- **No GraphQL.** REST matches the plan, the extension, and the requirement list.
- **No Docker for the app itself in development.** Postgres in Docker, app on the host. Faster reload.
- **No microservices.** The AI provider is an interface, not a service.
- **No state management library at M1.** React Query when server state needs caching. Zustand only if client state outgrows props.

---

## 11. Deployment shape

Sketch only — Phase 16 owns the detail.

```
frontend  → static host (Vercel or Netlify)
backend   → container host (Render or Fly.io)
database  → managed Postgres, with backups
files     → S3
AI        → Bedrock
```

Both clients talk to one API origin. CORS allows the frontend origin plus the extension origin.

---

## 12. Open

- Resume text extraction: at upload, or lazily at analysis time? Affects whether `422 RESUME_TEXT_UNAVAILABLE` can occur during upload.
- Shared types between frontend and backend: a `shared/` directory, or duplicate the interfaces? Duplication is fine until it drifts once.
