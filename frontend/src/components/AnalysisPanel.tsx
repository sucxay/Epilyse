"use client";

import { FormEvent, useState } from "react";
import { buildRepositoryGraph, cloneRepository, registerRepository, type CloneResponse, type RegisterResponse, type RepositoryGraph } from "@/lib/api";

interface AnalysisPanelProps {
  onComplete: (registration: RegisterResponse, clone: CloneResponse, graph: RepositoryGraph) => void;
}

export function AnalysisPanel({ onComplete }: AnalysisPanelProps) {
  const [url, setUrl] = useState("");
  const [revision, setRevision] = useState("");
  const [step, setStep] = useState<"idle" | "registering" | "cloning" | "graph">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setStep("registering");
    try {
      const registration = await registerRepository(url.trim(), revision.trim());
      setStep("cloning");
      const clone = await cloneRepository(registration.repository_id, registration.current_commit_sha);
      setStep("graph");
      const graph = await buildRepositoryGraph(registration.repository_id, clone.commit_sha);
      onComplete(registration, clone, graph);
      setStep("idle");
    } catch (requestError) {
      setStep("idle");
      setError(requestError instanceof Error ? requestError.message : "The repository could not be analyzed.");
    }
  }

  const busy = step !== "idle";
  return (
    <section className="rounded-2xl bg-ink p-6 text-white shadow-panel sm:p-8">
      <div className="max-w-2xl">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-300">New analysis</p>
        <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">Understand any repository, faster.</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">Connect a public GitHub repository to inspect its source structure and prepare it for retrieval.</p>
      </div>
      <form className="mt-8 grid gap-4 md:grid-cols-[1fr_0.7fr_auto] md:items-end" onSubmit={handleSubmit}>
        <label className="block">
          <span className="mb-2 block text-xs font-semibold text-slate-300">GitHub repository URL</span>
          <input required type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://github.com/owner/repository" className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3.5 py-3 text-sm text-white outline-none ring-orange-300 placeholder:text-slate-500 focus:ring-2" />
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-semibold text-slate-300">Branch or commit <span className="font-normal text-slate-500">(optional)</span></span>
          <input value={revision} onChange={(event) => setRevision(event.target.value)} placeholder="main or SHA" className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3.5 py-3 text-sm text-white outline-none ring-orange-300 placeholder:text-slate-500 focus:ring-2" />
        </label>
        <button disabled={busy} className="rounded-lg bg-accent px-5 py-3 text-sm font-bold text-white transition hover:bg-orange-600 disabled:cursor-wait disabled:opacity-60">
          {step === "registering" ? "Connecting…" : step === "cloning" ? "Preparing…" : step === "graph" ? "Building graph…" : "Analyze repository"}
        </button>
      </form>
      {busy && <p className="mt-4 text-xs text-orange-200" role="status">{step === "registering" ? "Validating repository and branch with GitHub…" : step === "cloning" ? "Checking out the requested revision…" : "Parsing source files and resolving relationships…"}</p>}
      {error && <p className="mt-4 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-200" role="alert">{error}</p>}
    </section>
  );
}
