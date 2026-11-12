"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { StatCard } from "@/components/StatCard";
import { StatRow } from "@/components/StatRow";
import {
  getRepositoryStatus,
  type CloneResponse,
  type RegisterResponse,
  type RepositoryGraph,
  type RepositoryStatus,
} from "@/lib/api";
import { useLastRegisteredRepository } from "@/lib/useLastRegisteredRepository";

interface CachedAnalysis {
  registration: RegisterResponse;
  clone: CloneResponse;
  graph: RepositoryGraph;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isCachedAnalysis(value: unknown): value is CachedAnalysis {
  if (!isRecord(value)) return false;
  const { registration, clone, graph } = value;
  return (
    isRecord(registration) &&
    typeof registration.repository_id === "string" &&
    typeof registration.owner === "string" &&
    typeof registration.name === "string" &&
    isRecord(clone) &&
    typeof clone.branch === "string" &&
    typeof clone.commit_sha === "string" &&
    isRecord(graph) &&
    Array.isArray(graph.nodes) &&
    Array.isArray(graph.edges)
  );
}

function formatRegisteredAt(timestamp: string | null): string {
  if (!timestamp) return "—";
  const parsed = new Date(timestamp);
  return Number.isNaN(parsed.getTime()) ? timestamp : parsed.toLocaleString();
}

export default function RepositoriesPage() {
  const [cachedData, setCachedData] = useState<CachedAnalysis | null>(null);
  const [repoStatus, setRepoStatus] = useState<RepositoryStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const {
    repository: persistedRepository,
    loading: persistedLoading,
    error: persistenceError,
  } = useLastRegisteredRepository();

  useEffect(() => {
    const stored = window.localStorage.getItem("coderag-latest-graph");
    if (!stored) return;
    try {
      const parsed: unknown = JSON.parse(stored);
      if (isCachedAnalysis(parsed)) {
        setCachedData(parsed);
      }
    } catch {
      // Ignore malformed cached graph data.
    }
  }, []);

  const repositoryId =
    persistedRepository?.repository_id ?? cachedData?.registration.repository_id ?? null;

  useEffect(() => {
    let active = true;
    if (!repositoryId) {
      setStatusLoading(false);
      return () => {
        active = false;
      };
    }

    setStatusLoading(true);
    setRepoStatus(null);
    getRepositoryStatus(repositoryId)
      .then((status) => {
        if (active) setRepoStatus(status);
      })
      .catch(() => {
        if (active) setRepoStatus(null);
      })
      .finally(() => {
        if (active) setStatusLoading(false);
      });

    return () => {
      active = false;
    };
  }, [repositoryId]);

  const cachedOwnerName = cachedData
    ? `${cachedData.registration.owner}/${cachedData.registration.name}`
    : null;
  const ownerName = persistedRepository
    ? `${persistedRepository.owner}/${persistedRepository.name}`
    : cachedOwnerName ??
      (repoStatus ? `${repoStatus.owner}/${repoStatus.name}` : null);
  const repositoryUrl =
    persistedRepository?.url ?? cachedData?.registration.url ?? repoStatus?.url ?? null;
  const defaultBranch =
    repoStatus?.default_branch ?? cachedData?.registration.default_branch ?? null;
  const activeBranch =
    cachedData?.clone.branch ?? persistedRepository?.branch ?? repoStatus?.selected_branch ?? null;
  const commitSha =
    cachedData?.clone.commit_sha ??
    persistedRepository?.commit ??
    repoStatus?.latest_commit_sha ??
    null;
  const ingestionStatus =
    repoStatus?.ingestion_status ?? cachedData?.registration.ingestion_status ?? null;
  const registeredAt = persistedRepository?.timestamp ?? null;
  const registrationStore = persistedRepository
    ? "MongoDB"
    : cachedData
    ? "Browser cache"
    : null;
  const loading = persistedLoading || statusLoading;
  const hasRepository = Boolean(repositoryId && ownerName);

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Header */}
      <div className="h-12 border-b border-white/[0.08] px-6 flex items-center justify-between shrink-0 bg-surface/50">
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-mono uppercase tracking-wider text-muted-dark">
            Repositories
          </span>
          <span className="text-white/[0.15]">/</span>
          <span className="text-xs font-medium text-ink">
            {ownerName ?? "Workspace Repositories"}
          </span>
        </div>
        <div>
          <Link
            href="/"
            className="text-xs font-medium bg-accent hover:bg-accent-hover text-white px-2.5 py-1 rounded transition-colors inline-flex items-center gap-1"
          >
            <span>+ Analyze New Repo</span>
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6 space-y-6 max-w-6xl w-full mx-auto">
        {persistenceError && (
          <div className="text-[11px] font-mono text-muted-dark border border-white/[0.08] rounded px-3 py-2">
            MongoDB registration unavailable ({persistenceError}). Using browser cache when present.
          </div>
        )}

        {loading && !hasRepository ? (
          <div className="bg-surface border border-white/[0.08] rounded p-12 text-center">
            <p className="text-sm font-medium text-ink">Loading Registered Repository</p>
            <p className="mt-1 text-xs text-muted max-w-md mx-auto">
              Checking your account&apos;s MongoDB registration and local workspace cache.
            </p>
          </div>
        ) : !hasRepository ? (
          <div className="bg-surface border border-white/[0.08] rounded p-12 text-center">
            <p className="text-sm font-medium text-ink">No Repositories Registered</p>
            <p className="mt-1 text-xs text-muted max-w-md mx-auto">
              You haven&apos;t connected any GitHub repositories yet. Connect a public repository to
              generate its code knowledge graph.
            </p>
            <Link
              href="/"
              className="mt-4 inline-block bg-accent hover:bg-accent-hover text-white text-xs font-medium px-4 py-2 rounded transition-colors"
            >
              Analyze a Repository →
            </Link>
          </div>
        ) : (
          <>
            {/* Active Repository Card */}
            <div className="bg-surface border border-white/[0.08] rounded p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-success" />
                    <h3 className="text-sm font-semibold text-ink">{ownerName}</h3>
                  </div>
                  <p className="text-xs font-mono text-muted-dark mt-0.5">{repositoryUrl ?? "—"}</p>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    href="/graph"
                    className="text-xs bg-white/[0.06] hover:bg-white/[0.1] text-ink border border-white/[0.1] px-3 py-1.5 rounded transition-colors"
                  >
                    Open Graph
                  </Link>
                  <Link
                    href="/commits"
                    className="text-xs bg-white/[0.06] hover:bg-white/[0.1] text-ink border border-white/[0.1] px-3 py-1.5 rounded transition-colors"
                  >
                    Commits
                  </Link>
                  <Link
                    href="/quality"
                    className="text-xs bg-white/[0.06] hover:bg-white/[0.1] text-ink border border-white/[0.1] px-3 py-1.5 rounded transition-colors"
                  >
                    Quality
                  </Link>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="divide-y divide-white/[0.06]">
                  <StatRow label="Repository ID" value={repositoryId ?? "—"} />
                  <StatRow
                    label="Default Branch"
                    value={defaultBranch ?? "—"}
                    badge={defaultBranch ? "default" : undefined}
                  />
                  <StatRow label="Active Revision Branch" value={activeBranch ?? "—"} />
                  <StatRow
                    label="Registration Store"
                    value={registrationStore ?? "—"}
                    badge={persistedRepository ? "synced" : undefined}
                    mono={false}
                  />
                </div>
                <div className="divide-y divide-white/[0.06]">
                  <StatRow
                    label="Commit SHA"
                    value={commitSha ? commitSha.slice(0, 10) : "—"}
                  />
                  <StatRow
                    label="Ingestion State"
                    value={ingestionStatus ?? (persistedRepository ? "registered" : "—")}
                    badge={ingestionStatus ?? (persistedRepository ? "mongo" : undefined)}
                  />
                  <StatRow
                    label="Registered At"
                    value={formatRegisteredAt(registeredAt)}
                    mono={false}
                  />
                  <StatRow
                    label="Total AST Nodes"
                    value={cachedData?.graph ? `${cachedData.graph.nodes.length} entities` : "—"}
                  />
                </div>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard
                label="Files"
                value={cachedData?.clone.file_count ?? null}
                detail="Checked-out source files"
              />
              <StatCard
                label="Graph Nodes"
                value={cachedData?.graph.nodes.length ?? null}
                detail="AST entities"
              />
              <StatCard
                label="Graph Edges"
                value={cachedData?.graph.edges.length ?? null}
                detail="Dependencies & calls"
              />
              <StatCard
                label="Symbols"
                value={
                  cachedData?.graph
                    ? cachedData.graph.nodes.filter((n) => n.type === "symbol").length
                    : null
                }
                detail="Classes and functions"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
