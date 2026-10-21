import sys
from pathlib import Path

# Add project root to sys.path so 'backend' package imports resolve regardless of cwd
project_root = Path(__file__).resolve().parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

from fastapi import FastAPI 
from backend.app.api.repositories import router as repositories_router 
from backend.app.api import cloning
from backend.app.db.init_db import initialize_database

app = FastAPI(title = "Epilyse",version = "0.0.1")

@app.on_event("startup")
def on_startup():
    initialize_database()

app.include_router(repositories_router)
app.include_router(cloning.router)
@app.get("/health")
def health():
    return {"status":"ok"}

    

