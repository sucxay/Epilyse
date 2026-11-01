from dataclasses import dataclass, field
from typing import Literal


@dataclass(frozen=True)
class Node:
    """A stable graph node representing either a file or a symbol.

    The ``id`` is deterministic and can be used to reference the node from edges.
    """
    id: str
    type: Literal["file", "symbol"]
    path: str  # repository‑relative POSIX path
    name: str | None  # symbol name (None for file nodes)
    kind: Literal["file", "class", "function", "method"] | None
    line: int | None = None
    end_line: int | None = None
    source_code: str = ""
    start_line: int | None = None
    functions: list[str] = field(default_factory=list)
    classes: list[str] = field(default_factory=list)
    code_hash: str = ""
    previous_reference: str | None = None


@dataclass(frozen=True)
class Edge:
    """A directed relationship between two nodes.

    ``type`` denotes the semantic of the relationship:
    * ``contains`` – a file contains a symbol definition
    * ``import``   – a file imports another file
    * ``calls``   – a symbol (or a file when the call is at module level) calls another symbol
    """
    source: str  # Node.id
    target: str  # Node.id
    type: Literal["contains", "import", "calls"]
