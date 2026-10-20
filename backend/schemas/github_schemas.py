from time import time
from pydantic import BaseModel ,Field
from typing import Literal 
from datetime import datetime, timezone

def utc_now()-> datetime: 
    return datetime.now(timezone.utc)


class Repository(BaseModel):
    repo_id:int 
    name:str 
    owner:str 
    url :str 

    default_branch: str 
    selected_branch: str
    latest_commit_sha : str |None = None 

    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)

    last_error : str | None = None 

    

