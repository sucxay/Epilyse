from backend.app.schemas.github_schemas import (
    Repository,
    RepositoryRevision,
    RepositoryFile,
    IngestionRun,
)



def test_repository_defaults():
    repo = Repository(
        github_id=12345,
        owner="example",
        name="demo",
        url="https://github.com/example/demo",
        default_branch="main",
        selected_branch="main",
    )

    assert repo.id
    assert repo.ingestion_status == "pending"
    assert repo.latest_commit_sha is None


def test_revision_defaults():
    revision = RepositoryRevision(
        repository_id="repo-1",
        commit_sha="abc123",
        branch="main",
    )

    assert revision.file_count == 0
    assert revision.snapshot_status == "pending"


def test_repository_file():
    file = RepositoryFile(
        repository_id="repo-1",
        revision_id="revision-1",
        commit_sha="abc123",
        path="src/main.py",
        extension=".py",
        language="Python",
        size_bytes=100,
        content_hash="test-hash",
        storage_path="data/repositories/repo-1/src/main.py",
    )

    assert file.path == "src/main.py"


def test_ingestion_run_defaults():
    run = IngestionRun(repository_id="repo-1")

    assert run.status == "pending"
    assert run.files_processed == 0
    assert run.error is None