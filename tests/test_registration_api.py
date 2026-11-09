"""Tests for registration scheduling and the backend health endpoint."""

from unittest.mock import patch
from uuid import uuid4

from fastapi.testclient import TestClient

from backend.main import app


client = TestClient(app)


def test_health_endpoint_returns_ok():
    response = client.get("/health")
    if response.status_code != 200 or response.json() != {"status": "ok"}:
        raise AssertionError(f"Unexpected health response: {response.status_code} {response.text}")


def test_registration_schedules_background_ingestion():
    registration = {
        "repository_id": str(uuid4()),
        "github_id": 1,
        "owner": "example",
        "name": "project",
        "url": "https://github.com/example/project",
        "default_branch": "main",
        "selected_branch": "main",
        "current_commit_sha": "a" * 40,
        "latest_analyzed_sha": None,
        "ingestion_status": "pending",
        "sha": None,
    }
    calls = []
    with (
        patch("backend.app.api.repositories.register_repository", return_value=registration),
        patch(
            "backend.app.api.repositories.process_push",
            side_effect=lambda *args: calls.append(args),
        ),
    ):
        response = client.post(
            "/repositories/register",
            json={"url": registration["url"], "branch": "main"},
        )

    if response.status_code != 201:
        raise AssertionError(f"Expected 201, got {response.status_code}: {response.text}")
    expected = [
        (
            registration["repository_id"],
            registration["url"],
            registration["selected_branch"],
            registration["current_commit_sha"],
        )
    ]
    if calls != expected:
        raise AssertionError(f"Expected ingestion call {expected}, got {calls}")
