"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";

interface NavItem {
  name: string;
  href: string;
  badge?: string;
  icon: (props: { className?: string }) => React.JSX.Element;
}

const navItems: NavItem[] = [
  {
    name: "Overview",
    href: "/",
    icon: ({ className }) => (
      <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M2.5 6.5L8 2.5l5.5 4v7h-4v-4h-3v4h-4v-7z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    name: "Repositories",
    href: "/repositories",
    icon: ({ className }) => (
      <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 2.5h10a1 1 0 011 1v9a1 1 0 01-1 1H3a1 1 0 01-1-1v-9a1 1 0 011-1z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M2 6h12M6 2.5v11" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    name: "Code Graph",
    href: "/graph",
    icon: ({ className }) => (
      <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="4" cy="4" r="2" />
        <circle cx="12" cy="5" r="2" />
        <circle cx="7" cy="12" r="2" />
        <path d="M5.5 5.5l5 5M5.8 4.2l4.4.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    name: "Commit History",
    href: "/commits",
    icon: ({ className }) => (
      <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="8" cy="8" r="3" />
        <path d="M8 1v4M8 11v4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    name: "Contributors",
    href: "/contributors",
    icon: ({ className }) => (
      <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="8" cy="5" r="2.5" />
        <path d="M3.5 13.5c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    name: "Quality Analysis",
    href: "/quality",
    icon: ({ className }) => (
      <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M2 13.5h12M4 11V8M8 11V5M12 11V3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    name: "Settings",
    href: "/settings",
    icon: ({ className }) => (
      <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="8" cy="8" r="2.2" />
        <path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-[220px] shrink-0 h-screen bg-sidebar border-r border-white/[0.08] flex flex-col justify-between select-none">
      <div className="flex flex-col">
        {/* App Header / Brand */}
        <div className="h-12 px-4 flex items-center gap-2.5 border-b border-white/[0.06]">
          <div className="w-5 h-5 rounded bg-accent/20 border border-accent/40 flex items-center justify-center">
            <span className="text-[11px] font-mono font-bold text-accent">E</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xs font-semibold tracking-tight text-ink">Epilyse</span>
            <span className="text-[10px] font-mono text-muted-dark">v0.1</span>
          </div>
        </div>

        {/* Section Header */}
        <div className="px-4 pt-4 pb-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-dark">
            Workspace
          </span>
        </div>

        {/* Navigation Items */}
        <nav className="flex flex-col px-2 space-y-0.5" aria-label="Main navigation">
          {navItems.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`relative flex items-center gap-2.5 px-2.5 py-1.5 rounded text-xs transition-colors ${
                  isActive
                    ? "bg-white/[0.06] text-ink font-medium"
                    : "text-muted hover:text-ink hover:bg-white/[0.03]"
                }`}
              >
                {isActive && (
                  <span
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-accent rounded-r"
                    aria-hidden="true"
                  />
                )}
                <item.icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? "text-accent" : "text-muted group-hover:text-ink"
                  }`}
                />
                <span className="truncate">{item.name}</span>
                {item.badge && (
                  <span className="ml-auto text-[9px] font-mono uppercase px-1 py-0.2 rounded bg-white/[0.06] text-muted-dark">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer / Account & Version */}
      <div className="border-t border-white/[0.06] p-3">
        <div className="flex items-center gap-2 px-1 py-1 rounded bg-white/[0.02] border border-white/[0.04]">
          <div className="w-5 h-5 rounded-full bg-white/[0.08] border border-white/[0.1] flex items-center justify-center text-[10px] font-mono text-muted">
            GH
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium text-ink truncate leading-tight">
              Developer
            </p>
            <p className="text-[10px] font-mono text-muted-dark truncate leading-tight">
              github.com
            </p>
          </div>
          <span className="w-1.5 h-1.5 rounded-full bg-success shrink-0" title="API Connected" />
        </div>
        <div className="mt-2 px-1 flex items-center justify-between text-[10px] font-mono text-muted-dark">
          <span>Epilyse Engine</span>
          <span>0.1.0</span>
        </div>
      </div>
    </aside>
  );
}
