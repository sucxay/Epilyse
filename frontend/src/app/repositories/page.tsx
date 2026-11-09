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

export default function RepositoriesPage() {
  const [cachedData, setCachedData] = useState<{
    registration: RegisterResponse;
    clone: CloneResponse;
    graph: RepositoryGraph;
  } | null>(null);
  const [repoStatus, setRepoStatus] = useState<RepositoryStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const repoId = window.localStorage.getItem("epilyse-repository-id");
    const stored = window.localStorage.getItem("coderag-latest-graph");

    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed?.registration) {
          setCachedData(parsed);
        }
      } catch {
        // ignore
      }
    }

    async function loadStatus() {
      if (!repoId) {
        if (active) setLoading(false);
        return;
      }
      try {
        const status = await getRepositoryStatus(repoId);
        if (active) setRepoStatus(status);
      } catch {
        // ignore network error
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadStatus();
    return () => {
      active = false;
    };
  }, []);

  const repo = cachedData?.registration || repoStatus;

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
            {repo ? `${repo.owner}/${repo.name}` : "Workspace Repositories"}
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
        {!repo && !loading ? (
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
                    <h3 className="text-sm font-semibold text-ink">
                      {repo?.owner}/{repo?.name}
                    </h3>
                  </div>
                  <p className="text-xs font-mono text-muted-dark mt-0.5">
                    {repo?.url}
                  </p>
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
                  <StatRow
                    label="Repository ID"
                    value={
                      repoStatus?.id ||
                      (repo && "repository_id" in repo ? repo.repository_id : repo?.id) ||
                      "—"
                    }
                  />
                  <StatRow
                    label="Default Branch"
                    value={repo?.default_branch || "main"}
                    badge="default"
                  />
                  <StatRow
                    label="Active Revision Branch"
                    value={cachedData?.clone.branch || repo?.selected_branch || "main"}
                  />
                </div>
                <div className="divide-y divide-white/[0.06]">
                  <StatRow
                    label="Commit SHA"
                    value={
                      cachedData?.clone.commit_sha
                        ? cachedData.clone.commit_sha.slice(0, 10)
                        : repoStatus?.latest_commit_sha
                        ? repoStatus.latest_commit_sha.slice(0, 10)
                        : "—"
                    }
                  />
                  <StatRow
                    label="Ingestion State"
                    value={repoStatus?.ingestion_status ?? repo?.ingestion_status ?? "completed"}
                    badge={repoStatus?.ingestion_status ?? "active"}
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
