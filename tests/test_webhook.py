import hashlib
import hmac
import json
import uuid
from contextlib import contextmanager
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from fastapi.testclient import TestClient

from backend.app.db.database import get_connection
from backend.app.api.webhook import process_push
from backend.app.services.github_ingestion import canonical_github_url
from backend.main import app


client = TestClient(app)
SECRET = "test-webhook-secret"
REPOSITORY_URL = "https://github.com/example/project"
COMMIT_SHA = "a" * 40


def _signature(body: bytes) -> str:
    digest = hmac.new(SECRET.encode(), body, hashlib.sha256).hexdigest()
    return f"sha256={digest}"


def _payload() -> dict:
    return {
        "ref": "refs/heads/main",
        "after": COMMIT_SHA,
        "deleted": False,
        "repository": {"html_url": REPOSITORY_URL},
    }


def _register_repository() -> str:
    repository_id = str(uuid.uuid4())
    with get_connection() as connection:
        connection.execute("DELETE FROM repositories WHERE url = ?", (REPOSITORY_URL,))
        connection.execute(
            """
            INSERT INTO repositories (
                id, github_id, owner, name, url, default_branch,
                selected_branch, latest_commit_sha, ingestion_status,
                created_at, updated_at
            )
            VALUES (?, 1, 'example', 'project', ?, 'main', 'main', NULL,
                    'pending', datetime('now'), datetime('now'))
            """,
            (repository_id, REPOSITORY_URL),
        )
    return repository_id


def test_push_accepts_registered_repository_and_deduplicates(monkeypatch):
    repository_id = _register_repository()
    monkeypatch.setenv("GITHUB_WEBHOOK_SECRET", SECRET)
    payload = json.dumps(_payload()).encode()
    calls = []
    delivery_id = f"delivery-{uuid.uuid4()}"

    try:
        with patch(
            "backend.app.api.webhook.process_push",
            side_effect=lambda *args: calls.append(args),
        ):
            headers = {
                "X-GitHub-Event": "push",
                "X-GitHub-Delivery": delivery_id,
                "X-Hub-Signature-256": _signature(payload),
            }
            response = client.post("/webhooks/github", content=payload, headers=headers)
            duplicate = client.post("/webhooks/github", content=payload, headers=headers)

        if response.status_code != 200 or response.json() != {"status": "accepted"}:
            raise AssertionError(f"Expected accepted push, got {response.status_code}: {response.text}")
        if duplicate.json() != {"status": "duplicate"}:
            raise AssertionError(f"Expected duplicate delivery, got {duplicate.text}")
        if calls != [(repository_id, REPOSITORY_URL, "main", COMMIT_SHA)]:
            raise AssertionError(f"Unexpected processing calls: {calls}")
    finally:
        with get_connection() as connection:
            connection.execute("DELETE FROM repositories WHERE id = ?", (repository_id,))


def test_push_rejects_invalid_signature(monkeypatch):
    monkeypatch.setenv("GITHUB_WEBHOOK_SECRET", SECRET)
    payload = json.dumps(_payload()).encode()
    response = client.post(
        "/webhooks/github",
        content=payload,
        headers={
            "X-GitHub-Event": "push",
            "X-GitHub-Delivery": "delivery-invalid",
            "X-Hub-Signature-256": "sha256=invalid",
        },
    )
    if response.status_code != 401:
        raise AssertionError(f"Expected 401, got {response.status_code}: {response.text}")


def test_ping_event_is_ignored(monkeypatch):
    monkeypatch.setenv("GITHUB_WEBHOOK_SECRET", SECRET)
    payload = b"{}"
    response = client.post(
        "/webhooks/github",
        content=payload,
        headers={
            "X-GitHub-Event": "ping",
            "X-GitHub-Delivery": f"ping-{uuid.uuid4()}",
            "X-Hub-Signature-256": _signature(payload),
        },
    )
    if response.status_code != 200 or response.json() != {"status": "ignored"}:
        raise AssertionError(f"Expected ignored ping, got {response.status_code}: {response.text}")


def test_unregistered_repository_and_branch_are_ignored(monkeypatch):
    monkeypatch.setenv("GITHUB_WEBHOOK_SECRET", SECRET)
    payload_data = _payload()
    payload_data["repository"]["html_url"] = f"{REPOSITORY_URL}.git"
    payload_data["ref"] = "refs/heads/release"
    payload = json.dumps(payload_data).encode()
    response = client.post(
        "/webhooks/github",
        content=payload,
        headers={
            "X-GitHub-Event": "push",
            "X-GitHub-Delivery": f"unmatched-{uuid.uuid4()}",
            "X-Hub-Signature-256": _signature(payload),
        },
    )
    if response.json() != {"status": "ignored"}:
        raise AssertionError(f"Expected ignored unmatched push, got {response.text}")


def test_registered_branch_mismatch_is_ignored(monkeypatch):
    repository_id = _register_repository()
    monkeypatch.setenv("GITHUB_WEBHOOK_SECRET", SECRET)
    payload_data = _payload()
    payload_data["ref"] = "refs/heads/release"
    payload = json.dumps(payload_data).encode()
    try:
        response = client.post(
            "/webhooks/github",
            content=payload,
            headers={
                "X-GitHub-Event": "push",
                "X-GitHub-Delivery": f"branch-{uuid.uuid4()}",
                "X-Hub-Signature-256": _signature(payload),
            },
        )
        if response.json() != {"status": "ignored"}:
            raise AssertionError(f"Expected ignored branch mismatch, got {response.text}")
    finally:
        with get_connection() as connection:
            connection.execute("DELETE FROM repositories WHERE id = ?", (repository_id,))


def test_repository_url_normalization():
    if canonical_github_url("https://github.com/example/project.git") != REPOSITORY_URL:
        raise AssertionError("The .git repository URL was not canonicalized.")


def test_deleted_branch_is_ignored(monkeypatch):
    monkeypatch.setenv("GITHUB_WEBHOOK_SECRET", SECRET)
    payload_data = _payload()
    payload_data["deleted"] = True
    payload = json.dumps(payload_data).encode()
    response = client.post(
        "/webhooks/github",
        content=payload,
        headers={
            "X-GitHub-Event": "push",
            "X-GitHub-Delivery": f"delivery-{uuid.uuid4()}",
            "X-Hub-Signature-256": _signature(payload),
        },
    )
    if response.json() != {"status": "ignored"}:
        raise AssertionError(f"Expected ignored deletion, got {response.text}")


def test_process_push_persists_exact_revision_and_graph(tmp_path):
    repository_id = _register_repository()
    checkout_path = tmp_path / "repository"
    checkout_path.mkdir()
    source_path = checkout_path / "main.py"
    source_path.write_text("def main():\n    return 1\n", encoding="utf-8")
    node = SimpleNamespace(id="file:main.py", type="file")
    edge = SimpleNamespace(source="file:main.py", target="file:main.py", type="contains")

    @contextmanager
    def fake_checkout(url: str, sha: str):
        if url != REPOSITORY_URL or sha != COMMIT_SHA:
            raise AssertionError(f"Unexpected checkout request: {url}, {sha}")
        yield checkout_path

    try:
        with (
            patch("backend.app.api.webhook.shallow_checkout", fake_checkout),
            patch("backend.app.api.webhook.discover_files", return_value=[source_path]),
            patch("backend.app.api.webhook.parse_files", return_value=object()),
            patch("backend.app.api.webhook.build_graph", return_value=([node], [edge])),
            patch("backend.app.api.webhook._GRAPH_ROOT", tmp_path / "graphs"),
            patch("backend.app.api.webhook._is_current_branch_head", return_value=True),
        ):
            process_push(repository_id, REPOSITORY_URL, "main", COMMIT_SHA)

        with get_connection() as connection:
            repository = connection.execute(
                "SELECT latest_commit_sha, ingestion_status FROM repositories WHERE id = ?",
                (repository_id,),
            ).fetchone()
            revision = connection.execute(
                "SELECT commit_sha, snapshot_path FROM revisions WHERE repository_id = ?",
                (repository_id,),
            ).fetchone()

        if tuple(repository) != (COMMIT_SHA, "completed"):
            raise AssertionError(f"Repository was not completed at the exact SHA: {repository}")
        if revision["commit_sha"] != COMMIT_SHA:
            raise AssertionError(f"Unexpected revision SHA: {revision['commit_sha']}")
        if not Path(revision["snapshot_path"]).exists():
            raise AssertionError(f"Graph snapshot was not written: {revision['snapshot_path']}")
    finally:
        with get_connection() as connection:
            connection.execute("DELETE FROM repositories WHERE id = ?", (repository_id,))


def test_latest_graph_endpoint_reads_completed_snapshot(tmp_path):
    repository_id = _register_repository()
    node = SimpleNamespace(id="file:main.py", type="file")
    edge = SimpleNamespace(source="file:main.py", target="file:main.py", type="contains")
    try:
        with (
            patch("backend.app.api.webhook._GRAPH_ROOT", tmp_path / "graphs"),
            patch("backend.app.api.webhook._is_current_branch_head", return_value=True),
        ):
            with get_connection() as connection:
                connection.execute(
                    """
                    UPDATE repositories
                    SET latest_commit_sha = ?, ingestion_status = 'completed'
                    WHERE id = ?
                    """,
                    (COMMIT_SHA, repository_id),
                )
            from backend.app.api.webhook import _save_graph

            _save_graph(
                repository_id,
                REPOSITORY_URL,
                "main",
                COMMIT_SHA,
                [node],
                [edge],
            )
            response = client.get(f"/repositories/{repository_id}/graph/latest")

        if response.status_code != 200:
            raise AssertionError(f"Expected latest graph, got {response.status_code}: {response.text}")
        if response.json()["commit_sha"] != COMMIT_SHA:
            raise AssertionError("Latest graph returned the wrong commit.")
        if len(response.json()["nodes"]) != 1:
            raise AssertionError("Latest graph returned the wrong node count.")
    finally:
        with get_connection() as connection:
            connection.execute("DELETE FROM repositories WHERE id = ?", (repository_id,))


def test_process_push_records_checkout_failure():
    repository_id = _register_repository()
    try:
        with patch(
            "backend.app.api.webhook.shallow_checkout",
            side_effect=RuntimeError("checkout failed"),
        ):
            process_push(repository_id, REPOSITORY_URL, "main", COMMIT_SHA)

        with get_connection() as connection:
            repository = connection.execute(
                "SELECT ingestion_status, last_error FROM repositories WHERE id = ?",
                (repository_id,),
            ).fetchone()
            revision = connection.execute(
                """
                SELECT snapshot_status FROM revisions
                WHERE repository_id = ? AND commit_sha = ?
                """,
                (repository_id, COMMIT_SHA),
            ).fetchone()
        if tuple(repository) != ("failed", "checkout failed"):
            raise AssertionError(f"Checkout failure was not persisted: {repository}")
        if revision["snapshot_status"] != "failed":
            raise AssertionError("Failed checkout did not mark the revision failed.")
    finally:
        with get_connection() as connection:
            connection.execute("DELETE FROM repositories WHERE id = ?", (repository_id,))
