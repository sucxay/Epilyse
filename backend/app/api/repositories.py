from fastapi.exceptions import FastAPIError
from fastapi import APIRouter , HTTPException

from ..schemas.github_schemas import RepositoryRegisterRequest
from ..services.github_ingestion import register_repository 

router = APIRouter(prefix ="/repositories",tags=['Repositories'])
@router.post("/register",status_code=201)
def register(request : RepositoryRegisterRequest):
    try:
        return register_repository(request.url , request.branch , request.sha)
    except ValueError as exc :
        raise HTTPException(status_code=400 , detail=str(exc))
    