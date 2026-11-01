
import pytest

from backend.app.services.repo_cloner import validate_repo


@pytest.mark.parametrize(
    "url",
    [
        "http://github.com/example/project",
        "https://user:password@github.com/example/project",
        "https://github.com/example/project?token=secret",
        "https://github.com/example/project#fragment",
    ],
)
def test_validate_repo_rejects_unsafe_urls(url: str):
    with pytest.raises(ValueError):
        validate_repo(url)


def test_validate_repo_accepts_https_github_url():
    validate_repo("https://github.com/example/project.git")
