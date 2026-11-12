"use client";

import { useEffect, useState } from "react";
import { StatRow } from "@/components/StatRow";
import { useLastRegisteredRepository } from "@/lib/useLastRegisteredRepository";

function formatTimestamp(timestamp: string): string {
  const parsed = new Date(timestamp);
  return Number.isNaN(parsed.getTime()) ? timestamp : parsed.toLocaleString();
}

export default function SettingsPage() {
  const [cleared, setCleared] = useState(false);
  const [cachedRepoId, setCachedRepoId] = useState<string | null>(null);
  const [hasGraphCache, setHasGraphCache] = useState(false);
  const {
    repository: persistedRepository,
    loading: persistedLoading,
  } = useLastRegisteredRepository();

  useEffect(() => {
    const id = window.localStorage.getItem("epilyse-repository-id");
    const graph = window.localStorage.getItem("coderag-latest-graph");
    setCachedRepoId(id);
    setHasGraphCache(Boolean(graph));
  }, []);

  function handleClearCache() {
    window.localStorage.removeItem("coderag-latest-graph");
    window.localStorage.removeItem("epilyse-repository-id");
    setCachedRepoId(null);
    setHasGraphCache(false);
    setCleared(true);
    setTimeout(() => setCleared(false), 3000);
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Header */}
      <div className="h-12 border-b border-white/[0.08] px-6 flex items-center justify-between shrink-0 bg-surface/50">
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-mono uppercase tracking-wider text-muted-dark">
            Settings
          </span>
          <span className="text-white/[0.15]">/</span>
          <span className="text-xs font-medium text-ink">
            Platform Configuration
          </span>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6 space-y-6 max-w-4xl w-full mx-auto">
        {/* Backend Endpoint Info */}
        <div className="bg-surface border border-white/[0.08] rounded p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              Backend Service Connection
            </h3>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-success/10 text-success border border-success/20">
              Connected
            </span>
          </div>
          <div className="divide-y divide-white/[0.06]">
            <StatRow
              label="API Base URL"
              value={process.env.NEXT_PUBLIC_API_BASE_URL || "https://epilyse.onrender.com"}
            />
            <StatRow
              label="Environment"
              value={process.env.NODE_ENV || "production"}
              badge="runtime"
            />
            <StatRow
              label="Transport Protocol"
              value="HTTP/2 + REST JSON"
              mono={false}
            />
            <StatRow
              label="Timeout Limit"
              value="20,000 ms"
            />
          </div>
        </div>

        {/* Server-Side Registration */}
        <div className="bg-surface border border-white/[0.08] rounded p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              Server-Side Registration
            </h3>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase border ${
                persistedRepository
                  ? "bg-success/10 text-success border-success/20"
                  : "bg-white/[0.04] text-muted border-white/[0.08]"
              }`}
            >
              {persistedLoading ? "Checking" : persistedRepository ? "MongoDB" : "None"}
            </span>
          </div>
          <p className="text-xs text-muted leading-relaxed mb-4">
            The latest registered repository is stored per authenticated account in MongoDB, so it
            is available on any browser after signing in.
          </p>

          <div className="divide-y divide-white/[0.06]">
            <StatRow
              label="Registered Repository"
              value={
                persistedRepository
                  ? `${persistedRepository.owner}/${persistedRepository.name}`
                  : persistedLoading
                  ? "Loading…"
                  : "None registered"
              }
              mono={false}
            />
            <StatRow label="Branch" value={persistedRepository?.branch ?? "—"} />
            <StatRow
              label="Commit SHA"
              value={
                persistedRepository?.commit ? persistedRepository.commit.slice(0, 10) : "—"
              }
            />
            <StatRow
              label="Registered At"
              value={
                persistedRepository ? formatTimestamp(persistedRepository.timestamp) : "—"
              }
              mono={false}
            />
          </div>
        </div>

        {/* Local Storage & Cache */}
        <div className="bg-surface border border-white/[0.08] rounded p-4">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-3">
            Local Workspace Storage
          </h3>
          <p className="text-xs text-muted leading-relaxed mb-4">
            Epilyse caches the latest analyzed AST graph in browser local storage for instant
            retrieval between page reloads. The repository registration itself is stored
            server-side in MongoDB, so clearing this cache does not unregister the repository.
          </p>

          <div className="divide-y divide-white/[0.06] mb-4">
            <StatRow
              label="Active Repository ID"
              value={cachedRepoId || persistedRepository?.repository_id || "None registered"}
            />
            <StatRow
              label="Cached Graph Cache State"
              value={hasGraphCache ? "Populated" : "Empty"}
              badge={hasGraphCache ? "Active" : "Clean"}
              mono={false}
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              onClick={handleClearCache}
              disabled={!hasGraphCache && !cachedRepoId}
              className="text-xs font-medium px-3 py-1.5 rounded border border-danger/30 text-danger hover:bg-danger/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Clear Cached Graph Data
            </button>
            {cleared && (
              <span className="text-xs font-mono text-success">
                Local graph data cleared successfully.
              </span>
            )}
          </div>
        </div>

        {/* Feature Flags / Coming Soon */}
        <div className="bg-surface border border-white/[0.08] rounded p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              Engine Capabilities & Roadmap
            </h3>
            <span className="text-[10px] font-mono text-muted-dark uppercase">
              Release Pipeline
            </span>
          </div>

          <div className="divide-y divide-white/[0.06]">
            <div className="py-2.5 flex items-center justify-between text-xs">
              <div>
                <span className="text-ink font-medium block">Git-Blame & Contributor Extraction</span>
                <span className="text-muted-dark text-[11px]">
                  Map AST symbol lines to commit author signatures
                </span>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-white/[0.04] text-muted border border-white/[0.08]">
                Coming Soon
              </span>
            </div>

            <div className="py-2.5 flex items-center justify-between text-xs">
              <div>
                <span className="text-ink font-medium block">Multi-Language Tree-sitter Parser</span>
                <span className="text-muted-dark text-[11px]">
                  TypeScript, Go, Rust, and Java symbol parsing
                </span>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-white/[0.04] text-muted border border-white/[0.08]">
                Coming Soon
              </span>
            </div>

            <div className="py-2.5 flex items-center justify-between text-xs">
              <div>
                <span className="text-ink font-medium block">Pull Request Delta Visualizer</span>
                <span className="text-muted-dark text-[11px]">
                  Diff highlight between branches directly inside GraphCanvas
                </span>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-white/[0.04] text-muted border border-white/[0.08]">
                Coming Soon
              </span>
            </div>

            <div className="py-2.5 flex items-center justify-between text-xs">
              <div>
                <span className="text-ink font-medium block">LSP Real-Time Reference Inference</span>
                <span className="text-muted-dark text-[11px]">
                  Exact type resolution and cross-module caller index
                </span>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-white/[0.04] text-muted border border-white/[0.08]">
                Coming Soon
              </span>
            </div>
          </div>
        </div>

        {/* Engine Build Stamp */}
        <div className="text-center pt-2">
          <p className="text-[11px] font-mono text-muted-dark">
            Epilyse Intelligence Engine · v0.1.0 · Desktop Platform
          </p>
        </div>
      </div>
    </div>
  );
}
