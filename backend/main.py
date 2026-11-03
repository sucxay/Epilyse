import sys
import os
from pathlib import Path

# Add project root to sys.path so 'backend' package imports resolve regardless of cwd
project_root = Path(__file__).resolve().parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.api.repositories import router as repositories_router 
from backend.app.api import cloning
from backend.app.api import graph
from backend.app.api import webhook
from backend.app.db.init_db import initialize_database

app = FastAPI(title = "Epilyse",version = "0.0.1")

configured_origins = os.getenv("CORS_ORIGINS", "")
cors_origins = [
    origin.strip()
    for origin in configured_origins.split(",")
    if origin.strip()
]
if not cors_origins:
    cors_origins = ["http://localhost:3000", "http://127.0.0.1:3000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    initialize_database()

app.include_router(repositories_router)
app.include_router(cloning.router)
app.include_router(graph.router)
app.include_router(webhook.router)
@app.get("/health")
def health():
    return {"status":"ok"}

    
