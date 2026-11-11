"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase";

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const completeSignIn = async () => {
      const code = searchParams.get("code");
      const supabase = getSupabaseBrowserClient();
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          if (active) setError("We could not complete GitHub sign-in. Please try again.");
          return;
        }
      }
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        router.replace("/");
      } else if (active) {
        setError("No active session was returned. Please try signing in again.");
      }
    };
    void completeSignIn();
    return () => {
      active = false;
    };
  }, [router, searchParams]);

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-[#090b10] text-sm text-muted">
      {error || "Completing sign-in..."}
    </main>
  );
}
