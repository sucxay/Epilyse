import os
import re
import sqlite3
from datetime import datetime, timezone
from urllib.parse import urlparse
from uuid import uuid4

from dotenv import load_dotenv
from github import Auth, Github, GithubException

from ..db.database import get_connection

load_dotenv()


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def parse_github_url(url: str) -> tuple[str, str]:
    """Accept a standard GitHub repository URL and return owner, repo."""

    parsed = urlparse(url.strip())

    if (
        parsed.scheme != "https"
        or parsed.hostname != "github.com"
        or parsed.username
        or parsed.password
        or parsed.port
        or parsed.query
        or parsed.fragment
    ):
        raise ValueError("Provide a valid HTTPS GitHub repository URL.")

    parts = parsed.path.strip("/").split("/")

    if len(parts) != 2:
        raise ValueError(
            "URL must have the form https://github.com/owner/repository"
        )

    owner, name = parts

    if name.endswith(".git"):
        name = name[:-4]

    # Avoid malformed paths and URL-encoded path tricks.
    if not re.fullmatch(r"[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?", owner):
        raise ValueError("Invalid GitHub owner name.")

    if not re.fullmatch(r"[A-Za-z0-9_.-]+", name):
        raise ValueError("Invalid GitHub repository name.")

    return owner, name


def get_github_client() -> Github:
    token = os.getenv("GITHUB_TOKEN")

    if token:
        return Github(auth=Auth.Token(token))

    # Public repositories can be accessed without authentication,
    # but the API rate limit will be lower.
    return Github()


def register_repository(url: str, branch: str | None = None) -> dict:
    owner, name = parse_github_url(url)
    client = get_github_client()

    try:
        gh_repo = client.get_repo(f"{owner}/{name}")

        selected_branch = branch or gh_repo.default_branch

        # Confirm the requested branch exists.
        branch_info = gh_repo.get_branch(selected_branch)
        commit_sha = branch_info.commit.sha

        canonical_url = f"https://github.com/{gh_repo.full_name}"
        timestamp = utc_now()

        with get_connection() as connection:
            connection.execute(
                """
                INSERT INTO repositories (
                    id, github_id, owner, name, url,
                    default_branch, selected_branch,
                    latest_commit_sha, ingestion_status,
                    created_at, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
                ON CONFLICT(url) DO NOTHING
                """,
                (
                    str(uuid4()),
                    gh_repo.id,
                    gh_repo.owner.login,
                    gh_repo.name,
                    canonical_url,
                    gh_repo.default_branch,
                    selected_branch,
                    None,
                    timestamp,
                    timestamp,
                ),
            )

            # Reuse the existing record if the repository was registered before.
            connection.execute(
                """
                UPDATE repositories
                SET selected_branch = ?, updated_at = ?
                WHERE url = ?
                """,
                (selected_branch, timestamp, canonical_url),
            )

            row = connection.execute(
                """
                SELECT id, github_id, owner, name, url,
                       default_branch, selected_branch,
                       latest_commit_sha, ingestion_status
                FROM repositories
                WHERE url = ?
                """,
                (canonical_url,),
            ).fetchone()

        return {
            "repository_id": row["id"],
            "github_id": row["github_id"],
            "owner": row["owner"],
            "name": row["name"],
            "url": row["url"],
            "default_branch": row["default_branch"],
            "selected_branch": row["selected_branch"],
            "current_commit_sha": commit_sha,
            "latest_analyzed_sha": row["latest_commit_sha"],
            "ingestion_status": row["ingestion_status"],
        }

    except GithubException as exc:
        if exc.status == 404:
            raise ValueError(
                "Repository or branch not found, or you lack permission to access it."
            ) from exc
        if exc.status == 401:
            raise ValueError("GitHub authentication failed. Check GITHUB_TOKEN.") from exc
        if exc.status == 403:
            raise ValueError(
                "GitHub API access was denied or rate-limited. Check token permissions and rate limits."
            ) from exc
        raise ValueError(f"GitHub API error: {exc.data}") from exc
    finally:
        client.close()