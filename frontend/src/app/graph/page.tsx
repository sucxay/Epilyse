"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { GraphCanvas } from "@/components/GraphCanvas";
import {
  getLatestRepositoryGraph,
  getRepositoryStatus,
  type IngestionStatus,
  type RepositoryGraph,
} from "@/lib/api";

export default function GraphPage() {
  const [graph, setGraph] = useState<RepositoryGraph | null>(null);
  const [status, setStatus] = useState<IngestionStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [repoName, setRepoName] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const repositoryId = window.localStorage.getItem("epilyse-repository-id");

    // Also get cached repo name from localStorage
    const stored = window.localStorage.getItem("coderag-latest-graph");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed?.registration?.owner && parsed?.registration?.name) {
          setRepoName(`${parsed.registration.owner}/${parsed.registration.name}`);
        }
      } catch {
        // ignore
      }
    }

    async function refresh() {
      if (!repositoryId) {
        if (stored) {
          try {
            const parsed: unknown = JSON.parse(stored);
            if (typeof parsed === "object" && parsed !== null && "graph" in parsed) {
              setGraph(parsed.graph as RepositoryGraph);
            }
          } catch {
            window.localStorage.removeItem("coderag-latest-graph");
          }
        }
        if (active) setLoading(false);
        return;
      }

      try {
        const repositoryStatus = await getRepositoryStatus(repositoryId);
        if (!active) return;
        setStatus(repositoryStatus.ingestion_status);
        setError(repositoryStatus.last_error);
        if (repositoryStatus.owner && repositoryStatus.name) {
          setRepoName(`${repositoryStatus.owner}/${repositoryStatus.name}`);
        }
        if (repositoryStatus.latest_commit_sha) {
          const latestGraph = await getLatestRepositoryGraph(repositoryId);
          if (!active) return;
          setGraph(latestGraph);
          setError(latestGraph.error ?? null);
        }
      } catch (requestError) {
        if (active) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "The graph could not be loaded."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void refresh();
    const interval = window.setInterval(() => void refresh(), 5000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  const statusText =
    status === "running"
      ? "Ingestion running…"
      : status === "pending"
      ? "Ingestion pending…"
      : status === "failed"
      ? "Ingestion failed"
      : graph && graph.nodes.length === 0
      ? "Empty graph"
      : graph
      ? `Revision: ${graph.commit_sha?.slice(0, 8) ?? "HEAD"}`
      : "No graph loaded";

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-bg">
      {/* Top Bar - 48px */}
      <header className="h-12 px-4 border-b border-white/[0.08] bg-surface/50 flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-mono uppercase tracking-wider text-muted-dark">
            Graph
          </span>
          <span className="text-white/[0.15]">/</span>
          <span className="text-xs font-medium text-ink truncate">
            {repoName ?? "Interactive Code Graph"}
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs">
          {loading && <span className="text-muted font-mono text-[11px]">Loading…</span>}

          {status && (
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase border ${
                status === "completed"
                  ? "bg-success/10 border-success/20 text-success"
                  : status === "running"
                  ? "bg-accent/10 border-accent/20 text-accent animate-pulse"
                  : status === "failed"
                  ? "bg-danger/10 border-danger/20 text-danger"
                  : "bg-white/[0.04] border-white/[0.08] text-muted"
              }`}
            >
              {status}
            </span>
          )}

          {graph && (
            <div className="hidden sm:flex items-center gap-2 text-[11px] font-mono text-muted">
              <span>{graph.nodes.length} nodes</span>
              <span className="text-white/[0.1]">|</span>
              <span>{graph.edges.length} edges</span>
            </div>
          )}

          <div className="hidden md:block text-[11px] font-mono text-muted-dark">
            {statusText}
          </div>

          <Link
            href="/"
            className="text-[11px] text-muted hover:text-ink transition-colors px-2 py-1 rounded hover:bg-white/[0.04]"
          >
            ← Overview
          </Link>
        </div>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="px-4 py-2 bg-danger/10 border-b border-danger/20 text-danger text-xs font-mono flex items-center justify-between">
          <span>Error: {error}</span>
        </div>
      )}

      {/* Main Canvas Area */}
      <main className="flex-1 min-h-0 relative">
        <GraphCanvas graph={graph} />
      </main>
    </div>
  );
}
