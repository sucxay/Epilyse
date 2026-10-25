"""Graph construction API endpoint.

Provides a POST endpoint to build a repository graph for a given repository
and optional commit SHA. The endpoint reuses existing services for cloning,
source analysis, parsing and graph building.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from backend.app.db.database import get_connection
from backend.app.services.github_ingestion import get_github_client, parse_github_url
from backend.app.services.repo_cloner import shallow_checkout
from backend.app.services.source_analyzer import discover_files
from backend.app.parser.tree_sitter_parser import parse_files
from backend.app.graph.builder import build_graph

router = APIRouter(prefix="/repositories", tags=["Graph Builder"])


class GraphRequest(BaseModel):
    commit_sha: str | None = Field(
        default=None,
        description="Exact commit to analyse. If omitted the branch's current commit is used.",
    )


@router.post("/{repository_id}/graph")
def build_repository_graph(repository_id: str, request: GraphRequest):
    """Build a graph for the specified repository.

    Steps:
    1. Retrieve repository information from the DB.
    2. Resolve the commit SHA (either from the request or via GitHub API).
    3. Shallow‑checkout the repository at that commit.
    4. Discover source files, parse them with Tree‑sitter and build the graph.
    5. Return the graph nodes and edges as plain dictionaries.
    """
    # 1. Retrieve repository record.
    connection = get_connection()
    try:
        repo = connection.execute(
            """
            SELECT id, url, selected_branch
            FROM repositories
            WHERE id = ?
            """,
            (repository_id,),
        ).fetchone()
    finally:
        connection.close()

    if repo is None:
        raise HTTPException(status_code=404, detail="Repository not found.")

    repository_url = repo["url"]
    branch_name = repo["selected_branch"]

    # 2. Resolve commit SHA.
    commit_sha = request.commit_sha
    if not commit_sha:
        try:
            owner, name = parse_github_url(repository_url)
            github_repo = get_github_client().get_repo(f"{owner}/{name}")
            commit_sha = github_repo.get_branch(branch_name).commit.sha
        except Exception as exc:
            raise HTTPException(
                status_code=502,
                detail="Could not resolve the target GitHub commit.",
            ) from exc

    # 3. Shallow‑checkout.
    try:
        with shallow_checkout(repository_url, commit_sha) as repo_path:
            # 4. Discover files and parse.
            file_paths = discover_files(repo_path)
            parsed_files = []
            for path in file_paths:
                # Only parse supported extensions (currently Python). Skip others.
                if path.suffix.lower() != ".py":
                    continue
                parsed_files.append(parse_files(path, repo_path))

            # 5. Build graph.
            nodes, edges = build_graph(parsed_files)

            # Convert dataclasses to plain dicts for JSON serialisation.
            node_dicts = [node.__dict__ for node in nodes]
            edge_dicts = [edge.__dict__ for edge in edges]

            return {"nodes": node_dicts, "edges": edge_dicts}
    except Exception as exc:
        # Propagate any cloning or parsing errors as HTTP 400/502.
        raise HTTPException(status_code=502, detail=str(exc)) from exc
