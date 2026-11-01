"""Shallow-clone GitHub repositories at an exact commit."""

import os
import re
import subprocess
import tempfile
from collections.abc import Generator
from contextlib import contextmanager
from pathlib import Path
from urllib.parse import urlparse


def validate_repo(url: str) -> None:
    """Validate a public GitHub repository URL before invoking Git."""
    parsed = urlparse(url)

    if parsed.scheme != "https" or parsed.hostname != "github.com":
        raise ValueError("URL is not a GitHub URL.")
    if parsed.username or parsed.password:
        raise ValueError("Credentials are not allowed.")

    if parsed.query or parsed.fragment:
        raise ValueError("Query and fragment are not allowed.")

    parts = parsed.path.strip("/").split("/")
    if len(parts) != 2 or not all(parts):
        raise ValueError("URL is not valid.")

    owner, repo = parts
    if repo.endswith(".git"):
        repo = repo[:-4]

    pattern = r"[A-Za-z0-9_.-]+"

    if not re.fullmatch(pattern, owner):
        raise ValueError("Invalid GitHub owner.")

    if not re.fullmatch(pattern, repo):
        raise ValueError("Invalid repository name.")


def run_git(
    args: list[str],
    cwd: Path | None = None,
    timeout: int = 300,
) -> str:
    """Execute Git and return standard output."""

    result = subprocess.run(
        ["git", *args],
        cwd=cwd,
        timeout=timeout,
        text=True,
        check=False,
        capture_output=True,
        env=os.environ.copy(),
    )

    if result.returncode != 0:
        message = result.stderr.strip() or "Git command failed."
        raise RuntimeError(message)

    return result.stdout.strip()


@contextmanager
def shallow_checkout(repository_url: str, commit_sha: str) -> Generator[Path]:
    """Create a temporary shallow checkout of a specific commit."""

    validate_repo(repository_url)
    if not re.fullmatch(r"[a-fA-F0-9]{32,64}", commit_sha):
        raise ValueError("Commit SHA is not valid.")

    with tempfile.TemporaryDirectory(prefix="epilyse-") as temp_dir:
        repo_path = Path(temp_dir) / "repository"
        run_git(
            [
                "clone",
                "--depth",
                "1",
                "--no-tags",
                repository_url,
                str(repo_path),
            ],
        )
        actual_sha = run_git(
            ["rev-parse", "HEAD"],
            cwd=repo_path,
        )

        if actual_sha.casefold() != commit_sha.casefold():
            run_git(
                ["fetch", "--depth", "1", "origin", commit_sha],
                cwd=repo_path,
            )

            run_git(
                ["checkout", "--detach", commit_sha],
                cwd=repo_path,
            )

        actual_sha = run_git(
            ["rev-parse", "HEAD"],
            cwd=repo_path,
        )

        if actual_sha.casefold() != commit_sha.casefold():
            raise RuntimeError(
                f"Commit mismatch: requested {commit_sha}, "
                f"checked out {actual_sha}"
            )

        yield repo_path



