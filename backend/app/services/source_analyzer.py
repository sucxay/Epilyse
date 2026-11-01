import os
from dataclasses import dataclass
from pathlib import Path


EXCLUDED_DIRS = {
    ".git",
    "node_modules",
    ".venv",
    "venv",
    "__pycache__",
    "dist",
    "build",
}

SUPPORTED_EXTENSIONS = {
    ".py",
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".java",
    ".go",
    ".rs",
}

MAX_FILE_SIZE_BYTES = 1_000_000

LANGUAGE_MAP = {
    ".py": "python",
    ".js": "javascript",
    ".jsx": "javascript",
    ".ts": "typescript",
    ".tsx": "typescript",
    ".java": "java",
    ".go": "go",
    ".rs": "rust",
}




def discover_files(repo_path: str | Path) -> list[Path]:
    """Return repository files in deterministic order.

    Excluded directories are pruned before traversal so large dependency and
    build trees do not incur filesystem work that will be discarded later.
    """
    root = Path(repo_path).resolve()

    if not root.exists():
        raise FileNotFoundError(f"Repository path does not exist: {root}")

    if not root.is_dir():
        raise NotADirectoryError(f"Repository path is not a directory: {root}")

    files: list[Path] = []
    for current_root, directories, filenames in os.walk(root):
        directories[:] = sorted(
            directory
            for directory in directories
            if directory not in EXCLUDED_DIRS
        )
        files.extend(
            path
            for path in (Path(current_root) / filename for filename in filenames)
            if path.is_file()
        )
    return sorted(files)


def should_exclude(path: Path, repo_path: str | Path) -> bool:
    relative_path = path.relative_to(repo_path)
    if any(part in EXCLUDED_DIRS for part in relative_path.parts[:-1]):
        return True
    if path.suffix.lower() not in SUPPORTED_EXTENSIONS:
        return True
    if path.stat().st_size > MAX_FILE_SIZE_BYTES:
        return True

    return False


def detect_language(path: Path) -> str | None:
    return LANGUAGE_MAP.get(path.suffix.lower())



@dataclass(frozen=True)
class FileInfo:
    path:str 
    language:str 
    size:int 
     

def analyze_file(path: Path, repo_root: Path) -> FileInfo | None:
    language = detect_language(path)

    if language is None:
        return None
    try:
        size = path.stat().st_size
    except OSError:
        return None
    return FileInfo(
        path=path.relative_to(repo_root).as_posix(),
        language=language,
        size=size,
    )




def analyze_repository(repo_path: str | Path) -> list[FileInfo]:
    root = Path(repo_path).resolve()
    candidates = discover_files(root)
    results: list[FileInfo] = []
    for path in candidates:
        if should_exclude(path,root):
            continue

        file_info = analyze_file(path,root)
        if file_info is not None:
            results.append(file_info)

    return results 

