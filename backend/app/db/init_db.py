from .database import get_connection
def initialize_database() -> None:
    with get_connection() as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS repositories (
                id TEXT PRIMARY KEY,
                github_id INTEGER NOT NULL,
                owner TEXT NOT NULL,
                name TEXT NOT NULL,
                url TEXT NOT NULL UNIQUE,
                default_branch TEXT NOT NULL,
                selected_branch TEXT NOT NULL,
                latest_commit_sha TEXT,
                ingestion_status TEXT NOT NULL DEFAULT 'pending'
                    CHECK (
                        ingestion_status IN (
                            'pending', 'running',
                            'completed', 'failed'
                        )
                    ),
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                last_error TEXT
            );

            CREATE TABLE IF NOT EXISTS revisions (
                id TEXT PRIMARY KEY,
                repository_id TEXT NOT NULL,
                commit_sha TEXT NOT NULL,
                branch TEXT NOT NULL,
                file_count INTEGER NOT NULL DEFAULT 0,
                snapshot_path TEXT,
                snapshot_status TEXT NOT NULL DEFAULT 'pending'
                    CHECK (
                        snapshot_status IN (
                            'pending', 'running',
                            'completed', 'failed'
                        )
                    ),
                ingested_at TEXT NOT NULL,

                FOREIGN KEY (repository_id)
                    REFERENCES repositories(id)
                    ON DELETE CASCADE,

                UNIQUE (repository_id, commit_sha)
            );

            CREATE TABLE IF NOT EXISTS repository_files (
                id TEXT PRIMARY KEY,
                repository_id TEXT NOT NULL,
                revision_id TEXT NOT NULL,
                commit_sha TEXT NOT NULL,
                path TEXT NOT NULL,
                extension TEXT NOT NULL,
                language TEXT,
                size_bytes INTEGER NOT NULL,
                content_hash TEXT NOT NULL,
                storage_path TEXT NOT NULL,
                indexed_at TEXT NOT NULL,

                FOREIGN KEY (repository_id)
                    REFERENCES repositories(id)
                    ON DELETE CASCADE,

                FOREIGN KEY (revision_id)
                    REFERENCES revisions(id)
                    ON DELETE CASCADE,

                UNIQUE (revision_id, path)
            );

            CREATE TABLE IF NOT EXISTS ingestion_runs (
                id TEXT PRIMARY KEY,
                repository_id TEXT NOT NULL,
                revision_id TEXT,
                status TEXT NOT NULL DEFAULT 'pending'
                    CHECK (
                        status IN (
                            'pending', 'running',
                            'completed', 'failed'
                        )
                    ),
                started_at TEXT,
                completed_at TEXT,
                files_discovered INTEGER NOT NULL DEFAULT 0,
                files_processed INTEGER NOT NULL DEFAULT 0,
                files_skipped INTEGER NOT NULL DEFAULT 0,
                bytes_processed INTEGER NOT NULL DEFAULT 0,
                error TEXT,

                FOREIGN KEY (repository_id)
                    REFERENCES repositories(id)
                    ON DELETE CASCADE,

                FOREIGN KEY (revision_id)
                    REFERENCES revisions(id)
                    ON DELETE SET NULL
            );

            CREATE INDEX IF NOT EXISTS idx_revisions_repository
                ON revisions(repository_id);

            CREATE INDEX IF NOT EXISTS idx_files_revision
                ON repository_files(revision_id);

            CREATE INDEX IF NOT EXISTS idx_runs_repository
                ON ingestion_runs(repository_id);
            """
        )

    print("CodeRAG database initialized successfully.")