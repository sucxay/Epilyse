"use client";

import { FormEvent, useState } from "react";
import {
  buildRepositoryGraph,
  cloneRepository,
  registerRepository,
  type CloneResponse,
  type RegisterResponse,
  type RepositoryGraph,
} from "@/lib/api";

interface AnalysisPanelProps {
  onComplete: (
    registration: RegisterResponse,
    clone: CloneResponse,
    graph: RepositoryGraph
  ) => void;
  className?: string;
}

export function AnalysisPanel({ onComplete, className = "" }: AnalysisPanelProps) {
  const [url, setUrl] = useState("");
  const [revision, setRevision] = useState("");
  const [step, setStep] = useState<"idle" | "registering" | "cloning" | "graph">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!url.trim()) return;

    setError(null);
    setStep("registering");
    try {
      const registration = await registerRepository(url.trim(), revision.trim());
      if (!registration.repository_id || !registration.current_commit_sha) {
        throw new Error("Repository registration succeeded, but no commit SHA was returned.");
      }
      setStep("cloning");
      const clone = await cloneRepository(registration.repository_id, registration.current_commit_sha);
      if (clone.commit_sha !== registration.current_commit_sha) {
        throw new Error("The checked-out commit does not match the registered repository revision.");
      }
      setStep("graph");
      const graph = await buildRepositoryGraph(registration.repository_id, clone.commit_sha);
      onComplete(registration, clone, graph);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The repository could not be analyzed.");
    } finally {
      setStep("idle");
    }
  }

  const busy = step !== "idle";

  return (
    <div className={`bg-surface border border-white/[0.08] rounded p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-accent" />
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            Repository Analysis
          </h2>
        </div>
        {busy && (
          <span className="text-xs text-accent font-mono animate-pulse">
            {step === "registering"
              ? "Registering..."
              : step === "cloning"
              ? "Cloning repository..."
              : "Building graph..."}
          </span>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-2.5 items-stretch md:items-center">
        <div className="flex-1 relative">
          <input
            required
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://github.com/owner/repository"
            disabled={busy}
            className="w-full bg-bg border border-white/[0.08] rounded px-3 py-2 text-xs text-ink placeholder:text-muted-dark focus:outline-none focus:border-accent transition-colors disabled:opacity-50"
          />
        </div>

        <div className="w-full md:w-56">
          <input
            type="text"
            value={revision}
            onChange={(e) => setRevision(e.target.value)}
            placeholder="Branch or commit (optional)"
            disabled={busy}
            className="w-full bg-bg border border-white/[0.08] rounded px-3 py-2 text-xs text-ink placeholder:text-muted-dark focus:outline-none focus:border-accent transition-colors disabled:opacity-50"
          />
        </div>

        <button
          type="submit"
          disabled={busy || !url.trim()}
          className="shrink-0 bg-accent hover:bg-accent-hover text-white text-xs font-medium px-4 py-2 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-1.5"
        >
          {busy ? (
            <span>Analyzing…</span>
          ) : (
            <>
              <span>Analyze</span>
              <span className="text-[10px]">→</span>
            </>
          )}
        </button>
      </form>

      {error && (
        <div className="mt-2.5 text-xs text-danger font-mono flex items-center gap-1.5">
          <span>✕</span>
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
