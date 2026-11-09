"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { StatCard } from "@/components/StatCard";
import { StatRow } from "@/components/StatRow";
import type { GraphNode, RepositoryGraph } from "@/lib/api";

interface AreaInfo {
  directory: string;
  files: number;
  classes: number;
  functions: number;
  totalNodes: number;
}

export default function ContributorsPage() {
  const [graph, setGraph] = useState<RepositoryGraph | null>(null);
  const [loading, setLoading] = useState(true);
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

  // Group nodes by directory area
  const areas = useMemo<AreaInfo[]>(() => {
    const map = new Map<string, AreaInfo>();

    for (const node of nodes) {
      const parts = node.path.split("/");
      // Get directory or root
      const dir = parts.length > 1 ? parts.slice(0, parts.length - 1).join("/") : "(root)";

      let area = map.get(dir);
      if (!area) {
        area = {
          directory: dir,
          files: 0,
          classes: 0,
          functions: 0,
          totalNodes: 0,
        };
        map.set(dir, area);
      }

      area.totalNodes += 1;
      if (node.type === "file") {
        area.files += 1;
      } else if (node.kind === "class") {
        area.classes += 1;
      } else if (node.kind === "function" || node.kind === "method") {
        area.functions += 1;
      }
    }

    return Array.from(map.values()).sort((a, b) => b.totalNodes - a.totalNodes);
  }, [nodes]);

  const fileCount = nodes.filter((n) => n.type === "file").length;
  const classCount = nodes.filter((n) => n.kind === "class").length;
  const functionCount = nodes.filter((n) => n.kind === "function" || n.kind === "method").length;

  const filteredAreas = areas.filter((area) =>
    area.directory.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Header */}
      <div className="h-12 border-b border-white/[0.08] px-6 flex items-center justify-between shrink-0 bg-surface/50">
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-mono uppercase tracking-wider text-muted-dark">
            Contributors
          </span>
          <span className="text-white/[0.15]">/</span>
          <span className="text-xs font-medium text-ink truncate">
            Codebase Areas & Ownership
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/graph"
            className="text-xs font-medium bg-accent hover:bg-accent-hover text-white px-2.5 py-1 rounded transition-colors inline-flex items-center gap-1"
          >
            <span>View Graph</span>
            <span className="text-[10px]">→</span>
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6 space-y-6 max-w-6xl w-full mx-auto">
        {!graph && !loading ? (
          <div className="bg-surface border border-white/[0.08] rounded p-12 text-center">
            <p className="text-sm font-medium text-ink">No Repository Loaded</p>
            <p className="mt-1 text-xs text-muted max-w-md mx-auto">
              Analyze a repository from the Overview page to explore directory boundaries, node
              distributions, and module areas.
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
            {/* Honest Git Blame / Contributor Notice */}
            <div className="bg-surface border border-white/[0.08] rounded p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-warning" />
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                    Contributor Metadata Status
                  </h3>
                </div>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-warning/10 text-warning border border-warning/20">
                  Git Blame Unindexed
                </span>
              </div>
              <p className="text-xs text-muted leading-relaxed">
                Direct contributor authorship attribution is currently omitted from AST parsing to
                preserve ingestion performance. Git-blame and line-level author mapping will be
                supported in an upcoming release. Below is the structural module distribution and
                domain areas inferred from repository paths.
              </p>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard
                label="Directory Areas"
                value={areas.length}
                detail="Unique module paths"
              />
              <StatCard
                label="Source Files"
                value={fileCount}
                detail="Indexed file nodes"
              />
              <StatCard
                label="Class Definitions"
                value={classCount}
                detail="OOP structures"
              />
              <StatCard
                label="Functions"
                value={functionCount}
                detail="Methods & routines"
              />
            </div>

            {/* Codebase Areas Breakdown */}
            <div className="bg-surface border border-white/[0.08] rounded p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                    Module Areas & Functional Domains
                  </h3>
                  <p className="text-[11px] text-muted-dark mt-0.5">
                    Component distribution grouped by filesystem hierarchy
                  </p>
                </div>

                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter directory…"
                  className="bg-bg border border-white/[0.08] rounded px-2.5 py-1 text-xs text-ink placeholder:text-muted-dark focus:outline-none focus:border-accent w-56"
                />
              </div>

              {filteredAreas.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-dark">
                  No directory areas match your search.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse font-mono">
                    <thead>
                      <tr className="border-b border-white/[0.08] text-muted-dark text-[10px] uppercase">
                        <th className="py-2 px-3">Directory / Module</th>
                        <th className="py-2 px-3 text-right">Files</th>
                        <th className="py-2 px-3 text-right">Classes</th>
                        <th className="py-2 px-3 text-right">Functions</th>
                        <th className="py-2 px-3 text-right">Total Entities</th>
                        <th className="py-2 px-3 text-right">% of Codebase</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                      {filteredAreas.map((area) => {
                        const pct = nodes.length > 0
                          ? ((area.totalNodes / nodes.length) * 100).toFixed(1)
                          : "0";
                        return (
                          <tr
                            key={area.directory}
                            className="hover:bg-white/[0.02] transition-colors"
                          >
                            <td className="py-2.5 px-3 text-ink font-medium">
                              <span className="text-muted-dark">/</span>
                              {area.directory}
                            </td>
                            <td className="py-2.5 px-3 text-right text-muted">
                              {area.files}
                            </td>
                            <td className="py-2.5 px-3 text-right text-muted">
                              {area.classes}
                            </td>
                            <td className="py-2.5 px-3 text-right text-muted">
                              {area.functions}
                            </td>
                            <td className="py-2.5 px-3 text-right text-ink font-medium">
                              {area.totalNodes}
                            </td>
                            <td className="py-2.5 px-3 text-right text-muted-dark">
                              <div className="inline-flex items-center gap-2">
                                <div className="w-12 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-accent rounded-full"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                <span className="text-[11px]">{pct}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Node Breakdown Table */}
            <div className="bg-surface border border-white/[0.08] rounded p-4">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-3">
                Entity Type Proportions
              </h3>
              <div className="divide-y divide-white/[0.06]">
                <StatRow
                  label="File Nodes"
                  value={`${fileCount} (${nodes.length > 0 ? ((fileCount / nodes.length) * 100).toFixed(1) : 0}%)`}
                  detail="Top-level python modules"
                />
                <StatRow
                  label="Class Nodes"
                  value={`${classCount} (${nodes.length > 0 ? ((classCount / nodes.length) * 100).toFixed(1) : 0}%)`}
                  detail="Object-oriented class structures"
                />
                <StatRow
                  label="Function & Method Nodes"
                  value={`${functionCount} (${nodes.length > 0 ? ((functionCount / nodes.length) * 100).toFixed(1) : 0}%)`}
                  detail="Callable execution routines"
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
