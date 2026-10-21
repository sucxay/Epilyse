
from backend.app.services.repo_cloner import shallow_checkout, run_git


REPOSITORY_URL = "https://github.com/sucxay/sound-ai"
COMMIT_SHA = "78a16c09c9ebf11648a8371997a8c997e0a6f5e2"


def test_shallow_checkout():
    with shallow_checkout(REPOSITORY_URL, COMMIT_SHA) as repo_path:
        assert repo_path.exists()
        assert (repo_path / ".git").exists()

        actual_sha = run_git(
            ["rev-parse", "HEAD"],
            cwd=repo_path,
        )

        assert actual_sha == COMMIT_SHA

        # Print a few tracked repository paths for inspection.
        files = run_git(
            ["ls-files"],
            cwd=repo_path,
        ).splitlines()

        print("Checked out commit:", actual_sha)
        print("Tracked files:", len(files))
        print("Sample files:", files[:10])


if __name__ == "__main__":
    test_shallow_checkout()
