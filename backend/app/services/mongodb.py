"""Lazy MongoDB persistence for user-specific repository registrations."""

from __future__ import annotations

import os
import logging
from functools import lru_cache
from typing import Any
from urllib.parse import urlsplit

from pymongo import MongoClient
from pymongo.collection import Collection
from pymongo.errors import (
    AutoReconnect,
    ConfigurationError,
    ConnectionFailure,
    NetworkTimeout,
    OperationFailure,
    PyMongoError,
    ServerSelectionTimeoutError,
)

logger = logging.getLogger(__name__)


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
    try:
        parsed_uri = urlsplit(uri)
        hostname = parsed_uri.hostname
    except ValueError:
        raise MongoPersistenceError(
            "MongoDB configuration is invalid: MONGODB_URI must use "
            "mongodb:// or mongodb+srv:// with a host."
        ) from None
    if (
        parsed_uri.scheme not in {"mongodb", "mongodb+srv"}
        or not hostname
    ):
        raise MongoPersistenceError(
            "MongoDB configuration is invalid: MONGODB_URI must use "
            "mongodb:// or mongodb+srv:// with a host."
        )
    return uri, database, collection


@lru_cache(maxsize=4)
def _client(uri: str) -> MongoClient:
    return MongoClient(uri, serverSelectionTimeoutMS=5000)


def _failure(operation: str, exc: BaseException) -> MongoPersistenceError:
    if isinstance(exc, ConfigurationError):
        category = "configuration"
        message = "MongoDB configuration is invalid."
    elif isinstance(exc, OperationFailure) and exc.code == 18:
        category = "authentication"
        message = "MongoDB authentication failed."
    elif isinstance(
        exc,
        (
            ServerSelectionTimeoutError,
            ConnectionFailure,
            NetworkTimeout,
            AutoReconnect,
        ),
    ):
        category = "connection"
        message = "MongoDB is unavailable."
    else:
        category = "operation"
        message = "MongoDB could not complete the operation."

    logger.error("MongoDB %s failure (%s)", operation, category)
    return MongoPersistenceError(f"{message} Could not {operation} the registration.")


def _collection(operation: str) -> Collection:
    try:
        uri, database, collection = _settings()
        return _client(uri)[database][collection]
    except MongoPersistenceError as exc:
        logger.error("MongoDB %s failure (configuration)", operation)
        raise exc
    except PyMongoError as exc:
        raise _failure(operation, exc) from exc


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
        _collection("save").replace_one({"user_id": user_id}, document, upsert=True)
    except PyMongoError as exc:
        raise _failure("save", exc) from exc


def get_last_registered_repository(user_id: str) -> dict[str, Any] | None:
    """Return the authenticated user's latest registration, if one exists."""

    try:
        document = _collection("read").find_one({"user_id": user_id})
    except PyMongoError as exc:
        raise _failure("read", exc) from exc

    if document is None:
        return None
    return {key: value for key, value in document.items() if key != "_id"}
