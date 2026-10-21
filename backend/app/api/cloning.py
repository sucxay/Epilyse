
from subprocess import TimeoutExpired

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from backend.app.db.database import get_connection
from backend.app.services.github_ingestion import (
    get_github_client,
    parse_github_url,
)
from backend.app.services.repo_cloner import shallow_checkout, run_git


router = APIRouter(
    prefix="/repositories",
    tags=["Repository Cloning"],
)


class CloneRequest(BaseModel):
    commit_sha: str | None = Field(
        default=None,
        description="Exact commit to clone. If omitted, use the selected branch's current commit.",
    )


@router.post("/{repository_id}/clone")
def clone_repository(
    repository_id: str,
    request: CloneRequest,
):
    # 1. Find the repository registered in CodeRAG.
    connection = get_connection()

    try:
        repository = connection.execute(
            """
            SELECT id, url, selected_branch
            FROM repositories
            WHERE id = ?
            """,
            (repository_id,),
        ).fetchone()
    finally:
        connection.close()

    if repository is None:
        raise HTTPException(
            status_code=404,
            detail="Repository not found.",
        )

    repository_url = repository["url"]
    branch_name = repository["selected_branch"]

    # 2. Resolve the exact commit we want to analyze.
    commit_sha = request.commit_sha

    if not commit_sha:
        try:
            owner, name = parse_github_url(repository_url)
            github_repo = get_github_client().get_repo(
                f"{owner}/{name}"
            )
            commit_sha = github_repo.get_branch(
                branch_name
            ).commit.sha
        except Exception as exc:
            raise HTTPException(
                status_code=502,
                detail="Could not resolve the target GitHub commit.",
            ) from exc

    # 3. Shallow-clone and inspect the requested commit.
    try:
        with shallow_checkout(
            repository_url,
            commit_sha,
        ) as repo_path:
            actual_sha = run_git(
                ["rev-parse", "HEAD"],
                cwd=repo_path,
            )

            files = run_git(
                ["ls-files"],
                cwd=repo_path,
            ).splitlines()

            return {
                "repository_id": repository_id,
                "repository_url": repository_url,
                "branch": branch_name,
                "commit_sha": actual_sha,
                "clone_status": "success",
                "file_count": len(files),
                "sample_files": files[:10],
            }

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc
    except TimeoutExpired as exc:
        raise HTTPException(
            status_code=504,
            detail="Git operation timed out.",
        ) from exc
    except RuntimeError as exc:
        raise HTTPException(
            status_code=502,
            detail="Could not clone the requested commit. Check the repository access and commit SHA.",
        ) from exc
