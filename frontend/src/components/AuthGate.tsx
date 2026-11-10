"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { hasDemoSession } from "@/lib/demo-auth";

const publicRoutes = new Set(["/login", "/signup"]);

export function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const authenticated = hasDemoSession();

    if (!publicRoutes.has(pathname) && !authenticated) {
      router.replace("/login");
      return;
    }

    if (publicRoutes.has(pathname) && authenticated) {
      router.replace("/");
      return;
    }

    setIsReady(true);
  }, [pathname, router]);

  if (!isReady) {
    return <div className="min-h-screen w-full bg-bg" aria-hidden="true" />;
  }

  return children;
}
