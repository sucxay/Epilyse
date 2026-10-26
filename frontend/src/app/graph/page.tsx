"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { GraphCanvas } from "@/components/GraphCanvas";
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
        <GraphCanvas graph={graph} />
      </main>
    </div>
  );
}
