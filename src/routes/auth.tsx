import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
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
  const [show, setShow] = useState(false);
  const ready = email.trim().length > 0 && password.length > 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (!error) {
        navigate({ to: "/" });
      } else if (error.message.toLowerCase().includes("invalid login")) {
        // No password account yet — create one on the spot and sign in.
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (signUpError) {
          setMsg(
            signUpError.message.toLowerCase().includes("already registered")
              ? "This email already has an account. Check your password and try again."
              : signUpError.message,
          );
        } else {
          navigate({ to: "/" });
        }
      } else {
        setMsg(error.message);
      }
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      if (!error) {
        navigate({ to: "/" });
      } else if (error.message.toLowerCase().includes("already registered")) {
        // Account exists — just sign in with the same password.
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) setMsg("This email already has an account. Check your password and try again.");
        else navigate({ to: "/" });
      } else {
        setMsg(error.message);
      }
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
          <div className="relative">
            <input
              type={show ? "text" : "password"}
              required
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 pr-11 text-sm outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              aria-label={show ? "Hide password" : "View password"}
              title={show ? "Hide password" : "View password"}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:text-foreground"
            >
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <button
            type="submit"
            disabled={busy || !ready}
            className="rounded-full bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40"
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
