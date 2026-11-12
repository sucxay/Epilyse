from unittest.mock import MagicMock, patch

from backend.app.services import mongodb


def _registration():
    return {
        "repository_id": "repo-1",
        "url": "https://github.com/example/project",
        "owner": "example",
        "name": "project",
        "selected_branch": "main",
        "current_commit_sha": "a" * 40,
        "registered_at": "2026-01-01T00:00:00+00:00",
    }


def test_save_uses_user_key_and_replaces_latest_document(monkeypatch):
    monkeypatch.setenv("MONGODB_URI", "mongodb://example")
    monkeypatch.setenv("MONGODB_DATABASE", "Epilyse")
    monkeypatch.setenv("MONGODB_COLLECTION", "registered_repositories")
    mongodb._client.cache_clear()
    collection = MagicMock()
    database = MagicMock()
    database.__getitem__.return_value = collection
    client = MagicMock()
    client.__getitem__.return_value = database

    with patch.object(mongodb, "MongoClient", return_value=client) as mongo_client:
        mongodb.save_last_registered_repository("user-1", _registration())

    mongo_client.assert_called_once_with("mongodb://example", serverSelectionTimeoutMS=5000)
    collection.replace_one.assert_called_once_with(
        {"user_id": "user-1"},
        {
            "user_id": "user-1",
            "repository_id": "repo-1",
            "url": "https://github.com/example/project",
            "owner": "example",
            "name": "project",
            "branch": "main",
            "commit": "a" * 40,
            "timestamp": "2026-01-01T00:00:00+00:00",
        },
        upsert=True,
    )


def test_read_returns_document_without_mongodb_id(monkeypatch):
    monkeypatch.setenv("MONGODB_URI", "mongodb://example")
    monkeypatch.setenv("MONGODB_DATABASE", "Epilyse")
    monkeypatch.setenv("MONGODB_COLLECTION", "registered_repositories")
    mongodb._client.cache_clear()
    collection = MagicMock()
    collection.find_one.return_value = {"_id": "internal", "user_id": "user-1"}
    database = MagicMock()
    database.__getitem__.return_value = collection
    client = MagicMock()
    client.__getitem__.return_value = database

    with patch.object(mongodb, "MongoClient", return_value=client):
        result = mongodb.get_last_registered_repository("user-1")

    if result != {"user_id": "user-1"}:
        raise AssertionError(f"Unexpected MongoDB document: {result}")
    collection.find_one.assert_called_once_with({"user_id": "user-1"})
