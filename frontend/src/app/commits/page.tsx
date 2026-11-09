"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { StatCard } from "@/components/StatCard";
import { StatRow } from "@/components/StatRow";
import {
  getRepositoryStatus,
  type GraphNode,
  type RepositoryGraph,
  type RepositoryStatus,
} from "@/lib/api";

export default function CommitsPage() {
  const [graph, setGraph] = useState<RepositoryGraph | null>(null);
  const [repoStatus, setRepoStatus] = useState<RepositoryStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterChangedOnly, setFilterChangedOnly] = useState(false);

  useEffect(() => {
    let active = true;
    const repoId = window.localStorage.getItem("epilyse-repository-id");

    const stored = window.localStorage.getItem("coderag-latest-graph");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed?.graph) {
          setGraph(parsed.graph);
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
        const res = await getRepositoryStatus(repoId);
        if (active) setRepoStatus(res);
      } catch {
        // network or server error handled gracefully
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadStatus();
    return () => {
      active = false;
    };
  }, []);

  const nodes: GraphNode[] = graph?.nodes ?? [];
  const nodesWithDiff = nodes.filter((n) => Boolean(n.previous_reference));
  const commitSha =
    graph?.commit_sha || repoStatus?.latest_commit_sha || "HEAD";
  const branch = graph?.branch || repoStatus?.selected_branch || "main";

  const filteredNodes = nodes.filter((node) => {
    if (filterChangedOnly && !node.previous_reference) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (node.name?.toLowerCase().includes(q) ?? false) ||
      node.path.toLowerCase().includes(q) ||
      (node.previous_reference?.toLowerCase().includes(q) ?? false)
    );
  });

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Top Header Bar */}
      <div className="h-12 border-b border-white/[0.08] px-6 flex items-center justify-between shrink-0 bg-surface/50">
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-mono uppercase tracking-wider text-muted-dark">
            Commits
          </span>
          <span className="text-white/[0.15]">/</span>
          <span className="text-xs font-medium text-ink truncate">
            {repoStatus ? `${repoStatus.owner}/${repoStatus.name}` : "Revision History"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {commitSha !== "HEAD" && (
            <span className="text-xs font-mono text-muted px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.08]">
              sha: {commitSha.slice(0, 8)}
            </span>
          )}
          <Link
            href="/graph"
            className="text-xs font-medium bg-accent hover:bg-accent-hover text-white px-2.5 py-1 rounded transition-colors inline-flex items-center gap-1"
          >
            <span>View Graph</span>
            <span className="text-[10px]">→</span>
          </Link>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-6 space-y-6 max-w-6xl w-full mx-auto">
        {!graph && !loading ? (
          <div className="bg-surface border border-white/[0.08] rounded p-12 text-center">
            <p className="text-sm font-medium text-ink">No Commit Data Available</p>
            <p className="mt-1 text-xs text-muted max-w-md mx-auto">
              Analyze a repository from the Overview page to examine commit revisions, source entity
              hashes, and tracking history.
            </p>
            <Link
              href="/"
              className="mt-4 inline-block bg-accent hover:bg-accent-hover text-white text-xs font-medium px-4 py-2 rounded transition-colors"
            >
              Go to Overview →
            </Link>
          </div>
        ) : (
          <>
            {/* Commit Header & Status */}
            <div className="bg-surface border border-white/[0.08] rounded p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                  Active Revision
                </h3>
                <span className="text-[11px] font-mono text-muted-dark">
                  status: {repoStatus?.ingestion_status ?? graph?.status ?? "completed"}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="divide-y divide-white/[0.06]">
                  <StatRow label="Commit SHA" value={commitSha} />
                  <StatRow label="Target Branch" value={branch} />
                  <StatRow
                    label="Repository URL"
                    value={
                      graph?.repository_url || repoStatus?.url ? (
                        <span className="truncate max-w-[220px] inline-block">
                          {graph?.repository_url || repoStatus?.url}
                        </span>
                      ) : (
                        "—"
                      )
                    }
                    mono={false}
                  />
                </div>
                <div className="divide-y divide-white/[0.06]">
                  <StatRow
                    label="Ingestion State"
                    value={repoStatus?.ingestion_status ?? "completed"}
                    badge={repoStatus?.ingestion_status ?? "ready"}
                  />
                  <StatRow
                    label="Last Updated"
                    value={
                      repoStatus?.updated_at
                        ? new Date(repoStatus.updated_at).toLocaleString()
                        : graph?.updated_at
                        ? new Date(graph.updated_at).toLocaleString()
                        : "Current session"
                    }
                    mono={false}
                  />
                  <StatRow
                    label="Tracked Entities"
                    value={`${nodes.length} nodes`}
                  />
                </div>
              </div>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard
                label="Commit SHA"
                value={commitSha.slice(0, 8)}
                detail="Checkout revision"
              />
              <StatCard
                label="Total Entities"
                value={nodes.length}
                detail="Files & parsed symbols"
              />
              <StatCard
                label="Ref Changes"
                value={nodesWithDiff.length}
                detail="Entities with prior reference"
              />
              <StatCard
                label="Unchanged"
                value={nodes.length - nodesWithDiff.length}
                detail="Matching baseline revision"
              />
            </div>

            {/* Changes / Entity List */}
            <div className="bg-surface border border-white/[0.08] rounded p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                    Revision Entity Hash Registry
                  </h3>
                  <p className="text-[11px] text-muted-dark mt-0.5">
                    Showing {filteredNodes.length} of {nodes.length} AST nodes
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filter by path or symbol…"
                    className="bg-bg border border-white/[0.08] rounded px-2.5 py-1 text-xs text-ink placeholder:text-muted-dark focus:outline-none focus:border-accent w-48"
                  />
                  <button
                    onClick={() => setFilterChangedOnly(!filterChangedOnly)}
                    className={`text-xs px-2.5 py-1 rounded border transition-colors cursor-pointer ${
                      filterChangedOnly
                        ? "bg-accent/20 border-accent/40 text-accent font-medium"
                        : "bg-bg border-white/[0.08] text-muted hover:text-ink"
                    }`}
                  >
                    {filterChangedOnly ? "Has Ref Only" : "All Entities"}
                  </button>
                </div>
              </div>

              {filteredNodes.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-dark">
                  No entities match your filter query.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-white/[0.08] text-muted-dark font-mono text-[10px] uppercase">
                        <th className="py-2 px-3">Type</th>
                        <th className="py-2 px-3">Symbol / Identifier</th>
                        <th className="py-2 px-3">File Path</th>
                        <th className="py-2 px-3">Code Hash</th>
                        <th className="py-2 px-3">Previous Ref</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                      {filteredNodes.slice(0, 100).map((node) => (
                        <tr
                          key={node.id}
                          className="hover:bg-white/[0.02] transition-colors font-mono"
                        >
                          <td className="py-2 px-3">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-mono ${
                                node.type === "file"
                                  ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                                  : node.kind === "class"
                                  ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                  : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              }`}
                            >
                              {node.kind || node.type}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-ink font-medium truncate max-w-[200px]">
                            {node.name || node.path.split("/").pop() || node.id}
                          </td>
                          <td className="py-2 px-3 text-muted truncate max-w-[280px]">
                            {node.path}
                          </td>
                          <td className="py-2 px-3 text-muted-dark text-[11px]">
                            {node.code_hash ? node.code_hash.slice(0, 8) : "—"}
                          </td>
                          <td className="py-2 px-3 text-muted-dark text-[11px]">
                            {node.previous_reference ? (
                              <span className="text-warning">
                                {node.previous_reference.slice(0, 8)}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredNodes.length > 100 && (
                    <p className="mt-3 text-[11px] text-muted-dark text-center font-mono">
                      Showing first 100 entities. Use search to narrow down results.
                    </p>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
