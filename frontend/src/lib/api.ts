import { getCurrentAccessToken } from "@/lib/supabase";

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
  source_code: string;
  start_line: number | null;
  functions: string[];
  classes: string[];
  code_hash: string;
  previous_reference: string | null;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: "contains" | "import" | "calls";
}

export interface RepositoryGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  repository_url?: string;
  branch?: string;
  commit_sha?: string | null;
  status?: IngestionStatus;
  updated_at?: string;
  error?: string | null;
}

export interface RepositoryStatus {
  id: string;
  owner: string;
  name: string;
  url: string;
  default_branch: string;
  selected_branch: string;
  latest_commit_sha: string | null;
  ingestion_status: IngestionStatus;
  updated_at: string;
  last_error: string | null;
}

const configuredApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
const apiBaseUrl =
  configuredApiBaseUrl ||
  (process.env.NODE_ENV === "development" ? "http://localhost:8000" : null);
const REQUEST_TIMEOUT_MS = 20_000;

async function request<T>(path: string, init: RequestInit): Promise<T> {
  if (!apiBaseUrl) {
    throw new Error(
      "The frontend API URL is not configured. Set NEXT_PUBLIC_API_BASE_URL and redeploy the frontend.",
    );
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const fetchWithToken = (accessToken: string) => {
      const headers = new Headers(init.headers);
      headers.set("Content-Type", "application/json");
      headers.set("Authorization", `Bearer ${accessToken}`);
      return fetch(`${apiBaseUrl}${path}`, {
        ...init,
        cache: "no-store",
        signal: controller.signal,
        headers,
      });
    };

    let response = await fetchWithToken(await getCurrentAccessToken());
    if (response.status === 401) {
      response = await fetchWithToken(await getCurrentAccessToken(true));
    }
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const detail =
        typeof body === "object" && body !== null && "detail" in body
          ? String(body.detail)
          : `Request failed with status ${response.status}.`;
      throw new Error(detail);
    }
    return body as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("The backend request timed out. Check the API URL and backend logs.");
    }
    if (error instanceof TypeError) {
      throw new Error(
        "The backend could not be reached. Check NEXT_PUBLIC_API_BASE_URL and CORS configuration.",
      );
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
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
  const normalizedCommitSha = commitSha.trim();
  if (!normalizedCommitSha) {
    return Promise.reject(new Error("The backend did not return a commit SHA for this repository."));
  }
  return request<CloneResponse>(`/repositories/${repositoryId}/clone`, {
    method: "POST",
    body: JSON.stringify({ commit_sha: normalizedCommitSha }),
  });
}

export function buildRepositoryGraph(
  repositoryId: string,
  commitSha: string,
): Promise<RepositoryGraph> {
  const normalizedCommitSha = commitSha.trim();
  if (!normalizedCommitSha) {
    return Promise.reject(new Error("A resolved commit SHA is required before building the graph."));
  }
  return request<RepositoryGraph>(`/repositories/${repositoryId}/graph`, {
    method: "POST",
    body: JSON.stringify({ commit_sha: normalizedCommitSha }),
  });
}

export function getRepositoryStatus(repositoryId: string): Promise<RepositoryStatus> {
  return request<RepositoryStatus>(`/repositories/${repositoryId}`, {
    method: "GET",
  });
}

export function getLatestRepositoryGraph(repositoryId: string): Promise<RepositoryGraph> {
  return request<RepositoryGraph>(`/repositories/${repositoryId}/graph/latest`, {
    method: "GET",
  });
}
