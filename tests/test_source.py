from pathlib import Path

from backend.app.services.source_analyzer import analyze_repository


def test_analyze_repository_filters_unsupported_and_excluded_files(tmp_path: Path):
    (tmp_path / "src").mkdir()
    (tmp_path / "node_modules").mkdir()
    (tmp_path / "src" / "main.py").write_text("print('ok')", encoding="utf-8")
    (tmp_path / "src" / "notes.txt").write_text("ignored", encoding="utf-8")
    (tmp_path / "node_modules" / "dependency.py").write_text(
        "print('ignored')",
        encoding="utf-8",
    )

    files = analyze_repository(tmp_path)

    if [(file.path, file.language) for file in files] != [("src/main.py", "python")]:
        raise AssertionError(f"Unexpected analyzed files: {files}")

