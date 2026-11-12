"""Lazy MongoDB persistence for user-specific repository registrations."""

from __future__ import annotations

import os
from functools import lru_cache
from typing import Any

from pymongo import MongoClient
from pymongo.collection import Collection
from pymongo.errors import PyMongoError


class MongoPersistenceError(RuntimeError):
    """Raised when MongoDB configuration or persistence is unavailable."""


def _settings() -> tuple[str, str, str]:
    uri = os.getenv("MONGODB_URI", "").strip()
    database = os.getenv("MONGODB_DATABASE", "").strip()
    collection = os.getenv("MONGODB_COLLECTION", "").strip()
    missing = [
        name
        for name, value in (
            ("MONGODB_URI", uri),
            ("MONGODB_DATABASE", database),
            ("MONGODB_COLLECTION", collection),
        )
        if not value
    ]
    if missing:
        raise MongoPersistenceError(
            f"MongoDB is not configured. Missing: {', '.join(missing)}."
        )
    return uri, database, collection


@lru_cache(maxsize=4)
def _client(uri: str) -> MongoClient:
    return MongoClient(uri, serverSelectionTimeoutMS=5000)


def _collection() -> Collection:
    uri, database, collection = _settings()
    return _client(uri)[database][collection]


def save_last_registered_repository(user_id: str, registration: dict[str, Any]) -> None:
    """Replace the authenticated user's previous registration."""

    document = {
        "user_id": user_id,
        "repository_id": registration["repository_id"],
        "url": registration["url"],
        "owner": registration["owner"],
        "name": registration["name"],
        "branch": registration["selected_branch"],
        "commit": registration["current_commit_sha"],
        "timestamp": registration.get("registered_at"),
    }
    if document["timestamp"] is None:
        raise MongoPersistenceError("Registration timestamp is missing.")

    try:
        _collection().replace_one({"user_id": user_id}, document, upsert=True)
    except PyMongoError as exc:
        raise MongoPersistenceError("MongoDB could not save the registration.") from exc


def get_last_registered_repository(user_id: str) -> dict[str, Any] | None:
    """Return the authenticated user's latest registration, if one exists."""

    try:
        document = _collection().find_one({"user_id": user_id})
    except PyMongoError as exc:
        raise MongoPersistenceError("MongoDB could not read the registration.") from exc

    if document is None:
        return None
    document.pop("_id", None)
    return document
