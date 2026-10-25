export type IngestionStatus = "pending" | "running" | "completed" | "failed";

export interface RegisterResponse {
  repository_id: string;
  owner: string;
  name: string;
  url: string;
  default_branch: string;
  selected_branch: string;
  current_commit_sha: string;
  latest_analyzed_sha: string | null;
  ingestion_status: IngestionStatus;
}

export interface CloneResponse {
  repository_id: string;
  repository_url: string;
  branch: string;
  commit_sha: string;
  clone_status: "success";
  file_count: number;
  sample_files: string[];
}

export interface GraphNode {
  id: string;
  type: "file" | "symbol";
  path: string;
  name: string | null;
  kind: "file" | "class" | "function" | "method" | null;
  line: number | null;
  end_line: number | null;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: "contains" | "import" | "calls";
}

export interface RepositoryGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const detail =
      typeof body === "object" && body !== null && "detail" in body
        ? String(body.detail)
        : `Request failed with status ${response.status}.`;
    throw new Error(detail);
  }
  return body as T;
}

export function registerRepository(url: string, revision: string): Promise<RegisterResponse> {
  const normalizedRevision = revision.trim();
  const isCommitSha = /^[a-f0-9]{32,64}$/i.test(normalizedRevision);
  return request<RegisterResponse>("/repositories/register", {
    method: "POST",
    body: JSON.stringify({
      url,
      branch: isCommitSha ? null : normalizedRevision || null,
      sha: isCommitSha ? normalizedRevision : null,
    }),
  });
}

export function cloneRepository(repositoryId: string, commitSha: string): Promise<CloneResponse> {
  return request<CloneResponse>(`/repositories/${repositoryId}/clone`, {
    method: "POST",
    body: JSON.stringify({ commit_sha: commitSha || null }),
  });
}

export function buildRepositoryGraph(
  repositoryId: string,
  commitSha: string,
): Promise<RepositoryGraph> {
  return request<RepositoryGraph>(`/repositories/${repositoryId}/graph`, {
    method: "POST",
    body: JSON.stringify({ commit_sha: commitSha || null }),
  });
}
