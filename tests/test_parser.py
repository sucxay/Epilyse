from pathlib import Path

from backend.app.parser.models import ParsedFile
from backend.app.parser.tree_sitter_parser import parse_files
from backend.app.services.source_analyzer import analyze_repository


def test_pipeline(tmp_path: Path):
    source_path = tmp_path / "main.py"
    source_path.write_text(
        "import os\n\nclass Service:\n    def run(self):\n        return os.getcwd()\n",
        encoding="utf-8",
    )

    # Stage 1: Discover and filter source files.
    source_files = analyze_repository(tmp_path)

    if not source_files:
        raise RuntimeError("Source analyzer found no supported files.")

    print(f"Source files discovered: {len(source_files)}")

    parsed_count = 0
    skipped_count = 0

    # Stage 2: Parse supported Python files.
    for file_info in source_files:
        path = tmp_path / file_info.path

        if file_info.language.lower() != "python":
            skipped_count += 1
            continue

        parsed = parse_files(path, tmp_path)

        # Stage 3: Validate the parsed model.
        if not isinstance(parsed, ParsedFile):
            raise TypeError(
                f"{path}: expected ParsedFile, "
                f"received {type(parsed).__name__}"
            )

        if not parsed.path:
            raise ValueError(f"{path}: parsed path is empty")

        if parsed.language != "python":
            raise ValueError(
                f"{path}: unexpected language {parsed.language!r}"
            )

        if not isinstance(parsed.imports, list):
            raise TypeError(f"{path}: imports must be a list")

        if not isinstance(parsed.definitions, list):
            raise TypeError(f"{path}: definitions must be a list")

        if not isinstance(parsed.calls, list):
            raise TypeError(f"{path}: calls must be a list")

        parsed_count += 1

        print(f"\nFile: {parsed.path}")
        print(f"  Imports: {len(parsed.imports)}")
        print(f"  Definitions: {len(parsed.definitions)}")
        print(f"  Calls: {len(parsed.calls)}")
        print(f"  Syntax errors: {parsed.has_errors}")

    if parsed_count == 0:
        raise RuntimeError("No Python files were parsed.")

    print("\nPipeline test passed.")
    print(f"Parsed Python files: {parsed_count}")
    print(f"Skipped non-Python files: {skipped_count}")