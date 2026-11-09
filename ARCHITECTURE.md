# Architecture

## Backend

- `backend/main.py`: Creates the FastAPI application and registers API routers.
- `backend/app/api/repositories.py`: Registers GitHub repositories.
- `backend/app/api/cloning.py`: Exposes exact-commit repository cloning.
- `backend/app/api/graph.py`: Builds graphs and serves the latest persisted graph snapshot.
- `backend/app/api/webhook.py`: Verifies GitHub push deliveries and runs persisted ingestion.
- `backend/app/db/database.py`: Provides SQLite connections.
- `backend/app/db/init_db.py`: Creates the SQLite schema.
- `backend/app/services/github_ingestion.py`: Validates GitHub repositories and registration data.
- `backend/app/services/repo_cloner.py`: Performs exact shallow Git checkouts.
- `backend/app/services/source_analyzer.py`: Discovers and classifies source files.
- `backend/app/parser/tree_sitter_parser.py`: Parses supported source files.
- `backend/app/graph/builder.py`: Builds dependency graph nodes and edges.

## Frontend

### Application Shell
- `frontend/src/app/layout.tsx`: Root layout — renders `AppSidebar` + scrollable `main` content area as a full-height flex shell.
- `frontend/src/components/AppSidebar.tsx`: Persistent 220px sidebar with Epilyse branding, SVG-icon nav links for all routes, 2px accent active indicator, and footer with engine version.

### Pages
- `frontend/src/app/page.tsx`: Overview page — compact repository registration form, analysis status header, stat cards grid, entity distribution table, checkout reference panel.
- `frontend/src/app/graph/page.tsx`: Full-workspace graph page — polls ingestion status, renders GraphCanvas filling available viewport height.
- `frontend/src/app/commits/page.tsx`: Commit history page — shows commit SHA, revision metadata, and entity hash registry from stored graph data.
- `frontend/src/app/contributors/page.tsx`: Contributors page — derives codebase area ownership from graph node directory structure; shows honest empty state for Git Blame (not in backend).
- `frontend/src/app/quality/page.tsx`: Quality analysis page — stability index from code_hash/previous_reference fields, entity breakdown by kind, complexity registry.
- `frontend/src/app/repositories/page.tsx`: Repositories page — connected repository overview with direct navigation shortcuts.
- `frontend/src/app/settings/page.tsx`: Settings page — backend connection inspector, localStorage cache manager, engine capabilities roadmap.

### Components
- `frontend/src/components/AnalysisPanel.tsx`: Compact inline repository registration form; drives register → clone → graph API sequence; exposes step-aware loading and error states.
- `frontend/src/components/GraphCanvas.tsx`: Full-featured HTML5 Canvas graph renderer — d3-force layout, glow sprites, cursor spotlight, particles, ripples, zoom/pan, keyboard nav, inspector panel, community clustering.
- `frontend/src/components/AppSidebar.tsx`: (see above under Application Shell)
- `frontend/src/components/StatCard.tsx`: Dark minimal stat card with monospace metric value.
- `frontend/src/components/StatRow.tsx`: Compact label-left / value-right information row for dense data panels.
- `frontend/src/components/CustomCursor.tsx`: Optional pointer-fine cursor follower with lerp smoothing.
- `frontend/src/components/Sidebar.tsx`: Re-exports `AppSidebar` for backward compatibility.

### API & Graph Libraries
- `frontend/src/lib/api.ts`: Defines all frontend API contracts (types + fetch functions) and the shared request helper with timeout and error handling.
- `frontend/src/lib/graph/theme.ts`: Single source of truth for all graph visual constants — palette, edge colors, node kind styles, layout and interaction parameters.
- `frontend/src/lib/graph/layout.ts`: d3-force simulation factory with cluster gravity, degree-based sizing, and saved position restoration.
- `frontend/src/lib/graph/render.ts`: Frame renderer — background, edges with particles, nodes with glow sprites, labels with collision detection.
- `frontend/src/lib/graph/labels.ts`: Label candidate selection and greedy collision-free placement.
- `frontend/src/lib/graph/communities.ts`: Directory-based community clustering, color assignment, and community–node mapping.
- `frontend/src/lib/graph/interaction.ts`: Interaction state machine — cursor smoothing, hover dimming, ripples, particles, keyboard navigation.
- `frontend/src/lib/graph/spatial.ts`: Spatial grid for O(1) hit testing and radius queries.

## Design System
The UI uses a dark Orchestrator-inspired design language with a `#111318` background, `#0d1117` sidebar, cool blue accent (`#4f7cff`), and thin `rgba(255,255,255,0.08)` borders. All design tokens are defined in `tailwind.config.ts` and `src/app/globals.css`.

## Data Flow
1. User submits a GitHub URL in `AnalysisPanel` → register → clone → build graph (3 sequential API calls).
2. Results stored in `localStorage` under `coderag-latest-graph` and `epilyse-repository-id`.
3. Graph page polls `/repositories/{id}` and `/repositories/{id}/graph/latest` every 5s.
4. Commits, Contributors, Quality, and Repositories pages derive their views from the stored `coderag-latest-graph` JSON — no additional API endpoints required.

## Production Persistence
Uses SQLite and graph snapshots at paths configured by `EPILYSE_DB_PATH` and `EPILYSE_GRAPH_ROOT`. On Render, both paths must be inside the same mounted persistent disk; the default local paths remain under `data/`.
