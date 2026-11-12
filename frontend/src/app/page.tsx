"use client";

import Link from "next/link";
import { useState } from "react";
import { AnalysisPanel } from "@/components/AnalysisPanel";
import { StatCard } from "@/components/StatCard";
import { StatRow } from "@/components/StatRow";
import type { CloneResponse, RegisterResponse, RepositoryGraph } from "@/lib/api";
import { useLastRegisteredRepository } from "@/lib/useLastRegisteredRepository";

function formatTimestamp(timestamp: string): string {
  const parsed = new Date(timestamp);
  return Number.isNaN(parsed.getTime()) ? timestamp : parsed.toLocaleString();
}

export default function OverviewPage() {
  const [result, setResult] = useState<{
    registration: RegisterResponse;
    clone: CloneResponse;
    graph: RepositoryGraph;
  } | null>(null);
  const { repository: persistedRepository } = useLastRegisteredRepository();

  function handleComplete(
    registration: RegisterResponse,
    clone: CloneResponse,
    graph: RepositoryGraph
  ) {
    const nextResult = { registration, clone, graph };
    setResult(nextResult);
    window.localStorage.setItem("coderag-latest-graph", JSON.stringify(nextResult));
    window.localStorage.setItem("epilyse-repository-id", registration.repository_id);
  }

  const nodes = result?.graph.nodes ?? [];
  const edges = result?.graph.edges ?? [];
  const symbolCount = nodes.filter((n) => n.type === "symbol").length;
  const fileCount = result?.clone.file_count ?? nodes.filter((n) => n.type === "file").length;
  const functionCount = nodes.filter((n) => n.kind === "function" || n.kind === "method").length;
  const classCount = nodes.filter((n) => n.kind === "class").length;
  const persistedName = persistedRepository
    ? `${persistedRepository.owner}/${persistedRepository.name}`
    : null;
  const activeRepositoryName = result
    ? `${result.registration.owner}/${result.registration.name}`
    : persistedName;
  const checkoutBranch = result?.clone.branch ?? persistedRepository?.branch ?? null;
  const checkoutCommitSha = result?.clone.commit_sha ?? persistedRepository?.commit ?? null;

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Page Header */}
      <div className="h-12 border-b border-white/[0.08] px-6 flex items-center justify-between shrink-0 bg-surface/50">
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-mono uppercase tracking-wider text-muted-dark">
            Overview
          </span>
          <span className="text-white/[0.15]">/</span>
          <span className="text-xs font-medium text-ink truncate">
            {activeRepositoryName ?? "No repository selected"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {result ? (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-success/10 border border-success/20 text-[11px] font-mono text-success">
              <span className="w-1.5 h-1.5 rounded-full bg-success" />
              <span>Ready</span>
            </div>
          ) : persistedRepository ? (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-accent/10 border border-accent/20 text-[11px] font-mono text-accent">
              <span className="w-1.5 h-1.5 rounded-full bg-accent" />
              <span>Registered</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.08] text-[11px] font-mono text-muted">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-dark" />
              <span>Awaiting input</span>
            </div>
          )}
          {result && (
            <Link
              href="/graph"
              className="text-xs font-medium bg-accent hover:bg-accent-hover text-white px-2.5 py-1 rounded transition-colors inline-flex items-center gap-1"
            >
              <span>Explore Graph</span>
              <span className="text-[10px]">→</span>
            </Link>
          )}
        </div>
      </div>

      {/* Main Container */}
      <div className="p-6 space-y-6 max-w-6xl w-full mx-auto">
        {/* Registration Panel */}
        <AnalysisPanel onComplete={handleComplete} />

        {/* Server-persisted registration when no local analysis exists */}
        {!result && persistedRepository && (
          <div className="bg-surface border border-white/[0.08] rounded p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-success" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Registered Repository
                </h3>
              </div>
              <p className="mt-1 text-sm font-medium text-ink truncate">{persistedName}</p>
              <p className="mt-0.5 text-xs font-mono text-muted-dark truncate">
                {persistedRepository.url}
              </p>
              <p className="mt-2 text-[11px] text-muted">
                Persisted for your account in MongoDB · branch{" "}
                <span className="font-mono text-ink">{persistedRepository.branch}</span> · commit{" "}
                <span className="font-mono text-ink">
                  {persistedRepository.commit ? persistedRepository.commit.slice(0, 10) : "—"}
                </span>
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Link
                href="/repositories"
                className="bg-white/[0.06] hover:bg-white/[0.1] text-ink border border-white/[0.1] text-xs font-medium px-4 py-2 rounded transition-colors"
              >
                Repositories
              </Link>
              <Link
                href="/graph"
                className="bg-accent hover:bg-accent-hover text-white text-xs font-medium px-4 py-2 rounded transition-colors inline-flex items-center gap-1.5"
              >
                <span>Open Graph</span>
                <span className="text-[11px]">→</span>
              </Link>
            </div>
          </div>
        )}

        {/* Prominent Code Graph Banner if data available */}
        {result && (
          <div className="bg-surface border border-accent/30 rounded p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-accent">
                  Interactive Graph Ready
                </h3>
              </div>
              <p className="mt-1 text-xs text-muted">
                Visualizing <span className="text-ink font-mono">{nodes.length}</span> nodes and{" "}
                <span className="text-ink font-mono">{edges.length}</span> dependencies for revision{" "}
                <span className="text-ink font-mono">
                  {result.clone.commit_sha.slice(0, 8)}
                </span>{" "}
                on branch <span className="text-ink font-mono">{result.clone.branch}</span>.
              </p>
            </div>
            <Link
              href="/graph"
              className="shrink-0 bg-accent hover:bg-accent-hover text-white text-xs font-medium px-4 py-2 rounded transition-colors inline-flex items-center gap-1.5"
            >
              <span>Open Code Graph</span>
              <span className="text-[11px]">→</span>
            </Link>
          </div>
        )}

        {/* Compact Stats Grid */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              Repository Metrics
            </h3>
            {result?.clone.branch && (
              <span className="text-[11px] font-mono text-muted-dark">
                rev: {result.clone.commit_sha.slice(0, 7)}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              label="Files"
              value={result ? fileCount : null}
              detail={result ? "Source files parsed" : "Awaiting analysis"}
            />
            <StatCard
              label="Definitions"
              value={result ? symbolCount : null}
              detail={result ? "Classes & functions" : "Awaiting analysis"}
            />
            <StatCard
              label="Graph Nodes"
              value={result ? nodes.length : null}
              detail={result ? "AST entities" : "Awaiting analysis"}
            />
            <StatCard
              label="Graph Edges"
              value={result ? edges.length : null}
              detail={result ? "Calls & import references" : "Awaiting analysis"}
            />
          </div>
        </div>

        {/* Detailed Breakdown & Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Analysis Breakdown */}
          <div className="bg-surface border border-white/[0.08] rounded p-4">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-2">
              Entity Distribution
            </h4>
            <div className="divide-y divide-white/[0.06]">
              <StatRow
                label="Source Files"
                value={result ? fileCount : "—"}
                detail={result ? "Python modules in checkout" : "Available after analysis"}
              />
              <StatRow
                label="Class Definitions"
                value={result ? classCount : "—"}
                detail={result ? "Parsed class declarations" : "Available after analysis"}
              />
              <StatRow
                label="Functions & Methods"
                value={result ? functionCount : "—"}
                detail={result ? "Call targets & routines" : "Available after analysis"}
              />
              <StatRow
                label="Dependency Edges"
                value={result ? edges.length : "—"}
                detail={result ? "Import links and call relations" : "Available after analysis"}
              />
            </div>
          </div>

          {/* Checkout Details */}
          <div className="bg-surface border border-white/[0.08] rounded p-4">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-2">
              Checkout Reference
            </h4>
            <div className="divide-y divide-white/[0.06]">
              <StatRow
                label="Repository"
                value={
                  activeRepositoryName ? (
                    <span className="truncate max-w-[200px] inline-block">{activeRepositoryName}</span>
                  ) : (
                    "—"
                  )
                }
                mono={false}
              />
              <StatRow
                label="Branch"
                value={checkoutBranch ?? "—"}
                badge={checkoutBranch ? "git" : undefined}
              />
              <StatRow
                label="Commit SHA"
                value={checkoutCommitSha ? checkoutCommitSha.slice(0, 10) : "—"}
              />
              {!result && persistedRepository && (
                <StatRow
                  label="Registered At"
                  value={formatTimestamp(persistedRepository.timestamp)}
                  mono={false}
                />
              )}
              <StatRow
                label="Parser Status"
                value={result ? "Ready" : "Idle"}
                badge={result ? "AST" : undefined}
                mono={false}
              />
            </div>
          </div>
        </div>

        {/* Minimal inline note */}
        <div className="pt-2 border-t border-white/[0.06]">
          <p className="text-[11px] text-muted-dark leading-relaxed">
            Source-backed analysis: Definitions and relationships are extracted from Python AST
            using the Epilyse backend parser and graph builder. Language support is expanding.
          </p>
        </div>
      </div>
    </div>
  );
}
