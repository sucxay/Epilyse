"""Tests for the repository‑wide graph builder.

The tests construct :class:`ParsedFile` objects directly (no file I/O) and
verify that the graph contains the expected nodes and edges.  Instead of the
usual ``assert`` statements we raise ``RuntimeError`` with a clear message when a
condition is not satisfied – this follows the project's guideline of not
using bare ``assert`` in test code.
"""

from hashlib import sha256

import pytest

from backend.app.parser.models import CallInfo, DefinitionInfo, ImportInfo, ParsedFile
from backend.app.graph.builder import build_graph
from backend.app.graph.models import Edge, Node


def _expect(condition: bool, message: str) -> None:
    """Helper that raises ``RuntimeError`` when *condition* is falsy.

    Using a helper keeps the test bodies concise while still providing explicit
    failure messages.
    """
    if not condition:
        raise RuntimeError(message)


def test_basic_nodes_and_contains_edges() -> None:
    """A file with a single class definition creates one file node, one symbol
    node and a ``contains`` edge linking them.
    """
    parsed = ParsedFile(
        path="a.py",
        language="python",
        has_errors=False,
        imports=[],
        definitions=[
            DefinitionInfo(
                name="MyClass",
                kind="class",
                scope=None,
                line=1,
                end_line=5,
            )
        ],
        calls=[],
    )

    nodes, edges = build_graph([parsed])

    # Expect exactly two nodes: the file and the class symbol.
    _expect(len(nodes) == 2, f"Expected 2 nodes, got {len(nodes)}")

    file_node = next(n for n in nodes if n.type == "file")
    symbol_node = next(n for n in nodes if n.type == "symbol")

    _expect(file_node.id == "file:a.py", "File node id mismatch")
    _expect(symbol_node.id == "symbol:a.py:MyClass", "Symbol node id mismatch")

    # One ``contains`` edge from file to symbol.
    contains_edges = [e for e in edges if e.type == "contains"]
    _expect(len(contains_edges) == 1, f"Expected 1 contains edge, got {len(contains_edges)}")
    e = contains_edges[0]
    _expect(e.source == file_node.id and e.target == symbol_node.id, "Contains edge points to wrong nodes")


def test_import_edge() -> None:
    """File ``a.py`` imports ``b``; an ``import`` edge should link the two file
    nodes.
    """
    a = ParsedFile(
        path="a.py",
        language="python",
        has_errors=False,
        imports=[ImportInfo(text="import b", line=1)],
        definitions=[],
        calls=[],
    )
    b = ParsedFile(
        path="b.py",
        language="python",
        has_errors=False,
        imports=[],
        definitions=[],
        calls=[],
    )

    nodes, edges = build_graph([a, b])

    import_edges = [e for e in edges if e.type == "import"]
    _expect(len(import_edges) == 1, f"Expected 1 import edge, got {len(import_edges)}")
    imp = import_edges[0]
    _expect(imp.source == "file:a.py" and imp.target == "file:b.py", "Import edge targets incorrect")


def test_calls_edge_resolvable() -> None:
    """Top‑level call ``foo()`` should create a ``calls`` edge from the file
    node to the ``foo`` symbol node.
    """
    parsed = ParsedFile(
        path="mod.py",
        language="python",
        has_errors=False,
        imports=[],
        definitions=[
            DefinitionInfo(
                name="foo",
                kind="function",
                scope=None,
                line=2,
                end_line=4,
            )
        ],
        calls=[CallInfo(name="foo", scope=None, line=6)],
    )

    nodes, edges = build_graph([parsed])

    call_edges = [e for e in edges if e.type == "calls"]
    _expect(len(call_edges) == 1, f"Expected 1 calls edge, got {len(call_edges)}")
    e = call_edges[0]
    _expect(e.source == "file:mod.py", "Calls edge source should be the file node")
    _expect(e.target == "symbol:mod.py:foo", "Calls edge target should be the foo symbol")


def test_unresolved_call_no_edge() -> None:
    """A call to an unknown name must not generate a ``calls`` edge.
    """
    parsed = ParsedFile(
        path="lonely.py",
        language="python",
        has_errors=False,
        imports=[],
        definitions=[],
        calls=[CallInfo(name="does_not_exist", scope=None, line=1)],
    )

    _, edges = build_graph([parsed])
    call_edges = [e for e in edges if e.type == "calls"]
    _expect(len(call_edges) == 0, f"Expected no calls edges, got {len(call_edges)}")


def test_nodes_include_source_snapshots_and_revision_metadata() -> None:
    """File and symbol nodes expose their source-backed snapshot metadata."""
    source = "class Example:\n    def run(self):\n        return 1\n"
    parsed = ParsedFile(
        path="example.py",
        language="python",
        has_errors=False,
        source_code=source,
        definitions=[
            DefinitionInfo(
                name="Example",
                kind="class",
                scope=None,
                line=1,
                end_line=3,
            ),
            DefinitionInfo(
                name="run",
                kind="method",
                scope="Example",
                line=2,
                end_line=3,
            ),
        ],
        imports=[],
        calls=[],
    )

    nodes, _ = build_graph([parsed], previous_reference="previous-sha")
    file_node = next(node for node in nodes if node.type == "file")
    method_node = next(node for node in nodes if node.name == "Example.run")

    _expect(file_node.source_code == source, "File source snapshot mismatch")
    _expect(method_node.source_code == "    def run(self):\n        return 1\n", "Symbol snapshot mismatch")
    _expect(file_node.start_line == 1 and file_node.end_line == 3, "File line range mismatch")
    _expect(method_node.start_line == 2 and method_node.end_line == 3, "Symbol line range mismatch")
    _expect(file_node.classes == ["Example"], "File class metadata mismatch")
    _expect(file_node.functions == ["Example.run"], "File function metadata mismatch")
    _expect(method_node.functions == ["Example.run"], "Symbol function metadata mismatch")
    _expect(
        file_node.code_hash == sha256(source.encode()).hexdigest(),
        "File code hash mismatch",
    )
    _expect(
        file_node.previous_reference == "previous-sha"
        and method_node.previous_reference == "previous-sha",
        "Previous reference mismatch",
    )
