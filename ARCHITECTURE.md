# Architecture

- `backend/main.py`: Creates the FastAPI application and registers API routers.
- `backend/app/api/repositories.py`: Registers GitHub repositories.
- `backend/app/api/cloning.py`: Exposes exact-commit repository cloning.
- `backend/app/api/graph.py`: Builds graphs for registered repositories.
- `backend/app/api/webhook.py`: Verifies GitHub push deliveries and runs persisted ingestion.
- `backend/app/db/database.py`: Provides SQLite connections.
- `backend/app/db/init_db.py`: Creates the SQLite schema.
- `backend/app/services/github_ingestion.py`: Validates GitHub repositories and registration data.
- `backend/app/services/repo_cloner.py`: Performs exact shallow Git checkouts.
- `backend/app/services/source_analyzer.py`: Discovers and classifies source files.
- `backend/app/parser/tree_sitter_parser.py`: Parses supported source files.
- `backend/app/graph/builder.py`: Builds dependency graph nodes and edges.
