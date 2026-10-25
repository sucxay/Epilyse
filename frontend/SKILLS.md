---
name: frontend-development
description: Build and maintain the Epilyse frontend using Next.js, TypeScript, Tailwind CSS, and React Flow. Use when implementing UI pages, repository analysis workflows, API integration, or dependency graph visualization.
---

# Epilyse Frontend Development

## Project Context

Epilyse analyzes Git repositories, extracts code structure, builds dependency graphs, and will support code retrieval.

The frontend must provide an interface for users to submit repositories, monitor analysis, explore dependency graphs, and eventually query code.

The backend is Python and FastAPI. The frontend must remain separate from the backend.

## Technology Stack

- Next.js with App Router
- TypeScript with strict type checking
- Tailwind CSS
- React Flow (`@xyflow/react`) for dependency graph visualization
- FastAPI for backend communication

Use the versions and dependencies already present in `package.json`. Do not upgrade packages without a reason.

## Design Principles

- Build a polished developer-focused dashboard.
- Prefer a clean, minimal interface with clear visual hierarchy.
- Use reusable components and consistent spacing.
- Support responsive layouts and keyboard accessibility.
- Provide clear loading, empty, success, and error states.
- Avoid unnecessary animations, excessive gradients, and decorative UI.
- Never use fake statistics or mock results as if they came from the backend.

## Architecture Rules

- Keep pages inside `src/app/`.
- Keep reusable UI components inside `src/components/`.
- Keep API clients and shared utilities inside `src/lib/`.
- Define TypeScript types for API requests and responses.
- Keep network requests out of presentation-only components where practical.
- Use environment variables for backend configuration.
- Never expose secrets or private API keys in client-side code.

## Backend Integration

- Inspect the existing FastAPI routes and schemas before implementing API calls.
- Reuse existing endpoints instead of inventing new ones.
- If a required endpoint does not exist, document the missing endpoint and its expected contract.
- Handle network failures and non-success HTTP responses.
- Show repository analysis progress when the backend supports it.
- Do not assume an analysis succeeded until the backend confirms it.

## Dependency Graph

- Use React Flow to render the graph returned by the backend.
- Map backend nodes and edges into the visualization's expected format.
- Preserve node IDs and edge relationships.
- Support zooming, panning, and selecting nodes.
- Display useful node details when a node is selected.
- Show a meaningful empty state when no graph is available.
- Do not invent graph relationships in the frontend.

## Code Quality

- Avoid `any` unless there is a documented reason.
- Keep components small and focused.
- Extract repeated UI into reusable components.
- Avoid duplicate API logic.
- Reuse the project's existing design system and conventions.
- Add or update tests for important behavior.
- Run available lint, type-check, and test commands after changes.

## Workflow

1. Inspect the existing frontend and backend before editing.
2. Identify relevant components, routes, types, and dependencies.
3. Implement the smallest coherent change.
4. Verify loading, empty, success, and error states where applicable.
5. Run available checks and report any failures.
6. Summarize changed files and any backend requirements.

Do not rewrite unrelated files or replace working architecture without justification.