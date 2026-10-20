from fastapi import FastAPI 
from backend.app.api.repositories import router as repositories_router 

app = FastAPI(title = "Epilyse",version = "0.0.1")
app.include_router(repositories_router)

@app.get("/health")
def health():
    return {"status":"ok"}

    

