import uuid
from contextlib import contextmanager
from unittest.mock import patch

from fastapi.testclient import TestClient

from backend.app.db.database import get_connection
from backend.main import app


client = TestClient(app)
REPOSITORY_URL = "https://github.com/sucxay/Epilyse"
COMMIT_SHA = "cfc137b6951afac8461abd5de3dfb58782f8857f"


def test_clone_uses_registered_commit_when_request_body_is_empty():
    repository_id = str(uuid.uuid4())
    with get_connection() as connection:
        connection.execute(
            "DELETE FROM repositories WHERE url = ?",
            (REPOSITORY_URL,),
        )
        connection.execute(
            """
            INSERT INTO repositories (
                id, github_id, owner, name, url,
                default_branch, selected_branch, latest_commit_sha,
                ingestion_status, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            """,
            (
                repository_id,
                0,
                "sucxay",
                "Epilyse",
                REPOSITORY_URL,
                "main",
                "main",
                COMMIT_SHA,
                "pending",
            ),
        )

    @contextmanager
    def fake_checkout(repository_url: str, commit_sha: str):
        assert repository_url == REPOSITORY_URL
        assert commit_sha == COMMIT_SHA
        yield None

    def fake_run_git(args: list[str], cwd=None) -> str:
        if args == ["rev-parse", "HEAD"]:
            return COMMIT_SHA
        if args == ["ls-files"]:
            return "README.md\nbackend/main.py"
        raise AssertionError(f"Unexpected git command: {args}")

    with (
        patch("backend.app.api.cloning.shallow_checkout", fake_checkout),
        patch("backend.app.api.cloning.run_git", fake_run_git),
    ):
        response = client.post(f"/repositories/{repository_id}/clone", json={})

    assert response.status_code == 200, response.text
    assert response.json()["commit_sha"] == COMMIT_SHA
    assert response.json()["file_count"] == 2
