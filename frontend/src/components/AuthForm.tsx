"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { getDemoUser, saveDemoUser, startDemoSession } from "@/lib/demo-auth";

type AuthMode = "login" | "signup";

function EpilyseMark() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-accent/40 bg-accent/15 shadow-[0_0_24px_rgba(79,124,255,0.12)]">
        <span className="font-mono text-sm font-bold text-accent">E</span>
      </div>
      <span className="text-sm font-semibold tracking-tight text-ink">Epilyse</span>
    </div>
  );
}

function GithubIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 .5a12 12 0 0 0-3.79 23.39c.6.11.82-.26.82-.58v-2.04c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.74.08-.74 1.2.09 1.83 1.23 1.83 1.23 1.07 1.83 2.8 1.3 3.48.99.11-.77.42-1.3.76-1.6-2.66-.3-5.46-1.33-5.46-5.93 0-1.31.47-2.38 1.23-3.22-.12-.3-.53-1.52.12-3.17 0 0 1-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.3-1.55 3.3-1.23 3.3-1.23.65 1.65.24 2.87.12 3.17.76.84 1.23 1.91 1.23 3.22 0 4.61-2.8 5.62-5.47 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.69.83.57A12 12 0 0 0 12 .5Z" />
    </svg>
  );
}

function EyeIcon({ hidden }: { hidden: boolean }) {
  return hidden ? (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M3 3l18 18M10.58 10.58a2 2 0 0 0 2.83 2.83M9.88 4.24A10.7 10.7 0 0 1 12 4c5 0 8.5 4 9.5 6-.42.84-1.32 2.1-2.7 3.05M6.23 6.23C3.85 7.58 2.7 9.42 2.5 10c1 2 4.5 6 9.5 6 1.18 0 2.27-.22 3.25-.59" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ) : (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}

function Field({
  id,
  label,
  type = "text",
  placeholder,
  autoComplete,
  action,
}: {
  id: string;
  label: string;
  type?: string;
  placeholder: string;
  autoComplete?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-xs font-medium text-ink">
          {label}
        </label>
        {action}
      </div>
      <input
        id={id}
        name={id}
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required
        className="h-11 w-full rounded-md border border-white/[0.1] bg-[#0d1117] px-3.5 text-sm text-ink outline-none transition-colors placeholder:text-muted-dark hover:border-white/[0.16] focus:border-accent focus:ring-2 focus:ring-accent/15"
      />
    </div>
  );
}

export function AuthForm({ mode }: { mode: AuthMode }) {
  const isLogin = mode === "login";
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const password = String(formData.get("password") ?? "");

    if (isLogin) {
      const user = getDemoUser();
      if (!user || user.email !== email || user.password !== password) {
        setError("Incorrect email or password. Create an account first if you are new to Epilyse.");
        return;
      }

      startDemoSession();
      router.push("/");
      return;
    }

    const fullName = String(formData.get("full-name") ?? "").trim();
    const confirmPassword = String(formData.get("confirm-password") ?? "");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    saveDemoUser({ fullName, email, password });
    router.push("/");
  }

  return (
    <main className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[#090b10] px-5 py-10 text-ink">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(79,124,255,0.09),transparent_38%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:radial-gradient(rgba(255,255,255,0.11)_0.7px,transparent_0.7px)] [background-size:28px_28px] [mask-image:linear-gradient(to_bottom,black,transparent_80%)]" />

      <div className="relative z-10 w-full max-w-[410px]">
        <div className="mb-8 flex justify-center">
          <EpilyseMark />
        </div>

        <section className="rounded-xl border border-white/[0.1] bg-[#11151c]/95 p-7 shadow-2xl shadow-black/30 sm:p-8">
          <div className="mb-7 text-center">
            <h1 className="text-xl font-semibold tracking-tight text-white">
              {isLogin ? "Welcome back" : "Create your account"}
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted">
              {isLogin
                ? "Sign in to continue to your repository workspace."
                : "Start exploring your codebase with Epilyse."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <Field
                id="full-name"
                label="Full name"
                placeholder="Ada Lovelace"
                autoComplete="name"
              />
            )}

            <Field
              id="email"
              label="Email"
              type="email"
              placeholder="you@company.com"
              autoComplete="email"
            />

            <Field
              id="password"
              label="Password"
              type={showPassword ? "text" : "password"}
              placeholder={isLogin ? "Enter your password" : "Create a password"}
              autoComplete={isLogin ? "current-password" : "new-password"}
              action={
                isLogin ? (
                  <Link href="#forgot-password" className="text-xs text-accent transition-colors hover:text-accent-hover">
                    Forgot password?
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    className="inline-flex items-center gap-1.5 text-xs text-muted transition-colors hover:text-ink"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    <EyeIcon hidden={!showPassword} />
                    {showPassword ? "Hide" : "Show"}
                  </button>
                )
              }
            />

            {!isLogin && (
              <Field
                id="confirm-password"
                label="Confirm password"
                type={showPassword ? "text" : "password"}
                placeholder="Repeat your password"
                autoComplete="new-password"
              />
            )}

            {isLogin && (
              <label className="flex items-center gap-2.5 pt-1 text-xs text-muted">
                <input
                  type="checkbox"
                  name="remember"
                  className="h-3.5 w-3.5 rounded border-white/20 bg-[#0d1117] text-accent accent-accent focus:ring-accent/30"
                />
                <span>Remember me</span>
              </label>
            )}

            <button
              type="submit"
              className="h-11 w-full rounded-md bg-accent text-sm font-medium text-white transition-colors hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-accent/40"
            >
              {isLogin ? "Sign in" : "Create account"}
            </button>
            {error && (
              <p role="alert" className="text-xs leading-5 text-danger">
                {error}
              </p>
            )}
          </form>

          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-white/[0.08]" />
            <span className="text-[11px] uppercase tracking-wider text-muted-dark">or</span>
            <span className="h-px flex-1 bg-white/[0.08]" />
          </div>

          <button
            type="button"
            onClick={() => {
              saveDemoUser({
                fullName: "GitHub Developer",
                email: "github@example.com",
                password: "github-demo",
              });
              router.push("/");
            }}
            className="flex h-11 w-full items-center justify-center gap-2.5 rounded-md border border-white/[0.12] bg-white/[0.02] text-sm font-medium text-ink transition-colors hover:border-white/[0.2] hover:bg-white/[0.05] focus:outline-none focus:ring-2 focus:ring-white/10"
          >
            <GithubIcon />
            Continue with GitHub
          </button>
        </section>

        <p className="mt-6 text-center text-sm text-muted">
          {isLogin ? "New to Epilyse?" : "Already have an account?"}{" "}
          <Link
            href={isLogin ? "/signup" : "/login"}
            className="font-medium text-accent transition-colors hover:text-accent-hover"
          >
            {isLogin ? "Create account" : "Log in"}
          </Link>
        </p>

        <p className="mt-8 text-center text-[11px] leading-5 text-muted-dark">
          By continuing, you agree to Epilyse&apos;s terms and privacy policy.
        </p>
      </div>
    </main>
  );
}
