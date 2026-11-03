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

  useEffect(() => {
    let active = true;
    const repositoryId = window.localStorage.getItem("epilyse-repository-id");

    async function refresh() {
      if (!repositoryId) {
        const stored = window.localStorage.getItem("coderag-latest-graph");
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
        if (repositoryStatus.latest_commit_sha) {
          const latestGraph = await getLatestRepositoryGraph(repositoryId);
          if (!active) return;
          setGraph(latestGraph);
          setError(latestGraph.error ?? null);
        }
      } catch (requestError) {
        if (active) {
          setError(requestError instanceof Error ? requestError.message : "The graph could not be loaded.");
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
    status === "running" ? "Ingestion is running. This graph refreshes automatically." :
    status === "pending" ? "Waiting for ingestion to start." :
    status === "failed" ? "Ingestion failed. Retry after correcting the backend error." :
    graph && graph.nodes.length === 0 ? "Ingestion completed with an empty graph." :
    graph ? `Showing commit ${graph.commit_sha?.slice(0, 10) ?? "unknown"}.` :
    "Register a repository from the overview to view its graph.";

  return (
    <div className="min-h-screen" style={{ background: "#05060f" }}>
      {/* Minimal header bar */}
      <header
        className="flex items-center justify-between px-6 py-3"
        style={{
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(8,10,22,0.7)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div>
          <p
            className="text-[10px] font-bold uppercase tracking-[0.2em]"
            style={{ color: "rgba(108,140,255,0.6)" }}
          >
            Epilyse
          </p>
          <h1
            className="text-sm font-bold tracking-tight"
            style={{ color: "rgba(220,225,240,0.9)" }}
          >
            Dependency Graph
          </h1>
        </div>
        <Link
          href="/"
          className="text-xs font-semibold transition-colors"
          style={{ color: "rgba(108,140,255,0.7)" }}
        >
          ← Back to overview
        </Link>
      </header>

      {/* Graph fills the viewport */}
      <main className="p-3" style={{ height: "calc(100vh - 56px)" }}>
        <div className="flex h-full flex-col gap-3">
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-slate-300">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>{loading ? "Loading graph…" : statusText}</span>
              {status && <span className="rounded-full bg-white/10 px-2 py-1 font-semibold uppercase">{status}</span>}
            </div>
            {error && <p className="mt-2 text-red-300">{error}</p>}
          </div>
          <div className="min-h-0 flex-1">
            <GraphCanvas graph={graph} />
          </div>
        </div>
      </main>
    </div>
  );
}
