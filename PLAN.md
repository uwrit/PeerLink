# PeerLink Batch Dashboard Plan

## Context
PeerLink is being rebuilt as a batch dashboard. The previous single-abstract Streamlit prototype is being replaced entirely — Streamlit is out. The user designed a React dashboard mockup in Figma Make (visual/layout reference only — mock data is not authoritative). Real abstracts come from the **ITHS Gravity Forms API** via the existing `gravity_forms_client.py` — which fetches entries, downloads the attached PDF, extracts text, and parses out applicant/COI fields. The source of truth for institutions and matching behavior is `src/agent/reviewer_finder_agent.py` and `src/agent/tools.py`. This plan uses the Figma code as a pure UI scaffold and wires it to the real backend (Gravity Forms + MariaDB + agent).

## Approach: React + FastAPI (Dockerized)

- **Frontend**: Port the Figma Make React layout — it's a complete Vite + TypeScript + Tailwind + shadcn/ui app with React Router and all pages/components built. **Strip all mock data** (fake abstracts, fake institutions list, fake programs, fake user). Replace `PeerLinkContext` mock state with real API calls. Keep the layout, components, styling, and interactions. Served in production as static assets by Nginx.
- **Backend**: Wrap `find_reviewers()` in FastAPI. Add persistence and a background job runner. The authoritative institution list is `INSTITUTIONS` in `reviewer_finder_agent.py`.
- **Containerization**: Three services — `backend` (FastAPI + uvicorn), `frontend` (Nginx serving built Vite bundle + reverse-proxying `/api` to backend), `db` (MariaDB). Orchestrated by a single `docker-compose.yml`. Same stack runs locally and in the cloud — no separate dev/prod configs.
- **CI/CD**: Out of scope for this plan. The eventual GitHub Actions pipeline will build the images from these Dockerfiles and push to the cloud registry. Plan ahead by keeping Dockerfiles self-contained (no bind mounts, no build-time host assumptions).
- **Branch**: Work directly on `dashboard-dev` (the current branch). It already exists for exactly this purpose.

## What the Figma Design Contains

**Stack**: React 18, Vite, TypeScript, React Router 7, Tailwind CSS 4, shadcn/ui (Radix primitives), lucide-react icons. Palette: `#203E84` navy, `#849B6F` sage, `#E8F0DD` light green. Typography: Barlow Condensed.

**Pages** (from `src/app/routes.tsx`):
1. `/` — **DashboardPage**: stats cards, program breakdown, recent activity
2. `/abstracts` — **AbstractsPage**: list + detail panel with per-institution reviewer config form
3. `/match-history` — **MatchHistoryPage**: live activity + past match cycles
4. `/account` — **AccountPage**

**Key components**: `Layout` (sidebar + top bar), `BatchProcessModal` (batch config), `ArchiveCycleModal`, `AbstractDetailPanel`, `AbstractSidePanel`, plus full shadcn/ui set.

**Abstract data model** (`src/app/context/PeerLinkContext.tsx`):
```ts
{
  id: number, applicantName, title, matchStatus, program,
  affiliation, email, phone, invitationSent, acceptedReview,
  submitted, abstract
}
// matchStatus: "unmatched" | "processing" | "in-progress" | "matched"
// program: "Community-Academic Partnerships" | "New Interdisciplinary Academic Partnerships" | "Early-Stage Product Development"
```

**User-controllable matching fields** (per abstract or per batch):
- Multi-select institutions (grouped by state: WA/WY/AK/MT/ID)
- Per-institution reviewer count (1-20)
- Year range (start/end)
- Total reviewers (1-20)

## Matching Flow (MVP: Single-Abstract Only)

The Figma design supports two user flows — single-abstract and batch. **For this plan, only the single-abstract flow is implemented.** Batch is deferred to a follow-up; the backend is designed so adding it later is trivial (see below).

### In scope — Single-abstract matching
- **UI entry point**: `AbstractsPage.tsx` → click an abstract → detail panel → configure institutions/counts/year range → "Find Reviewers" button (`handleFindReviewers`).
- **Use case**: User inspects one abstract, tweaks per-institution counts for that specific proposal, runs matching.
- **Backend call**: `POST /matching/start` with a single `abstract_id`.

### Out of scope — Batch matching (deferred)
- `BatchProcessModal.tsx` and `handleBatchRunMatching` are **not wired up** in this plan. Hide the batch UI controls (checkboxes on the list, "Run Batch" button) or leave them visually but disabled.
- **Backend foresight**: the `POST /matching/start` payload uses `abstract_ids: [id]` (array) even though the MVP sends exactly one. The matcher service already fans out over (abstract × institution) pairs via `asyncio.gather()` + `Semaphore`, so when batch is enabled later it's a frontend-only change — pass a longer array.

## Real Data Shape (Gravity Forms)

Abstracts come from the ITHS Gravity Forms API. `gravity_forms_client.py` already handles fetching, PDF download, text extraction (via `pypdf`), and COI parsing. Per-entry fields we get:

| Backend field | Source | Notes |
|---|---|---|
| `gf_entry_id` | GF `id` | Use as natural key alongside DB `id` |
| `date_updated` | GF `date_updated` | Submission timestamp |
| `title` | GF field `15` | Abstract title |
| `pdf_url` | GF field `19` | PDF with full abstract + proposal |
| `abstract_text` | Extracted from PDF via `extract_pdf_text()` | First 8 pages, may be empty on failure |
| `award_type` (= program) | GF field `49` | Real values below |
| `applicant_name` | GF `96.3` + `96.4` + `96.6` | Already concatenated by `parse_entry()` |
| `applicant_email` | GF field `2` | |
| `exclude_authors` | GF fields `54/58/59/79/80` (name pairs) | COI list — applicant-declared reviewers to exclude |
| `affiliation` | **Derived from email domain** | e.g. `@uw.edu` → UW, `@wsu.edu` → WSU, `@uidaho.edu` → U Idaho. Build a mapping; fall back to the domain if unknown. |
| `phone` | **Not available** | Drop from UI or leave blank. |

**Real program values** (award types from GF field `49`, observed in the 363-entry dataset):
1. `Early-Stage Product Development Award`
2. `New Interdisciplinary Academic Collaborations`
3. `Academic Community Partnerships`

These replace the Figma mockup's "CAP/NIAP/ESPD" labels everywhere in the UI.

## What's Mock vs Real

| Figma mock (discard) | Real source |
|---|---|
| Hardcoded 17 universities in `institutionsByState` | `INSTITUTIONS` dict in `reviewer_finder_agent.py` — exposed via `GET /institutions` |
| Hardcoded 3 programs (CAP, NIAP, ESPD) | Real award types from GF field `49` (see above) — exposed via `GET /programs` |
| `initialAbstracts` array in `PeerLinkContext.tsx` | MariaDB `abstracts` table, populated via GF sync |
| `mockMatchHistory` in `MatchHistoryPage.tsx` | Real match jobs stored in DB |
| Fake `programStats` in `DashboardPage.tsx` | Computed from real abstract/job data |
| "Sarah Johnson / Program Coordinator" in `Layout.tsx` | Placeholder — remove or stub (auth out of scope) |
| `submitForReview()` simulating 4-second state transition | Real API call to `POST /matching/start`; final state surfaced on next `GET /abstracts` / `GET /matching/jobs` fetch |
| Manual-entry as primary abstract source | Real abstracts come from **GF sync**; manual entry is secondary (edge cases only) |
| `phone`, detailed `affiliation` fields in UI | Not in GF data — derive affiliation from email; drop phone |

**Backend capabilities to add:**
- **Gravity Forms sync**: scheduled or on-demand job to fetch new entries, download PDFs, extract text, upsert into `abstracts` table. Reuse existing `gravity_forms_client.py`.
- **Email-to-affiliation mapping**: small lookup table (`@uw.edu` → University of Washington, etc.) so the UI has affiliation data.
- **Multi-institution matching with per-institution counts**: Loop wrapper over existing `find_reviewers()` — one agent call per (abstract × institution) pair. Pass `exclude_authors` from GF COI data to the agent so it omits applicant-declared conflicts.
- Persistence for abstracts and match jobs (MariaDB).
- Job status tracking. Agent log messages are persisted with the job and surfaced via `GET /matching/{job_id}` after the job completes.
- **Auth: out of scope.** Stub the user block in `Layout.tsx`.

## Target Architecture

```
PeerLink/
  backend/
    main.py                   # FastAPI app entry
    routers/
      abstracts.py            # GET/POST/PATCH /abstracts
      matching.py             # POST /matching/start, GET /matching/{job_id}
      institutions.py         # GET /institutions, GET /programs
      sync.py                 # POST /sync/gravity-forms (trigger GF ingest)
    services/
      matcher.py              # Multi-institution loop over find_reviewers()
      job_manager.py          # MatchJob lifecycle + status updates
      gf_sync.py              # Uses gravity_forms_client.py to pull & upsert abstracts
      affiliations.py         # Email domain → institution name map
    models.py                 # SQLModel tables
    db.py                     # MariaDB engine + session dependency
    config.py                 # Env config
    Dockerfile                # Python 3.12-slim, installs requirements, runs uvicorn
    .dockerignore
  frontend/                   # Ported from Figma Make (mock data stripped)
    src/
      app/                    # pages/, components/, context/, routes.tsx
      api/                    # NEW: API client
      lib/                    # NEW: shared types/utilities
    vite.config.ts            # Dev proxy /api to backend
    package.json
    Dockerfile                # Multi-stage: node:20 build → nginx:alpine serve
    nginx.conf                # SPA fallback + reverse-proxy /api to backend service
    .dockerignore
  docker/
    mariadb/
      init.sql                # Creates peerlink db + user on first boot
  docker-compose.yml          # backend, frontend, db services + shared network/volume (single config — same locally and in cloud)
  .env.example                # Template — committed; real .env git-ignored
  gravity_forms_client.py     # EXISTING — reused by backend/services/gf_sync.py
  src/                        # Existing Python (unchanged)
    agent/reviewer_finder_agent.py
    agent/tools.py
    agent/prompt.py
  requirements.txt            # Remove streamlit; add: fastapi, uvicorn[standard], sqlmodel, pymysql, pypdf
  .env                        # DATABASE_URL, GF_CONSUMER_KEY, GF_CONSUMER_SECRET, ANTHROPIC_API_KEY, OPENALEX_EMAIL, MARIADB_* — git-ignored
```

## Docker Topology

Single `docker-compose.yml` used everywhere — local machine and cloud. No override file, no dev/prod split.

| Service | Image | Ports | Depends on | Notes |
|---|---|---|---|---|
| `db` | `mariadb:11` | `3306` (internal only) | — | **Temporary** — runs as a compose service with named volume `db_data` until the real MariaDB instance is provisioned. Init SQL in `docker/mariadb/init.sql` creates the `peerlink` schema and app user. Healthcheck via `mysqladmin ping`. When the real instance is ready: remove this service from compose and point `DATABASE_URL` at it — no code changes. |
| `backend` | Built from `backend/Dockerfile` | `8000` (internal) | `db` (healthy) | Python 3.12-slim. `COPY backend/ src/ gravity_forms_client.py` into the image, `pip install -r requirements.txt`. Entrypoint: `uvicorn backend.main:app --host 0.0.0.0 --port 8000`. Reads `DATABASE_URL`, `GF_CONSUMER_KEY`, `GF_CONSUMER_SECRET`, `ANTHROPIC_API_KEY`, `OPENALEX_EMAIL` from env. |
| `frontend` | Built from `frontend/Dockerfile` | `80:80` (exposed) | `backend` | Multi-stage: `node:20-alpine` runs `npm ci && npm run build`; `nginx:alpine` serves `/dist`. `nginx.conf` handles SPA fallback and reverse-proxies `/api/*` → `backend:8000`. |

**Key principles for container self-containment** (so the same images run in cloud unchanged):
- No bind mounts — code is `COPY`d into images at build time.
- No host-relative paths in compose.
- All secrets/config via env vars (`env_file: .env` in compose; cloud env will inject via the pipeline's secrets).
- Exposed port surface is minimal: only `:80` (frontend). `backend:8000` and `db:3306` stay on the internal network.

**Image naming (for when CI/CD is added later):** kept generic — `peerlink-backend`, `peerlink-frontend`. Registry choice and tagging strategy will be decided alongside the future pipeline work.

## Implementation Steps

### Phase 1: Backend Scaffold + Docker Skeleton
(Work directly on `dashboard-dev`.)
1. Create `backend/` directory with FastAPI skeleton
2. Add `backend/Dockerfile` (Python 3.12-slim, `pip install -r requirements.txt`, `COPY` source, runs uvicorn). No bind mounts — fully self-contained.
3. Add root `docker-compose.yml` with `db` (mariadb:11) + `backend` services, shared internal network, `db_data` named volume, `docker/mariadb/init.sql` for schema creation
4. Add `.env.example` (committed) and ensure `.env` is git-ignored. Compose pulls real values via `env_file: .env`.
5. Install deps in `requirements.txt`: `fastapi`, `uvicorn[standard]`, `sqlmodel`, `pymysql`, `pypdf`
6. Define SQLModel tables in `backend/models.py` (see schema below)
7. On startup, `SQLModel.metadata.create_all(engine)` to materialize tables
8. Smoke test: `docker compose up db backend` → `curl localhost:8000/health` returns OK, tables exist in MariaDB

### Phase 2: Gravity Forms Ingestion
5. Create `backend/services/gf_sync.py` wrapping `GravityFormsClient`. For each entry:
   - `parse_entry()` → structured dict
   - `download_pdf()` + `extract_pdf_text(max_pages=8)` → abstract text
   - Map email domain to institution via `affiliations.py`
   - UPSERT into `abstracts` by `gf_entry_id`; store `exclude_authors` as JSON
6. `POST /sync/gravity-forms` — trigger sync (foreground for MVP, background task later)
7. First run populates the 363 existing entries; subsequent runs pick up new submissions

### Phase 3: Backend Endpoints
8. `GET /institutions` — returns `INSTITUTIONS` from `reviewer_finder_agent.py`, grouped by state for UI
9. `GET /programs` — returns the 3 real award types from GF data
10. `GET /abstracts` — list abstracts (filter by status, program)
11. `PATCH /abstracts/{id}` — update fields (invitation_sent, accepted_review, etc.)
12. `POST /matching/start` — `{ abstract_ids, institutions: [{name, count}], year_from, year_to, total_reviewers }`. Creates job, kicks off background task, returns `job_id`.
13. `GET /matching/{job_id}` — returns job status, results, and persisted agent logs

### Phase 4: Multi-Institution Matcher Wrapper
14. In `backend/services/matcher.py`: for each (abstract × institution) pair, call `find_reviewers(abstract_text, institution, num_reviewers, year_from, year_to, exclude_authors=abstract.exclude_authors)`. Fan out with `asyncio.gather()`, bound overall concurrency with `asyncio.Semaphore(2)` for API rate limits.
15. **Pass COI exclusion list**: the `exclude_authors` from the GF entry (applicant-declared conflicts) must be threaded through to `find_reviewers()` so the agent's system prompt excludes them. This likely means adding an `exclude_authors` parameter to `find_reviewers()` — verify the current signature accepts it or extend it.
16. Aggregate per-abstract results into merged records grouped by institution. Persist agent log messages with the job; status and logs become readable via `GET /matching/{job_id}` after the job completes.
17. Progress model: `job.progress = { abstract_id: { institution: "pending"|"running"|"done"|"error" } }`, updated as each institution completes.

### Phase 5: Port Frontend (strip mocks, wire to real API) + Frontend Dockerfile
19. Create `frontend/` dir. Copy Figma Make `src/` into `frontend/src/`. Keep the existing `package.json` from Figma.
20. Add `vite.config.ts` with dev proxy:
    ```ts
    server: { proxy: { '/api': 'http://localhost:8000' } }
    ```
21. Create `frontend/src/api/client.ts` — fetch wrappers
22. Create `frontend/src/lib/types.ts` — shared client-side types (if needed beyond what `api/client.ts` already exports)
23. **Strip mocks**:
    - `PeerLinkContext.tsx`: delete `initialAbstracts` and fake `setTimeout` transitions. Rewrite to fetch from API. Keep exported interface unchanged.
    - `AbstractsPage.tsx`: delete local `institutionsByState` arrays; fetch from `GET /institutions`. Hide/disable the batch-selection checkboxes and "Run Batch" button — single-abstract only for MVP.
    - `BatchProcessModal.tsx`: leave file in place but do not wire it up; remove its trigger from the UI.
    - `DashboardPage.tsx`: delete hardcoded `programStats`, `recentActivity`, `totalStats`; compute from real data.
    - `MatchHistoryPage.tsx`: delete `mockMatchHistory`; fetch real cycles.
    - `Layout.tsx`: remove/stub "Sarah Johnson" user block.
    - All pages: replace mock program labels (CAP/NIAP/ESPD) with real award types from `GET /programs`.
    - Remove the "phone" field from UI (not in GF data); keep affiliation (derived from email domain).
24. Wire `handleFindReviewers` (single-abstract) to `POST /matching/start`. Do **not** wire `handleBatchRunMatching` — batch is deferred.
25. Add a "Sync from Gravity Forms" button somewhere (likely Dashboard or Account page) that calls `POST /sync/gravity-forms`.
26. Add `frontend/Dockerfile` (multi-stage: build with node:20-alpine, serve with nginx:alpine) and `frontend/nginx.conf` (SPA fallback + `/api` reverse-proxy to `backend:8000`).
27. Add the `frontend` service to `docker-compose.yml`.

### Phase 6: Run Everything
28. `docker compose up --build` → db + backend + frontend come up. Only `:80` (frontend) is exposed; backend and db are reachable only on the internal network.
29. First-time setup: `curl -X POST localhost/api/sync/gravity-forms` to populate ~363 abstracts (Nginx proxies to backend).
30. Open http://localhost — Nginx serves React and proxies `/api` to backend.
31. **Code-change workflow**: edit → `docker compose up --build` (or `docker compose build && docker compose up`) to rebuild the image. No hot reload; same as what will run in the cloud.

## Critical Files to Reference/Modify

**Existing backend** (don't break):
- `src/agent/reviewer_finder_agent.py` — `find_reviewers()` is the core function the matcher wrapper will call. `INSTITUTIONS` dict is the authoritative institution list. May need to accept an `exclude_authors` parameter for COI.
- `src/agent/tools.py` — unchanged
- `gravity_forms_client.py` — reused by `backend/services/gf_sync.py`. `GravityFormsClient`, `extract_pdf_text()`, `parse_entry()` are the key exports.

**Files to delete**:
- `app.py` — old Streamlit entrypoint, no longer used.
- Any Streamlit-specific config (e.g. `.streamlit/`) if present.
- `streamlit` entry in `requirements.txt`.

**Figma Make source** (port verbatim, then adapt):
- `src/app/App.tsx`, `src/app/routes.tsx` — copy as-is
- `src/app/context/PeerLinkContext.tsx` — rewrite internals, keep interface (`abstracts`, `submitForReview`, `updateAbstract`, `liveMatchEntries`)
- `src/app/pages/AbstractsPage.tsx` — uses per-institution reviewer counts; `handleFindReviewers` calls `POST /matching/start`. Batch-selection UI hidden/disabled for MVP.
- `src/app/components/BatchProcessModal.tsx` — left in tree, not wired for MVP (batch is deferred).
- `src/app/components/Layout.tsx`, all `components/ui/*` — copy as-is
- `src/styles/*.css` — copy as-is

## Verification

1. **Compose build**: `docker compose build` — both images build clean with no warnings that block the run.
2. **Dev stack up**: `docker compose up` — all three services reach healthy; backend logs show DB connection established; frontend loads at http://localhost.
3. **GF sync**: `POST /sync/gravity-forms` → verify 363 abstracts populate in DB with extracted text from PDFs. Spot-check a few entries: title, applicant_name, affiliation (derived), exclude_authors all populated correctly.
4. **Backend units**: `pytest backend/` — test `/institutions`, `/abstracts` CRUD, `/matching/start` creates a job.
5. **Single-abstract matching**: select an abstract → detail panel → pick 2 institutions with counts 3/2 → verify backend makes 2 `find_reviewers` calls, `exclude_authors` passed through → results grouped by institution.
6. **Batch UI hidden**: confirm batch-selection checkboxes and "Run Batch" button are not present/active on `AbstractsPage` (deferred feature).
7. **Job completion**: after a match job finishes, navigate to `/match-history` and confirm the job appears under Completed with reviewers grouped by institution and the persisted agent logs accessible.
8. **Programs**: verify program filter dropdown shows the 3 real GF award types (not the CAP/NIAP/ESPD mock labels).
9. **Self-contained image check**: build images on a clean machine (no source bind-mounts needed) and confirm the stack still runs end-to-end — this is exactly how the future CI/CD pipeline will ship them to the cloud.

## Deferred (later work)

- **Batch matching flow**: `BatchProcessModal`, multi-abstract selection, `handleBatchRunMatching`. Backend already accepts an array of `abstract_ids`, so this is a frontend-only follow-up.
- **CI/CD pipeline**: GitHub Actions workflow that builds these Dockerfiles and pushes images to the cloud registry on merge. Added once the deployment target and registry are chosen.
- **Domain + TLS**: Decided when deployment target is chosen.

## Resolved Decisions
- **Per-institution counts**: Real feature. Implement via Option A (wrapper loop) — backend calls `find_reviewers()` once per (abstract × institution) pair and merges results per abstract.
- **Auth**: Out of scope. Stub the user block in `Layout.tsx`.
- **Programs**: Keep as a real feature. Add `program` field on abstracts. Keep the program dropdown filter, program selector, and per-program dashboard breakdown. Programs hardcoded in backend config for MVP.
- **Database**: MariaDB for everything (abstracts, jobs, results, history). SQLModel (Pydantic + SQLAlchemy) for models. Connection string via `.env`.
- **Packaging**: Everything Dockerized (backend, frontend-served-by-nginx, mariadb) via a single `docker-compose.yml` — same stack runs locally and in the cloud, no dev/prod split. CI/CD deferred — the Dockerfiles will plug into a future GitHub Actions pipeline that builds and pushes to a cloud registry.

## Database Schema (MariaDB via SQLModel)

```
abstracts
  id (PK), gf_entry_id (UNIQUE), title, abstract_text,
  pdf_url, program, applicant_name, applicant_email,
  affiliation,              # derived from email domain
  exclude_authors_json,     # JSON array — COI list from GF
  status,                   # unmatched | processing | in-progress | matched
  submitted_at,             # from GF date_updated
  invitation_sent, accepted_review,
  created_at, updated_at

match_jobs
  id (PK), created_at, status,
  year_from, year_to,
  total_reviewers_per_abstract

job_abstracts              # many-to-many
  job_id (FK), abstract_id (FK)

job_institutions           # per-institution count config
  job_id (FK), institution_name, num_reviewers

match_results              # one row per reviewer found
  id (PK), job_id (FK), abstract_id (FK),
  institution, reviewer_name,
  openalex_id, orcid, affiliation,
  h_index, works_count, cited_by_count,
  top_topics_json, justification,
  found_at
```

Add to `requirements.txt`: `sqlmodel`, `pymysql`, `pypdf` (already needed by `gravity_forms_client.py`).
