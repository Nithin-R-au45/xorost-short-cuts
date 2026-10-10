import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Xorost" },
      { name: "description", content: "Sign in or create your Xorost account." },
      { property: "og:title", content: "Sign in — Xorost" },
      { property: "og:description", content: "Sign in or create your Xorost account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMsg(error.message);
      else navigate({ to: "/" });
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) setMsg(error.message);
      else setMsg("Check your email to confirm your account, then sign in.");
    }
    setBusy(false);
  };


  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6">
        <Link to="/" className="font-display text-2xl font-bold tracking-tight">
          Xoro<span className="text-foreground">st</span>
        </Link>
        <h1 className="mt-4 font-display text-xl font-semibold">
          {mode === "signin" ? "Sign in" : "Create your account"}
        </h1>


        <form onSubmit={submit} className="flex flex-col gap-3">
          <input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
          />
          <input
            type="password"
            required
            minLength={6}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-full bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Sign up"}
          </button>
        </form>

        {msg && <p className="mt-3 text-sm text-muted-foreground">{msg}</p>}

        <button
          type="button"
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setMsg(null);
          }}
          className="mt-4 text-sm text-primary hover:underline"
        >
          {mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}
        </button>
      </div>
    </main>
  );
}
