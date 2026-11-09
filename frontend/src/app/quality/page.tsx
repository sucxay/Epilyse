"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { StatCard } from "@/components/StatCard";
import { StatRow } from "@/components/StatRow";
import type { GraphNode, RepositoryGraph } from "@/lib/api";

interface SymbolMetric {
  id: string;
  name: string;
  kind: string;
  path: string;
  linesOfCode: number;
  isStable: boolean;
  codeHash: string;
}

export default function QualityPage() {
  const [graph, setGraph] = useState<RepositoryGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterKind, setFilterKind] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
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
    setLoading(false);
  }, []);

  const nodes: GraphNode[] = useMemo(() => graph?.nodes ?? [], [graph]);
  const edges = useMemo(() => graph?.edges ?? [], [graph]);

  // Categorize kinds
  const kindBreakdown = useMemo(() => {
    const counts: Record<string, { total: number; changed: number; totalLines: number }> = {
      file: { total: 0, changed: 0, totalLines: 0 },
      class: { total: 0, changed: 0, totalLines: 0 },
      function: { total: 0, changed: 0, totalLines: 0 },
      method: { total: 0, changed: 0, totalLines: 0 },
    };

    for (const node of nodes) {
      const k = node.kind || (node.type === "file" ? "file" : "symbol");
      if (!counts[k]) {
        counts[k] = { total: 0, changed: 0, totalLines: 0 };
      }
      counts[k].total += 1;
      if (node.previous_reference) {
        counts[k].changed += 1;
      }
      const loc =
        node.end_line && (node.start_line || node.line)
          ? Math.max(1, node.end_line - (node.start_line ?? node.line ?? 0) + 1)
          : node.source_code
          ? node.source_code.split("\n").length
          : 0;
      counts[k].totalLines += loc;
    }
    return counts;
  }, [nodes]);

  // Extract symbol metrics (functions, methods, classes)
  const symbolMetrics = useMemo<SymbolMetric[]>(() => {
    return nodes
      .filter((n) => n.type === "symbol" || n.kind !== "file")
      .map((node) => {
        const loc =
          node.end_line && (node.start_line || node.line)
            ? Math.max(1, node.end_line - (node.start_line ?? node.line ?? 0) + 1)
            : node.source_code
            ? node.source_code.split("\n").length
            : 1;
        return {
          id: node.id,
          name: node.name || node.id,
          kind: node.kind || "symbol",
          path: node.path,
          linesOfCode: loc,
          isStable: !node.previous_reference,
          codeHash: node.code_hash,
        };
      })
      .sort((a, b) => b.linesOfCode - a.linesOfCode);
  }, [nodes]);

  const totalSymbols = symbolMetrics.length;
  const changedSymbols = symbolMetrics.filter((s) => !s.isStable).length;
  const stablePercentage = totalSymbols > 0
    ? (((totalSymbols - changedSymbols) / totalSymbols) * 100).toFixed(1)
    : "100";

  const largeSymbols = symbolMetrics.filter((s) => s.linesOfCode >= 50);
  const avgLoc = totalSymbols > 0
    ? (symbolMetrics.reduce((sum, s) => sum + s.linesOfCode, 0) / totalSymbols).toFixed(1)
    : "0";

  const filteredSymbols = symbolMetrics.filter((s) => {
    if (filterKind !== "all" && s.kind !== filterKind) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return s.name.toLowerCase().includes(q) || s.path.toLowerCase().includes(q);
  });

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Header */}
      <div className="h-12 border-b border-white/[0.08] px-6 flex items-center justify-between shrink-0 bg-surface/50">
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-mono uppercase tracking-wider text-muted-dark">
            Quality
          </span>
          <span className="text-white/[0.15]">/</span>
          <span className="text-xs font-medium text-ink truncate">
            Structural Code Quality & Stability
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/graph"
            className="text-xs font-medium bg-accent hover:bg-accent-hover text-white px-2.5 py-1 rounded transition-colors inline-flex items-center gap-1"
          >
            <span>Explore in Graph</span>
            <span className="text-[10px]">→</span>
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6 space-y-6 max-w-6xl w-full mx-auto">
        {!graph && !loading ? (
          <div className="bg-surface border border-white/[0.08] rounded p-12 text-center">
            <p className="text-sm font-medium text-ink">No Codebase Analyzed</p>
            <p className="mt-1 text-xs text-muted max-w-md mx-auto">
              Analyze a repository from the Overview page to assess entity distributions, routine
              complexity, and AST stability metrics.
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
            {/* Top Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard
                label="Stability Index"
                value={`${stablePercentage}%`}
                detail="Entities without prior delta"
                trend={parseFloat(stablePercentage) > 80 ? "Healthy" : "Active Delta"}
              />
              <StatCard
                label="Avg Routine LOC"
                value={avgLoc}
                detail="Lines per parsed symbol"
              />
              <StatCard
                label="Large Symbols"
                value={largeSymbols.length}
                detail="Entities >= 50 lines of code"
              />
              <StatCard
                label="Coupling Ratio"
                value={nodes.length > 0 ? (edges.length / nodes.length).toFixed(2) : "0"}
                detail="Edges per AST node"
              />
            </div>

            {/* Quality Summary & Entity Kind Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Kind Distribution */}
              <div className="bg-surface border border-white/[0.08] rounded p-4">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-3">
                  Entity Breakdown & Stability
                </h3>
                <div className="divide-y divide-white/[0.06]">
                  {Object.entries(kindBreakdown).map(([kind, data]) => {
                    const avg = data.total > 0 ? (data.totalLines / data.total).toFixed(1) : "0";
                    const stability =
                      data.total > 0
                        ? (((data.total - data.changed) / data.total) * 100).toFixed(0)
                        : "100";
                    return (
                      <StatRow
                        key={kind}
                        label={`${kind.charAt(0).toUpperCase() + kind.slice(1)} Entities`}
                        value={`${data.total} units (${stability}% stable)`}
                        detail={`Avg size: ~${avg} LOC`}
                        badge={kind}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Quality Observations */}
              <div className="bg-surface border border-white/[0.08] rounded p-4">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-3">
                  Quality Observations
                </h3>
                <div className="space-y-3 text-xs text-muted leading-relaxed">
                  <div className="p-2.5 rounded bg-white/[0.02] border border-white/[0.04]">
                    <span className="text-ink font-medium block mb-1">
                      Coupling & Relationship Density
                    </span>
                    Graph has {edges.length} total relations across {nodes.length} nodes. Call and
                    import edges reveal module cohesion and surface dependency bottlenecks.
                  </div>
                  <div className="p-2.5 rounded bg-white/[0.02] border border-white/[0.04]">
                    <span className="text-ink font-medium block mb-1">
                      Function Sizing & Maintainability
                    </span>
                    {largeSymbols.length} out of {totalSymbols} routines exceed 50 lines of code.
                    Refactoring high LOC functions into focused subroutines improves graph clarity
                    and unit test coverage.
                  </div>
                </div>
              </div>
            </div>

            {/* Symbol Complexity Table */}
            <div className="bg-surface border border-white/[0.08] rounded p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                    Symbol Size & Complexity Registry
                  </h3>
                  <p className="text-[11px] text-muted-dark mt-0.5">
                    Showing {filteredSymbols.length} routines sorted by lines of code
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search routine or file…"
                    className="bg-bg border border-white/[0.08] rounded px-2.5 py-1 text-xs text-ink placeholder:text-muted-dark focus:outline-none focus:border-accent w-48"
                  />
                  <select
                    value={filterKind}
                    onChange={(e) => setFilterKind(e.target.value)}
                    className="bg-bg border border-white/[0.08] rounded px-2.5 py-1 text-xs text-muted focus:text-ink focus:outline-none focus:border-accent cursor-pointer"
                  >
                    <option value="all">All Kinds</option>
                    <option value="function">Function</option>
                    <option value="method">Method</option>
                    <option value="class">Class</option>
                  </select>
                </div>
              </div>

              {filteredSymbols.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-dark">
                  No symbols found matching your criteria.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse font-mono">
                    <thead>
                      <tr className="border-b border-white/[0.08] text-muted-dark text-[10px] uppercase">
                        <th className="py-2 px-3">Symbol</th>
                        <th className="py-2 px-3">Kind</th>
                        <th className="py-2 px-3">Path</th>
                        <th className="py-2 px-3 text-right">LOC</th>
                        <th className="py-2 px-3">Status</th>
                        <th className="py-2 px-3">Hash</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                      {filteredSymbols.slice(0, 100).map((symbol) => (
                        <tr
                          key={symbol.id}
                          className="hover:bg-white/[0.02] transition-colors"
                        >
                          <td className="py-2 px-3 text-ink font-medium truncate max-w-[200px]">
                            {symbol.name}
                          </td>
                          <td className="py-2 px-3">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] uppercase ${
                                symbol.kind === "class"
                                  ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                  : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                              }`}
                            >
                              {symbol.kind}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-muted truncate max-w-[260px]">
                            {symbol.path}
                          </td>
                          <td className="py-2 px-3 text-right">
                            <span
                              className={
                                symbol.linesOfCode >= 50
                                  ? "text-warning font-semibold"
                                  : "text-muted"
                              }
                            >
                              {symbol.linesOfCode}
                            </span>
                          </td>
                          <td className="py-2 px-3">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] ${
                                symbol.isStable
                                  ? "bg-success/10 text-success border border-success/20"
                                  : "bg-warning/10 text-warning border border-warning/20"
                              }`}
                            >
                              {symbol.isStable ? "Stable" : "Modified"}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-muted-dark text-[11px]">
                            {symbol.codeHash ? symbol.codeHash.slice(0, 8) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredSymbols.length > 100 && (
                    <p className="mt-3 text-[11px] text-muted-dark text-center font-mono">
                      Showing top 100 symbols by size. Use search to filter further.
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
