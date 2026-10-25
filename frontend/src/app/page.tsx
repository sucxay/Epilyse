"use client";

import { useState } from "react";
import { AnalysisPanel } from "@/components/AnalysisPanel";
import { Sidebar } from "@/components/Sidebar";
import { StatCard } from "@/components/StatCard";
import type { CloneResponse, RegisterResponse, RepositoryGraph } from "@/lib/api";

export default function DashboardPage() {
  const [result, setResult] = useState<{ registration: RegisterResponse; clone: CloneResponse; graph: RepositoryGraph } | null>(null);
  function handleComplete(registration: RegisterResponse, clone: CloneResponse, graph: RepositoryGraph) {
    const nextResult = { registration, clone, graph };
    setResult(nextResult);
    window.localStorage.setItem("coderag-latest-graph", JSON.stringify(nextResult));
  }
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="min-w-0 flex-1">
        <header className="border-b border-slate-200 bg-white px-5 py-5 sm:px-8">
          <div className="mx-auto flex max-w-6xl items-center justify-between">
            <div><p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">Repository intelligence</p><h2 className="mt-1 text-xl font-bold tracking-tight">Overview</h2></div>
            <span className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500">Developer workspace</span>
          </div>
        </header>
        <div className="mx-auto max-w-6xl space-y-7 px-5 py-7 sm:px-8">
          <AnalysisPanel onComplete={handleComplete} />
          <section aria-labelledby="status-heading" className="rounded-xl border border-slate-200 bg-white p-5 shadow-panel">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><h2 id="status-heading" className="font-bold text-ink">Analysis status</h2><p className="mt-1 text-sm text-slate-500">{result ? `Checked out ${result.clone.branch} at ${result.clone.commit_sha.slice(0, 10)}.` : "Submit a repository to begin an analysis."}</p></div>
              <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${result ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{result ? "Ready" : "Waiting"}</span>
            </div>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full transition-all ${result ? "w-full bg-emerald-500" : "w-0 bg-accent"}`} /></div>
          </section>
          <section aria-labelledby="summary-heading">
            <div className="mb-4 flex items-end justify-between"><div><h2 id="summary-heading" className="font-bold text-ink">Repository summary</h2><p className="mt-1 text-sm text-slate-500">Facts reported by the backend for this revision.</p></div></div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Files" value={result?.clone.file_count ?? null} detail={result ? "Files in checkout" : "Available after analysis"} />
              <StatCard label="Definitions" value={result?.graph.nodes.filter((node) => node.type === "symbol").length ?? null} detail={result ? "Parsed source definitions" : "Available after analysis"} />
              <StatCard label="Graph nodes" value={result?.graph.nodes.length ?? null} detail={result ? "Files and symbols" : "Available after analysis"} />
              <StatCard label="Graph edges" value={result?.graph.edges.length ?? null} detail={result ? "Resolved relationships" : "Available after analysis"} />
            </div>
          </section>
          <section className="rounded-xl border border-amber-200 bg-amber-50 p-5">
            <h2 className="font-bold text-amber-950">Source-backed analysis</h2>
            <p className="mt-1 text-sm leading-6 text-amber-900/75">Definitions and relationships are calculated from the checked-out Python source using the backend parser and graph builder. Unsupported languages are not included yet.</p>
          </section>
        </div>
      </main>
    </div>
  );
}
