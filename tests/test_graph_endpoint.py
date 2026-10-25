"""Tests for the graph construction API endpoint."""

import datetime
import uuid

from fastapi.testclient import TestClient

from backend.main import app
from backend.app.db.database import get_connection

# Reuse values from existing repo cloner test
import uuid as _uuid

REPOSITORY_URL = "https://github.com/sucxay/sound-ai"
COMMIT_SHA = "78a16c09c9ebf11648a8371997a8c997e0a6f5e2"
BRANCH = "main"

client = TestClient(app)


def _insert_test_repo() -> str:
    """Insert a repository record directly into the test DB and return its id."""
    repo_id = str(uuid.uuid4())
    now = datetime.datetime.now(tz=datetime.timezone.utc).isoformat()
    # Extract owner/name from URL
    owner, name = REPOSITORY_URL.split('/')[-2:]
    # dummy github_id
    github_id = 0
    with get_connection() as conn:
        # Ensure no previous entry with the same URL interferes with the UNIQUE constraint.
        conn.execute("DELETE FROM repositories WHERE url = ?", (REPOSITORY_URL,))
        conn.execute(
            """
            INSERT INTO repositories (
                id, github_id, owner, name, url,
                default_branch, selected_branch,
                latest_commit_sha, ingestion_status,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                repo_id,
                github_id,
                owner,
                name,
                REPOSITORY_URL,
                BRANCH,
                BRANCH,
                None,
                "pending",
                now,
                now,
            ),
        )
    return repo_id


def test_build_graph_endpoint():
    repo_id = _insert_test_repo()
    response = client.post(f"/repositories/{repo_id}/graph", json={"commit_sha": COMMIT_SHA})
    assert response.status_code == 200, response.text
    data = response.json()
    assert "nodes" in data and isinstance(data["nodes"], list)
    assert "edges" in data and isinstance(data["edges"], list)
    # At least one node (the file) should be present
    assert len(data["nodes"]) > 0
    # The graph should contain at least a "contains" edge for each symbol
    # but we only assert that edges list exists
