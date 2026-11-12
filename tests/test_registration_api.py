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


def test_registration_persists_latest_repository():
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
    with (
        patch("backend.app.api.repositories.register_repository", return_value=registration),
        patch("backend.app.api.repositories.save_last_registered_repository") as save,
    ):
        response = client.post(
            "/repositories/register",
            json={"url": registration["url"], "branch": "main"},
        )

    if response.status_code != 201:
        raise AssertionError(f"Expected 201, got {response.status_code}: {response.text}")
    if save.call_args.args[0] != "00000000-0000-0000-0000-000000000001":
        raise AssertionError("Registration was not keyed by the authenticated Supabase user.")
    if save.call_args.args[1]["repository_id"] != registration["repository_id"]:
        raise AssertionError("Registration persistence received the wrong repository.")


def test_last_registered_repository_returns_authenticated_users_record():
    repository = {
        "user_id": "00000000-0000-0000-0000-000000000001",
        "repository_id": "repo-1",
        "url": "https://github.com/example/project",
        "owner": "example",
        "name": "project",
        "branch": "main",
        "commit": "a" * 40,
        "timestamp": "2026-01-01T00:00:00+00:00",
    }
    with patch(
        "backend.app.api.repositories.get_last_registered_repository",
        return_value=repository,
    ):
        response = client.get("/repositories/last-registered")

    if response.status_code != 200 or response.json() != {"repository": repository}:
        raise AssertionError(f"Unexpected latest repository response: {response.text}")


def test_last_registered_repository_returns_empty_result():
    with patch(
        "backend.app.api.repositories.get_last_registered_repository",
        return_value=None,
    ):
        response = client.get("/repositories/last-registered")

    if response.status_code != 200 or response.json() != {"repository": None}:
        raise AssertionError(f"Expected an empty repository result, got {response.text}")
