import Link from "next/link";

export function Sidebar() {
  return (
    <aside className="hidden min-h-screen w-64 shrink-0 border-r border-slate-200 bg-white px-6 py-7 lg:block">
      <Link href="/" className="flex items-center gap-3" aria-label="CodeRAG home">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-ink text-sm font-bold text-white">CR</span>
        <span className="text-lg font-bold tracking-tight">CodeRAG</span>
      </Link>
      <p className="mt-12 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Workspace</p>
      <nav className="mt-3 space-y-1" aria-label="Primary navigation">
        <Link href="/" className="flex items-center gap-3 rounded-lg bg-orange-50 px-3 py-2.5 text-sm font-semibold text-accent">
          <span aria-hidden="true">⌂</span> Overview
        </Link>
        <Link href="/graph" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-500 transition hover:bg-slate-50 hover:text-ink">
          <span aria-hidden="true">◇</span> Dependency graph
        </Link>
      </nav>
      <div className="mt-auto pt-16">
        <div className="rounded-xl border border-slate-200 bg-mist p-4">
          <p className="text-xs font-bold text-ink">Backend connection</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">Uses the FastAPI service configured by NEXT_PUBLIC_API_BASE_URL.</p>
        </div>
      </div>
    </aside>
  );
}
