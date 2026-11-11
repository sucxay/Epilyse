from datetime import datetime, timezone
from unittest.mock import patch

import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from backend.app import auth


class FakeJwkClient:
    def get_signing_key_from_jwt(self, token: str):
        if token != "valid-token":
            raise ValueError("unknown token")
        return type("SigningKey", (), {"key": "public-key"})()


def test_missing_bearer_token_returns_401():
    with pytest.raises(HTTPException) as error:
        auth.require_supabase_user(None)

    if error.value.status_code != 401:
        raise AssertionError(f"Expected 401 for a missing token, got {error.value.status_code}")


def test_valid_supabase_token_extracts_uuid(monkeypatch):
    user_id = "12345678-1234-5678-1234-567812345678"
    monkeypatch.setenv("SUPABASE_URL", "https://project.supabase.co")
    monkeypatch.delenv("SUPABASE_JWT_ISSUER", raising=False)
    auth._jwks_client.cache_clear()
    with (
        patch.object(auth, "_jwks_client", return_value=FakeJwkClient()),
        patch.object(
            auth.jwt,
            "decode",
            return_value={
                "sub": user_id,
                "role": "authenticated",
                "exp": int(datetime.now(timezone.utc).timestamp()) + 300,
                "iss": "https://project.supabase.co/auth/v1",
                "aud": "authenticated",
            },
        ) as decode,
    ):
        result = auth.require_supabase_user(
            HTTPAuthorizationCredentials(scheme="Bearer", credentials="valid-token")
        )

    if result["id"] != user_id:
        raise AssertionError(f"Expected Supabase UUID {user_id}, got {result['id']}")
    if decode.call_args.kwargs["issuer"] != "https://project.supabase.co/auth/v1":
        raise AssertionError("JWT issuer was not validated against the Supabase issuer")


def test_public_supabase_url_can_configure_backend(monkeypatch):
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.setenv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co")
    monkeypatch.delenv("SUPABASE_JWT_ISSUER", raising=False)

    if auth._issuer() != "https://project.supabase.co/auth/v1":
        raise AssertionError("Expected the public Supabase URL to configure the JWT issuer")


def test_invalid_supabase_token_returns_401():
    with (
        patch.object(auth, "_jwks_client", return_value=FakeJwkClient()),
        patch.object(auth.jwt, "decode", side_effect=auth.jwt.InvalidTokenError("expired")),
    ):
        with pytest.raises(HTTPException) as error:
            auth.require_supabase_user(
                HTTPAuthorizationCredentials(scheme="Bearer", credentials="valid-token")
            )

    if error.value.status_code != 401:
        raise AssertionError(f"Expected 401 for an invalid token, got {error.value.status_code}")
