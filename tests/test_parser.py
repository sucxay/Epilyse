from pathlib import Path 
from backend.app.services.source_analyzer import analyze_repository
from backend.app.parser.tree_sitter import parse_files
from backend.app.parser.models import ParsedFile


REPO_ROOT = Path("/Users/suchayjoshi/Desktop/voice_assistant")


def test_pipeline():
    if not REPO_ROOT.is_dir():
        raise FileNotFoundError(
            f"Repository directory does not exist: {REPO_ROOT}"
        )

    # Stage 1: Discover and filter source files.
    source_files = analyze_repository(REPO_ROOT)

    if not source_files:
        raise RuntimeError("Source analyzer found no supported files.")

    print(f"Source files discovered: {len(source_files)}")

    parsed_count = 0
    skipped_count = 0

    # Stage 2: Parse supported Python files.
    for file_info in source_files:
        path = Path(file_info.path)

        if not path.is_absolute():
            path = REPO_ROOT / path

        if file_info.language.lower() != "python":
            skipped_count += 1
            continue

        parsed = parse_files(path, REPO_ROOT)

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


if __name__ == "__main__":
    test_pipeline()