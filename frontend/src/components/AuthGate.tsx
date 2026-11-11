"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase";

const publicRoutes = new Set(["/login", "/signup", "/auth/callback"]);

export function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let active = true;
    const supabase = getSupabaseBrowserClient();
    const applyRoute = (authenticated: boolean) => {
      if (!active) return;
      if (!publicRoutes.has(pathname) && !authenticated) {
        router.replace("/login");
        return;
      }
      if (publicRoutes.has(pathname) && authenticated && pathname !== "/auth/callback") {
        router.replace("/");
        return;
      }
      setIsReady(true);
    };

    void supabase.auth.getSession().then(({ data }) => applyRoute(Boolean(data.session)));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      applyRoute(Boolean(session));
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [pathname, router]);

  if (!isReady) {
    return <div className="min-h-screen w-full bg-bg" aria-hidden="true" />;
  }

  return children;
}
