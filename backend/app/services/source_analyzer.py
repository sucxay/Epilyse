import subprocess 
import os 
from pathlib import Path 
from dataclasses import dataclass 


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




def discover_files(repo_path:str | Path)->list[Path]:
    root = Path(repo_path)

    if not root.exists() : 
        raise FileNotFoundError("Does not exists")

    if not root.is_dir() : 
        raise NotADirectoryError("Not a directory")

    return sorted ( 
        path for path in root.rglob("*")
        if path.is_file()

    ) 


def should_exclude(path :Path  , repo_path)->bool:
    relative_path = path.relative_to(repo_path)   
    if any (part in EXCLUDED_DIRS for part in relative_path.parts[:-1]):
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
     

def analyze_file(path:Path , repo_root:Path)->FileInfo|None:
    language= detect_language(path)

    if language is None : 
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




def analyze_repository(repo_path : str | Path)-> list[FileInfo]:
    root= Path(repo_path).resolve()
    candidates= discover_files(root)
    results = []
    for path in candidates : 
        if should_exclude(path,root):
            continue

        file_info = analyze_file(path,root)
        if file_info is not None: 
            results.append(file_info)

    return results 




