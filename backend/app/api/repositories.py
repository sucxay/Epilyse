from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException

from backend.app.auth import require_supabase_user
from ..db.database import get_connection
from ..schemas.github_schemas import RepositoryRegisterRequest
from ..services.github_ingestion import register_repository 
from ..services.mongodb import (
    MongoPersistenceError,
    get_last_registered_repository,
    save_last_registered_repository,
)
from .webhook import process_push

router = APIRouter(
    prefix="/repositories",
    tags=["Repositories"],
    dependencies=[Depends(require_supabase_user)],
)
@router.post("/register",status_code=201)
def register(
    request: RepositoryRegisterRequest,
    user: dict[str, Any] = Depends(require_supabase_user),
):
    try:
        registration = register_repository(request.url, request.branch, request.sha)
        registration["registered_at"] = registration.get("registered_at") or datetime.now(
            timezone.utc
        ).isoformat()
        save_last_registered_repository(user["id"], registration)
        return registration
    except ValueError as exc :
        raise HTTPException(status_code=400 , detail=str(exc))
    except MongoPersistenceError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.get("/last-registered")
def last_registered_repository(
    user: dict[str, Any] = Depends(require_supabase_user),
):
    try:
        return {"repository": get_last_registered_repository(user["id"])}
    except MongoPersistenceError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.get("/{repository_id}")
def repository_status(repository_id: str):
    with get_connection() as connection:
        repository = connection.execute(
            """
            SELECT id, owner, name, url, default_branch, selected_branch,
                   latest_commit_sha, ingestion_status, updated_at, last_error
            FROM repositories
            WHERE id = ?
            """,
            (repository_id,),
        ).fetchone()

    if repository is None:
        raise HTTPException(status_code=404, detail="Repository not found.")
    return dict(repository)


@router.post("/{repository_id}/ingestion/retry")
def retry_ingestion(repository_id: str, background_tasks: BackgroundTasks):
    with get_connection() as connection:
        repository = connection.execute(
            """
            SELECT id, url, selected_branch
            FROM repositories
            WHERE id = ?
            """,
            (repository_id,),
        ).fetchone()
        revision = connection.execute(
            """
            SELECT commit_sha
            FROM revisions
            WHERE repository_id = ? AND snapshot_status = 'failed'
            ORDER BY ingested_at DESC
            LIMIT 1
            """,
            (repository_id,),
        ).fetchone()

    if repository is None:
        raise HTTPException(status_code=404, detail="Repository not found.")
    if revision is None:
        raise HTTPException(status_code=409, detail="No failed ingestion is available to retry.")

    background_tasks.add_task(
        process_push,
        repository["id"],
        repository["url"],
        repository["selected_branch"],
        revision["commit_sha"],
    )
    return {"status": "accepted", "commit_sha": revision["commit_sha"]}
    