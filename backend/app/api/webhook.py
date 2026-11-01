"""GitHub webhook endpoint and repository push ingestion pipeline."""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request

from backend.app.db.database import get_connection
from backend.app.graph.builder import build_graph
from backend.app.parser.tree_sitter_parser import parse_files
from backend.app.services.github_ingestion import parse_github_url
from backend.app.services.repo_cloner import shallow_checkout
from backend.app.services.source_analyzer import discover_files

router = APIRouter(tags=["GitHub Webhooks"])

_COMMIT_SHA_PATTERN = re.compile(r"[0-9a-f]{40}")
_REF_PREFIX = "refs/heads/"
_GRAPH_ROOT = Path(__file__).resolve().parents[3] / "data" / "graphs"


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _verify_signature(body: bytes, signature: str | None) -> None:
    secret = os.getenv("GITHUB_WEBHOOK_SECRET")
    if not secret:
        raise HTTPException(
            status_code=503,
            detail="GitHub webhook secret is not configured.",
        )
    if not signature or not signature.startswith("sha256="):
        raise HTTPException(status_code=401, detail="Invalid webhook signature.")

    expected = "sha256=" + hmac.new(
        secret.encode("utf-8"),
        body,
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(expected, signature):
        raise HTTPException(status_code=401, detail="Invalid webhook signature.")


def _canonical_repository_url(repository: dict[str, Any]) -> str:
    url = repository.get("html_url") or repository.get("clone_url")
    if not isinstance(url, str):
        raise HTTPException(status_code=400, detail="Webhook repository URL is missing.")
    owner, name = parse_github_url(url)
    return f"https://github.com/{owner}/{name}"


def _claim_delivery(delivery_id: str) -> bool:
    with get_connection() as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS webhook_deliveries (
                delivery_id TEXT PRIMARY KEY,
                received_at TEXT NOT NULL
            )
            """
        )
        result = connection.execute(
            """
            INSERT OR IGNORE INTO webhook_deliveries (delivery_id, received_at)
            VALUES (?, ?)
            """,
            (delivery_id, _utc_now()),
        )
        return result.rowcount == 1


def _find_registered_repository(repository_url: str, branch: str) -> dict[str, Any] | None:
    with get_connection() as connection:
        row = connection.execute(
            """
            SELECT id, url, selected_branch
            FROM repositories
            WHERE url = ? AND selected_branch = ?
            """,
            (repository_url, branch),
        ).fetchone()
    return dict(row) if row is not None else None


def _save_graph(
    repository_id: str,
    repository_url: str,
    branch: str,
    commit_sha: str,
    nodes: list[Any],
    edges: list[Any],
) -> None:
    snapshot_path = _GRAPH_ROOT / repository_id / f"{commit_sha}.json"
    snapshot_path.parent.mkdir(parents=True, exist_ok=True)
    snapshot_path.write_text(
        json.dumps(
            {
                "repository_url": repository_url,
                "branch": branch,
                "commit_sha": commit_sha,
                "nodes": [node.__dict__ for node in nodes],
                "edges": [edge.__dict__ for edge in edges],
            },
            sort_keys=True,
        ),
        encoding="utf-8",
    )

    timestamp = _utc_now()
    with get_connection() as connection:
        revision_id = str(uuid.uuid4())
        connection.execute(
            """
            INSERT INTO revisions (
                id, repository_id, commit_sha, branch, file_count,
                snapshot_path, snapshot_status, ingested_at
            )
            VALUES (?, ?, ?, ?, ?, ?, 'completed', ?)
            ON CONFLICT(repository_id, commit_sha) DO UPDATE SET
                branch = excluded.branch,
                file_count = excluded.file_count,
                snapshot_path = excluded.snapshot_path,
                snapshot_status = 'completed',
                ingested_at = excluded.ingested_at
            """,
            (
                revision_id,
                repository_id,
                commit_sha,
                branch,
                len(nodes),
                str(snapshot_path),
                timestamp,
            ),
        )
        connection.execute(
            """
            UPDATE repositories
            SET latest_commit_sha = ?, ingestion_status = 'completed',
                updated_at = ?, last_error = NULL
            WHERE id = ? AND url = ? AND selected_branch = ?
            """,
            (commit_sha, timestamp, repository_id, repository_url, branch),
        )


def process_push(
    repository_id: str,
    repository_url: str,
    branch: str,
    commit_sha: str,
) -> None:
    """Clone, parse, build, and persist one exact repository revision."""
    timestamp = _utc_now()
    with get_connection() as connection:
        connection.execute(
            """
            UPDATE repositories
            SET ingestion_status = 'running', updated_at = ?, last_error = NULL
            WHERE id = ? AND url = ? AND selected_branch = ?
            """,
            (timestamp, repository_id, repository_url, branch),
        )

    try:
        with shallow_checkout(repository_url, commit_sha) as repository_path:
            parsed_files = []
            for path in discover_files(repository_path):
                if path.suffix.lower() == ".py":
                    parsed_files.append(parse_files(path, repository_path))
            nodes, edges = build_graph(parsed_files)
            _save_graph(
                repository_id,
                repository_url,
                branch,
                commit_sha,
                nodes,
                edges,
            )
    except Exception as exc:
        with get_connection() as connection:
            connection.execute(
                """
                UPDATE repositories
                SET ingestion_status = 'failed', updated_at = ?, last_error = ?
                WHERE id = ? AND url = ? AND selected_branch = ?
                """,
                (_utc_now(), str(exc), repository_id, repository_url, branch),
            )


@router.post("/webhooks/github")
async def github_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
) -> dict[str, str]:
    body = await request.body()
    _verify_signature(body, request.headers.get("X-Hub-Signature-256"))

    event = request.headers.get("X-GitHub-Event")
    if event != "push":
        return {"status": "ignored"}

    delivery_id = request.headers.get("X-GitHub-Delivery")
    if not delivery_id:
        raise HTTPException(status_code=400, detail="Webhook delivery ID is missing.")

    try:
        payload = json.loads(body)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Malformed webhook payload.") from exc

    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Webhook payload must be an object.")

    repository_payload = payload.get("repository")
    ref = payload.get("ref")
    deleted = payload.get("deleted", False)
    if not isinstance(repository_payload, dict) or not isinstance(ref, str):
        raise HTTPException(status_code=400, detail="Push payload is missing repository or ref.")
    if not ref.startswith(_REF_PREFIX) or not ref[len(_REF_PREFIX):]:
        raise HTTPException(status_code=400, detail="Push payload contains an invalid branch ref.")

    if not _claim_delivery(delivery_id):
        return {"status": "duplicate"}

    if deleted:
        return {"status": "ignored"}

    after = payload.get("after")
    if not isinstance(after, str) or not _COMMIT_SHA_PATTERN.fullmatch(after):
        raise HTTPException(status_code=400, detail="Push payload contains an invalid commit SHA.")

    try:
        repository_url = _canonical_repository_url(repository_payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    branch = ref[len(_REF_PREFIX):]
    repository = _find_registered_repository(repository_url, branch)
    if repository is None:
        return {"status": "ignored"}

    background_tasks.add_task(
        process_push,
        repository["id"],
        repository_url,
        branch,
        after,
    )
    return {"status": "accepted"}
