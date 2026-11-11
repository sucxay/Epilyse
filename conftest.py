import sys
from pathlib import Path

import pytest

# Add the project root to sys.path so that `backend.app...` imports resolve
# correctly no matter which directory pytest is invoked from.
sys.path.insert(0, str(Path(__file__).resolve().parent))

from backend.app.auth import require_supabase_user
from backend.app.db.init_db import initialize_database
from backend.main import app


@pytest.fixture(autouse=True)
def authenticated_api_requests():
    initialize_database()
    app.dependency_overrides[require_supabase_user] = lambda: {
        "id": "00000000-0000-0000-0000-000000000001",
        "claims": {"role": "authenticated"},
    }
    yield
    app.dependency_overrides.pop(require_supabase_user, None)
