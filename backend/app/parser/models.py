
from dataclasses import dataclass, field 

@dataclass 
class ImportInfo: 
    text: str
    line: int

@dataclass 
class DefinitionInfo:
    name: str 
    kind: str
    scope: str | None 
    line: int
    end_line: int

@dataclass
class CallInfo:
    name: str 
    scope: str | None 
    line: int

@dataclass
class ParsedFile:
    path :str 
    language:str
    has_errors: bool 
    imports :list[ImportInfo] = field(default_factory=list)
    definitions: list[DefinitionInfo] = field(default_factory=list)
    calls: list[CallInfo] = field(default_factory=list)
    
