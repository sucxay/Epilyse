"""
shallow Clone git repositories based on the hash code """ 

from collections.abc import Generator
from opentelemetry.context import contextvars_context
from collections.abc import Iterator
import os 
from pathlib import Path 
from urllib.parse import urlparse 
import re 
import subprocess 
from contextlib import contextmanager 
from typing import Iterator   ,Generator
import tempfile 


def validate_repo(url:str)->None:
    """Allow ont github repo to get cloned """
    parsed = urlparse(url) 

    if parsed.scheme !="https" or parsed.hostname!='github.com':
        raise ValueError("URL is not github url")
    if parsed.username and parsed.password:
        raise ValueError("Creditianls are not allowed")

    if parsed.query or parsed.fragment :
        raise ValueError("Query and fragment are not allowed")

    parts = parsed.path.strip('/').split('/')
    if len(parts)!=2 or not all(parts):
        raise ValueError("URL is not valid ")
    
    owner , repo = parts 
    if repo.endswith(".git"):
        repo = repo[:-4]
    
    pattern = r"[A-Za-z0-9_.-]+"

    if not re.fullmatch(pattern, owner):
        raise ValueError("Invalid GitHub owner.")

    if not re.fullmatch(pattern, repo):
        raise ValueError("Invalid repository name.")


def run_git(args  :list[str] , cwd: Path| None= None , timeout : int = 300 , )->str :
    """execute git and return standard output """

    result = subprocess.run(
        ['git' ,*args], cwd = cwd , timeout= timeout , text= True , check=False ,capture_output=True ,
        env = os.environ.copy()


    )

    if result.returncode!=0 : 
        message= result.stderr.strip() or 'Git commnad failed'
        raise RuntimeError(message)

    return result.stdout.strip()

@contextmanager
def shallow_checkout(respository_url:str , commit_sha:str)->Generator[Path]:
    """
    Create a temporary shallow checkout of specifi commits 
    The checkout exists inside the `with` block and is removed
    automatically when the block exits
    """

    validate_repo(respository_url)
    if not re.fullmatch(r"[a-f0-9]{32,64}",commit_sha):
        raise ValueError("commit sha is not valid")

    with tempfile.TemporaryDirectory(prefix="epilyse") as temp_dir: 
        repo_path = Path(temp_dir)/'repository'
        run_git(
            [
                'clone' , 
                '--depth','1',
                '--no-tags', 
                respository_url,
                f"{repo_path}"  
            ]

        )
        actual_sha = run_git(
            ['rev-parse','HEAD']
            ,cwd = repo_path 
        )

        if actual_sha.lower() != commit_sha.lower():
            run_git(
                ["fetch", "--depth", "1", "origin", commit_sha],
                cwd=repo_path,
            )

            run_git(
                ["checkout", "--detach", commit_sha],
                cwd=repo_path,
            )

        
        actual_sha = run_git(
            ["rev-parse", "HEAD"],
            cwd=repo_path,
        )

        if actual_sha.lower() != commit_sha.lower():
            raise RuntimeError(
                f"Commit mismatch: requested {commit_sha}, "
                f"checked out {actual_sha}"
            )

        yield repo_path




