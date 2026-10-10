import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CircleUserRound, Bookmark, LogOut, ArrowLeft } from "lucide-react";
import { useSession, pill } from "@/lib/session";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile — Xorost" },
      { name: "description", content: "Your Xorost profile, saved videos and account settings." },
      { property: "og:title", content: "Profile — Xorost" },
      { property: "og:description", content: "Your Xorost profile, saved videos and account settings." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const session = useSession();
  const navigate = useNavigate();

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft size={16} /> Back to feed
        </Link>

        {session ? (
          <>
            <div className="mt-5 flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <CircleUserRound size={30} />
              </div>
              <div className="min-w-0">
                <p className="truncate font-display text-lg font-semibold">
                  {session.user.email?.split("@")[0]}
                </p>
                <p className="truncate text-sm text-muted-foreground">{session.user.email}</p>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-2">
              <Link to="/saved" className="flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm hover:bg-muted">
                <Bookmark size={16} /> Saved videos
              </Link>
              <button
                onClick={async () => {
                  await supabase.auth.signOut();
                  navigate({ to: "/" });
                }}
                className="flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm hover:bg-muted"
              >
                <LogOut size={16} /> Sign out
              </button>
            </div>
          </>
        ) : (
          <div className="mt-6 flex flex-col items-center gap-3 text-center">
            <p className="text-sm text-muted-foreground">Sign in to see your profile and saved videos.</p>
            <Link to="/auth" className={pill}>Sign in</Link>
          </div>
        )}
      </div>
    </main>
  );
}
