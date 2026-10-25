# EPILYSE — Agent Instructions

## Project Goal
Build a repository-aware code analysis and retrieval system.

## Architecture
- `cloner.py`: Clone repositories at a specified commit.
- `tree_sitter.py`: Parse source code using Tree-sitter.
- `source_analyzer.py`: Discover source files and extract symbols, imports, and calls.
- `models.py`: Define shared data structures.
- `graph_builder.py`: Build a graph of repository files, symbols, and relationships.
- `snapshot_builder.py`: Orchestrate snapshot creation.

## Ruless
- Inspect existing code before making changes.
- Reuse existing modules and data structures.
- Do not duplicate parsing or source discovery logic.
- Support all languages already supported by the parser.
- Do not introduce unnecessary dependencies.
- Do not use assertions in tests; use explicit checks and descriptive failures.
- Keep functions focused and type-annotated.
- Never invent relationships that cannot be supported by source evidence.

## Workflow
1. Inspect relevant files and tests.
2. Explain the proposed implementation briefly.
3. Implement only the requested task.
4. Add or update tests.
5. Run the relevant tests.
6. Report changed files, test results, and unresolved issues.

## Graph Builder Requirements
- Represent files, classes, functions, and other supported symbols as nodes.
- Represent imports and function calls as edges when resolvable.
- Use stable identifiers for nodes.
- Validate that every edge references existing nodes.
- Handle empty files, unresolved imports, and duplicate symbols gracefully.
- Follow the existing schemas in `models.py`.
