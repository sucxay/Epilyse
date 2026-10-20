from pydantic import BaseModel, Field
from typing import Literal
from datetime import datetime, timezone
import uuid


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def new_id() -> str:
    return str(uuid.uuid4())


class Repository(BaseModel):
    id: str = Field(default_factory=new_id)
    github_id: int
    owner: str
    name: str
    url: str

    default_branch: str
    selected_branch: str
    latest_commit_sha: str | None = None

    ingestion_status: Literal[
        "pending", "running", "completed", "failed",
    ] = "pending"

    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)

    last_error: str | None = None


class RepositoryRevision(BaseModel):
    id: str = Field(default_factory=new_id)
    repository_id: str
    commit_sha: str
    branch: str

    file_count: int = 0
    snapshot_path: str | None = None
    snapshot_status: Literal[
        "pending", "running", "completed", "failed",
    ] = "pending"

    ingested_at: datetime = Field(default_factory=utc_now)


class RepositoryFile(BaseModel):
    id: str = Field(default_factory=new_id)

    repository_id: str
    revision_id: str
    commit_sha: str

    # File identification
    path: str
    extension: str
    language: str | None = None

    # File metadata
    size_bytes: int
    content_hash: str

    # Actual source file remains on disk
    storage_path: str

    indexed_at: datetime = Field(default_factory=utc_now)


class IngestionRun(BaseModel):
    id: str = Field(default_factory=new_id)

    repository_id: str
    revision_id: str | None = None

    status: Literal[
        "pending", "running", "completed", "failed",
    ] = "pending"

    started_at: datetime | None = None
    completed_at: datetime | None = None

    # Processing statistics
    files_discovered: int = 0
    files_processed: int = 0
    files_skipped: int = 0
    bytes_processed: int = 0

    error: str | None = None


class RepositoryRegisterRequest(BaseModel):
    url: str = Field(
        min_length=1,
        description="GitHub repository URL",
    )
    branch: str | None = Field(
        default=None,
        description="Branch to track; defaults to the repository's default branch",
    )