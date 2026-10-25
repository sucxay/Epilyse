 "use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { GraphCanvas } from "@/components/GraphCanvas";
import { Sidebar } from "@/components/Sidebar";
import type { RepositoryGraph } from "@/lib/api";

export default function GraphPage() {
  const [graph, setGraph] = useState<RepositoryGraph | null>(null);
  useEffect(() => {
    const stored = window.localStorage.getItem("coderag-latest-graph");
    if (!stored) return;
    try {
      const parsed: unknown = JSON.parse(stored);
      if (typeof parsed === "object" && parsed !== null && "graph" in parsed) {
        setGraph(parsed.graph as RepositoryGraph);
      }
    } catch {
      window.localStorage.removeItem("coderag-latest-graph");
    }
  }, []);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="min-w-0 flex-1">
        <header className="border-b border-slate-200 bg-white px-5 py-5 sm:px-8"><div className="mx-auto max-w-6xl"><p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">Workspace</p><h1 className="mt-1 text-xl font-bold tracking-tight">Dependency graph</h1></div></header>
        <div className="mx-auto max-w-6xl space-y-5 px-5 py-7 sm:px-8">
          <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm text-slate-500">Explore imports, definitions, and calls for an analyzed revision.</p></div><Link href="/" className="text-sm font-bold text-accent hover:underline">← Back to overview</Link></div>
          <GraphCanvas graph={graph} />
        </div>
      </main>
    </div>
  );
}
