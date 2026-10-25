"""Graph building utilities for the EPILYSE project.

The public entry point is :func:`build_graph` which consumes a list of
:class:`backend.app.parser.models.ParsedFile` objects (the output of the
Tree-sitter parser) and produces a collection of :class:`Node` and
:class:`Edge` objects ready to be persisted or inspected.
"""

from __future__ import annotations

from collections import defaultdict
from pathlib import PurePosixPath
from typing import Iterable, Tuple

from backend.app.parser.models import ParsedFile
from .models import Edge, Node


def _file_node(pf: ParsedFile) -> Node:
    """Create a deterministic file node.

    ``id`` format: ``file:<path>`` where *path* is the repository-relative POSIX
    path stored in ``ParsedFile.path``.
    """
    return Node(
        id=f"file:{pf.path}",
        type="file",
        path=pf.path,
        name=None,
        kind="file",
        line=None,
        end_line=None,
    )


def _symbol_node(pf: ParsedFile, d) -> Node:
    """Create a deterministic symbol node.

    The fully qualified name is built from the optional ``scope`` and the
    definition ``name``.  ``scope`` itself is already a dotted string (e.g.
    ``MyClass`` or ``MyClass.inner``) or ``None`` for top-level definitions.
    """
    full_name = f"{d.scope}.{d.name}" if d.scope else d.name
    node_id = f"symbol:{pf.path}:{full_name}"
    return Node(
        id=node_id,
        type="symbol",
        path=pf.path,
        name=full_name,
        kind=d.kind,  # type: ignore[arg-type]
        line=d.line,
        end_line=d.end_line,
    )


def _resolve_import_target(
    import_text: str, file_lookup: dict[str, Node]
) -> Node | None:
    """Resolve an import statement to a file node.

    Handles ``import foo.bar`` and ``from foo.bar import something``.  The full
    dotted module path is converted to a path by replacing dots with ``/`` and
    appending ``.py``.  If the full module cannot be found, resolution falls
    back to progressively shorter prefixes (``foo/bar.py`` -> ``foo.py``).
    """
    parts = import_text.replace(",", " ").split()
    if not parts:
        return None

    module_part: str | None = None
    if parts[0] == "import" and len(parts) > 1:
        module_part = parts[1]
    elif parts[0] == "from" and len(parts) > 1:
        module_part = parts[1]

    if not module_part:
        return None

    # Strip relative-import dots; we only resolve absolute imports.
    module_part = module_part.lstrip(".")
    if not module_part:
        return None

    # Try the full dotted path first, then successively shorter prefixes.
    components = module_part.split(".")
    for end in range(len(components), 0, -1):
        candidate = PurePosixPath("/".join(components[:end]) + ".py").as_posix()
        node = file_lookup.get(candidate)
        if node is not None:
            return node

    # Also try treating the last component as the module (e.g. ``foo.bar`` ->
    # ``bar.py``) for cases where the package is not present in the repo.
    last = components[-1]
    return file_lookup.get(PurePosixPath(last + ".py").as_posix())


def build_graph(parsed_files: Iterable[ParsedFile]) -> Tuple[list[Node], list[Edge]]:
    """Build a repository-wide graph.

    Returns a tuple ``(nodes, edges)`` where ``nodes`` is a list of
    :class:`Node` objects and ``edges`` a list of :class:`Edge` objects.
    """
    # Materialise the input so we can iterate multiple times safely.
    parsed_files = list(parsed_files)

    # ---------------------------------------------------------------------
    # 1) Create all file nodes and a lookup from path -> file Node.
    # ---------------------------------------------------------------------
    file_nodes: dict[str, Node] = {}
    for pf in parsed_files:
        fn = _file_node(pf)
        file_nodes[pf.path] = fn

    # ---------------------------------------------------------------------
    # 2) Create symbol nodes and lookups:
    #    - by full qualified name (for global resolution)
    #    - by bare name (for call resolution, since CallInfo.name is bare)
    # ---------------------------------------------------------------------
    symbol_nodes: list[Node] = []
    symbol_ids: set[str] = set()
    by_full_name: dict[str, list[Node]] = defaultdict(list)
    by_bare_name: dict[str, list[Node]] = defaultdict(list)

    for pf in parsed_files:
        for d in pf.definitions:
            sn = _symbol_node(pf, d)
            symbol_nodes.append(sn)
            symbol_ids.add(sn.id)

            # Node.name is typed as ``str | None`` (file nodes use None), but
            # symbol nodes always have a name. Narrow it for the type checker.
            if sn.name is None:
                continue

            # sn.name is the fully qualified name (e.g. "MyClass.method").
            by_full_name[sn.name].append(sn)
            bare = sn.name.rsplit(".", 1)[-1]
            by_bare_name[bare].append(sn)

    # ---------------------------------------------------------------------
    # 3) Assemble edges.
    # ---------------------------------------------------------------------
    edges: list[Edge] = []

    # 3a - contains edges (file -> symbol)
    for sn in symbol_nodes:
        edges.append(Edge(source=f"file:{sn.path}", target=sn.id, type="contains"))

    # 3b - import edges (file -> file)
    for pf in parsed_files:
        src_id = file_nodes[pf.path].id
        for imp in pf.imports:
            target_node = _resolve_import_target(imp.text, file_nodes)
            if target_node is not None:
                edges.append(Edge(source=src_id, target=target_node.id, type="import"))
            # Unresolved imports are ignored per specification.

    # 3c - call edges (caller -> callee)
    for pf in parsed_files:
        for call in pf.calls:
            # --- resolve caller -------------------------------------------------
            if call.scope:
                caller_id = f"symbol:{pf.path}:{call.scope}"
                if caller_id not in symbol_ids:
                    caller_id = f"file:{pf.path}"
            else:
                caller_id = f"file:{pf.path}"

            # --- resolve callee -------------------------------------------------
            # CallInfo.name is a bare identifier (e.g. "foo"), so match against
            # the bare-name index rather than the fully qualified one.
            candidates = by_bare_name.get(call.name, [])
            if not candidates:
                continue

            same_file = [c for c in candidates if c.path == pf.path]

            target_node: Node | None = None
            if len(same_file) == 1:
                target_node = same_file[0]
            elif len(candidates) == 1:
                target_node = candidates[0]

            if target_node is not None:
                edges.append(
                    Edge(source=caller_id, target=target_node.id, type="calls")
                )
            # Otherwise the call is ambiguous / unresolved - no edge is added.

    # ---------------------------------------------------------------------
    # 4) Return combined node list and edge list (deduplicated).
    # ---------------------------------------------------------------------
    all_nodes = list(file_nodes.values()) + symbol_nodes

    # Deduplicate edges while preserving insertion order.
    seen: set[tuple[str, str, str]] = set()
    unique_edges: list[Edge] = []
    for e in edges:
        key = (e.source, e.target, e.type)
        if key in seen:
            continue
        seen.add(key)
        unique_edges.append(e)

    return all_nodes, unique_edges