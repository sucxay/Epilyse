import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;
const SESSION_REFRESH_MARGIN_SECONDS = 60;

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

export async function getCurrentSession(forceRefresh = false): Promise<Session | null> {
  const client = getSupabaseBrowserClient();
  const { data, error } = forceRefresh
    ? await client.auth.refreshSession()
    : await client.auth.getSession();
  if (error) {
    throw error;
  }

  if (!data.session || forceRefresh) {
    return data.session;
  }

  const expiresAt = data.session.expires_at;
  const expiresSoon =
    typeof expiresAt === "number" &&
    expiresAt - Math.floor(Date.now() / 1000) <= SESSION_REFRESH_MARGIN_SECONDS;
  if (!expiresSoon) {
    return data.session;
  }

  const refreshed = await client.auth.refreshSession();
  if (refreshed.error) {
    throw refreshed.error;
  }
  return refreshed.data.session;
}

export async function getCurrentAccessToken(forceRefresh = false): Promise<string> {
  const session = await getCurrentSession(forceRefresh);
  if (!session?.access_token) {
    throw new Error("Your session has expired. Please sign in again.");
  }
  return session.access_token;
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
  if (normalized.includes("invalid email")) {
    return "Enter a valid email address.";
  }
  return mode === "signup"
    ? "We could not create your account. Check your details and try again."
    : "We could not sign you in. Check your details and try again.";
}
