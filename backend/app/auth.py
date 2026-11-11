"""Supabase JWT authentication for protected API routes."""

from __future__ import annotations

import os
import uuid
from functools import lru_cache
from typing import Any

import jwt
from fastapi import HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient

_bearer = HTTPBearer(auto_error=False)


def _supabase_url() -> str:
    return os.getenv("SUPABASE_URL", "").rstrip("/")


def _issuer() -> str:
    return os.getenv("SUPABASE_JWT_ISSUER", "").rstrip("/") or f"{_supabase_url()}/auth/v1"


@lru_cache(maxsize=1)
def _jwks_client() -> PyJWKClient:
    jwks_url = os.getenv("SUPABASE_JWKS_URL") or f"{_supabase_url()}/auth/v1/.well-known/jwks.json"
    if jwks_url == "/auth/v1/.well-known/jwks.json":
        raise RuntimeError("SUPABASE_URL is not configured.")
    return PyJWKClient(jwks_url)


def require_supabase_user(
    credentials: HTTPAuthorizationCredentials | None = Security(_bearer),
) -> dict[str, Any]:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Bearer token required.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        signing_key = _jwks_client().get_signing_key_from_jwt(credentials.credentials)
        claims = jwt.decode(
            credentials.credentials,
            signing_key.key,
            algorithms=["ES256", "RS256"],
            audience=os.getenv("SUPABASE_JWT_AUDIENCE", "authenticated"),
            issuer=_issuer(),
            options={"require": ["exp", "sub", "iss", "aud"]},
        )
        user_id = uuid.UUID(str(claims["sub"]))
        if claims.get("role") != "authenticated":
            raise ValueError("Invalid Supabase role.")
    except (jwt.PyJWTError, KeyError, ValueError, RuntimeError, OSError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired Supabase access token.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    return {"id": str(user_id), "claims": claims}
