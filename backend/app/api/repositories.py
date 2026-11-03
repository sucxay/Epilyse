from fastapi import APIRouter, BackgroundTasks, HTTPException

from ..db.database import get_connection
from ..schemas.github_schemas import RepositoryRegisterRequest
from ..services.github_ingestion import register_repository 
from .webhook import process_push

router = APIRouter(prefix ="/repositories",tags=['Repositories'])
@router.post("/register",status_code=201)
def register(request : RepositoryRegisterRequest):
    try:
        return register_repository(request.url , request.branch , request.sha)
    except ValueError as exc :
        raise HTTPException(status_code=400 , detail=str(exc))


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
    