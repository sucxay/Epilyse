# EPILYSE — Agent Instructions

## Project Goal
Build a repository-aware code analysis and retrieval system.

## Source of Truth
- The code is the source of truth for architecture. Do not assume a module layout from memory or from this file.
- At the start of every task, discover the current structure: list the directories, read module docstrings, and read the tests.
- If `ARCHITECTURE.md` exists, read it, but trust the code if the two disagree and report the mismatch.
- If you add, remove, rename, or change the responsibility of a module, update `ARCHITECTURE.md` in the same change. Create it if missing, with one line per module describing its single responsibility.

## Core Principles
- Inspect existing code before making changes.
- Reuse existing modules, utilities, and data structures. Search before writing new code.
- Do not duplicate logic. Parsing, file discovery, and shared data definitions each live in one place.
- Keep one responsibility per module and per function. Keep functions focused and type-annotated.
- Do not introduce dependencies without asking.
- Never invent relationships, symbols, or facts that cannot be supported by source evidence.
- Do not hardcode language lists, paths, or schemas that already exist elsewhere; import them from their owner.
- Prefer deterministic output: sort collections and avoid ordering that depends on filesystem or hash order.
- Do not modify files outside the scope of the task. Report unrelated problems instead of fixing them.

## Data and Schemas
- Shared data structures are defined once. Find the existing definition and follow it.
- Changing a schema requires updating every producer, consumer, and test of it in the same change.
- Identifiers must be stable and deterministic: the same input must always produce the same ID.
- Validate references (for example, edges pointing to nodes) before returning results.

## Error Handling
- Handle empty input, missing files, unsupported languages, unresolved references, and duplicates without crashing.
- Skip or record what cannot be resolved; never fabricate a target to fill a gap.
- Never silently overwrite or drop data. Disambiguate or report it.

## Testing
- Do not use `assert` statements in tests. Use explicit checks that fail with descriptive messages stating what was expected and what was found.
- Every behavior change needs a new or updated test.
- Cover edge cases: empty, missing, duplicate, malformed, and unsupported inputs.
- Tests must not require network access. Prefer small in-test fixtures.
- Find the project's test command in the repo (config files, README, CI) rather than guessing.

## Workflow
1. Discover the current structure and inspect relevant code and tests.
2. Explain the proposed implementation briefly.
3. Implement only the requested task.
4. Add or update tests.
5. Run the relevant tests, and the full suite if shared code changed.
6. Update `ARCHITECTURE.md` and docs if structure or behavior changed.
7. Report changed files, test results, and unresolved issues.

## Keeping This File Healthy
- This file holds rules that stay true as the project evolves. Do not add module lists, file names, or phase-specific details here; those belong in `ARCHITECTURE.md` or the code.
- If a rule here conflicts with what the repo needs, flag it rather than silently ignoring it.

For any work on the graph visualization in frontend/, read frontend/SKILL.md first and follow it.