from pathlib import Path 
import tree_sitter_python 
from tree_sitter import Language , Parser 

from backend.app.parser.models import ParsedFile, ImportInfo, DefinitionInfo, CallInfo


PYTHON_LANGUAGE = Language(tree_sitter_python.language())

def get_language(language:str)->Language:
    """Return the Tree Sitter grammar for supported Language"""
    if language.lower() =='python':
        return PYTHON_LANGUAGE


    raise ValueError(f"Unsupported language : {language}")

def parse_source(source:bytes , language :str):
    grammar = get_language(language)
    parser = Parser(grammar)
    return parser.parse(source)



def extract_imports(root_node , source:bytes) -> list[ImportInfo]:
    """Extract Python import statements """
    imports = []

    def walk(node):
        if node.type in ('import_statement', 'import_from_statement'):
            imports.append(
                ImportInfo(
                    text=source[node.start_byte:node.end_byte].decode(
                        'utf-8' , errors = 'replace'
                    ),
                    line=node.start_point.row+1
                )
            )

        for child in node.children:
            walk(child)

    walk(root_node)

    return imports 



def extract_definition(root_node ) -> list[DefinitionInfo]:
    """Extract Python function/class defs"""
    definitions = []

    def walk(node, scope=None):
        current_scope = scope

        if node.type in ("class_definition", "function_definition"):
            name_node = node.child_by_field_name("name")
            name = name_node.text.decode("utf-8") if name_node else "<unknown>"

            kind = (
                "class"
                if node.type == "class_definition"
                else "method" if scope else "function"
            )

            definitions.append(DefinitionInfo(
                name=name,
                kind=kind,
                scope=scope,
                line=node.start_point.row + 1,
                end_line=node.end_point.row + 1,
            ))

            current_scope = f"{scope}.{name}" if scope else name

        for child in node.children:
            walk(child, current_scope)

    walk(root_node)
    return definitions


def extract_calls(root_node, source: bytes) -> list[CallInfo]:
    """Extract function and method calls with their enclosing scope."""
    calls = []


    def walk(node, scope=None):
        current_scope = scope

        if node.type in ("class_definition", "function_definition"):
            name_node = node.child_by_field_name("name")
            name = name_node.text.decode("utf-8") if name_node else "<unknown>"
            current_scope = f"{scope}.{name}" if scope else name

        if node.type == "call":
            function_node = node.child_by_field_name("function")

            if function_node is not None:
                calls.append(CallInfo(
                    name=source[
                        function_node.start_byte:function_node.end_byte
                    ].decode("utf-8", errors="replace"),
                    scope=scope,
                    line=node.start_point.row + 1,
                ))

        for child in node.children:
            walk(child, current_scope)

    walk(root_node)
    return calls




def parse_files(file_path : str|Path , repo_root : str | Path )-> ParsedFile:
    """Parse one python file and return normalized code information."""

    file_path = Path(file_path).resolve()
    repo_root = Path(repo_root).resolve()


    relative_path = file_path.relative_to(repo_root).as_posix()
    source = file_path.read_bytes()

    tree = parse_source(source,"python")
    root_node = tree.root_node

    return ParsedFile(
        path=relative_path, 
        language='python',
        has_errors=root_node.has_error,
        imports=extract_imports(root_node , source),
        definitions=extract_definition(root_node),
        calls=extract_calls(root_node , source)
    )