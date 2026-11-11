import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient {
  if (browserClient) {
    return browserClient;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  browserClient = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce",
    },
  });
  return browserClient;
}

export function getAuthCallbackUrl(): string {
  return `${window.location.origin}/auth/callback`;
}

export async function getCurrentSession(): Promise<Session | null> {
  const { data, error } = await getSupabaseBrowserClient().auth.getSession();
  if (error) {
    throw error;
  }
  return data.session;
}

export function describeAuthError(message: string, mode: "login" | "signup"): string {
  const normalized = message.toLowerCase();
  if (normalized.includes("email not confirmed") || normalized.includes("not verified")) {
    return "Please verify your email address before signing in.";
  }
  if (
    normalized.includes("user already registered") ||
    normalized.includes("already been registered") ||
    normalized.includes("duplicate")
  ) {
    return "An account with this email already exists. Try signing in instead.";
  }
  if (normalized.includes("invalid login credentials") || normalized.includes("invalid password")) {
    return "Incorrect email or password.";
  }
  if (normalized.includes("password") && (normalized.includes("weak") || normalized.includes("short"))) {
    return "Choose a stronger password and try again.";
  }
  if (normalized.includes("invalid email") || normalized.includes("email")) {
    return "Enter a valid email address.";
  }
  return mode === "signup"
    ? "We could not create your account. Check your details and try again."
    : "We could not sign you in. Check your details and try again.";
}
