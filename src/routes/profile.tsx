import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CircleUserRound, Bookmark, LogOut, ArrowLeft, Pencil, Trash2, Check, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useSession, pill } from "@/lib/session";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile — Xorost" },
      { name: "description", content: "Your Xorost profile, followers, uploads and saved videos." },
      { property: "og:title", content: "Profile — Xorost" },
      { property: "og:description", content: "Your Xorost profile, followers, uploads and saved videos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

type MyVideo = { id: string; title: string; path: string; created_at: string };

function ProfilePage() {
  const session = useSession();
  const navigate = useNavigate();
  const uid = session?.user.id;
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);
  const [videos, setVideos] = useState<MyVideo[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const load = async () => {
    if (!uid) return;
    const [{ count: fr }, { count: fg }, { data: v }] = await Promise.all([
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("followee_id", uid),
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", uid),
      supabase.from("videos").select("id,title,path,created_at").eq("user_id", uid).order("created_at", { ascending: false }),
    ]);
    setFollowers(fr ?? 0);
    setFollowing(fg ?? 0);
    setVideos(v ?? []);
    if (v?.length) {
      const { data: signed } = await supabase.storage.from("videos").createSignedUrls(v.map((x) => x.path), 60 * 60 * 6);
      const m: Record<string, string> = {};
      v.forEach((x, i) => {
        if (signed?.[i]?.signedUrl) m[x.id] = signed[i].signedUrl;
      });
      setThumbs(m);
    } else {
      setThumbs({});
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  const rename = async (v: MyVideo) => {
    const title = draft.trim();
    if (!title) return;
    const { error } = await supabase.from("videos").update({ title }).eq("id", v.id);
    if (error) toast.error("Couldn't rename video");
    else toast("Renamed");
    setEditing(null);
    load();
  };

  const remove = async (v: MyVideo) => {
    if (!window.confirm(`Delete "${v.title}"? This can't be undone.`)) return;
    const { error } = await supabase.from("videos").delete().eq("id", v.id);
    if (error) {
      toast.error("Couldn't delete video");
      return;
    }
    await supabase.storage.from("videos").remove([v.path]);
    toast("Video deleted");
    load();
  };

  return (
    <main className="flex min-h-[100dvh] justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft size={16} /> Back to feed
        </Link>

        {session ? (
          <>
            <div className="mt-5 flex items-center gap-3 rounded-2xl border border-border bg-card p-5">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <CircleUserRound size={30} />
              </div>
              <div className="min-w-0">
                <p className="truncate font-display text-lg font-semibold">{session.user.email?.split("@")[0]}</p>
                <p className="truncate text-sm text-muted-foreground">{session.user.email}</p>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-2xl border border-border bg-card p-3">
                <p className="font-display text-xl font-bold">{followers}</p>
                <p className="text-xs text-muted-foreground">Followers</p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-3">
                <p className="font-display text-xl font-bold">{following}</p>
                <p className="text-xs text-muted-foreground">Following</p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-3">
                <p className="font-display text-xl font-bold">{videos.length}</p>
                <p className="text-xs text-muted-foreground">Videos</p>
              </div>
            </div>

            <div className="mt-3 flex gap-2">
              <Link to="/saved" className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm hover:bg-muted">
                <Bookmark size={16} /> Saved videos
              </Link>
              <button
                onClick={async () => {
                  await supabase.auth.signOut();
                  navigate({ to: "/" });
                }}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm hover:bg-muted"
              >
                <LogOut size={16} /> Sign out
              </button>
            </div>

            <h2 className="mt-6 font-display text-sm font-semibold text-muted-foreground">Your uploads</h2>
            <div className="mt-2 flex flex-col gap-2">
              {videos.length === 0 && (
                <p className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
                  No uploads yet. Tap + Upload on the feed to add your first video.
                </p>
              )}
              {videos.map((v) => (
                <div key={v.id} className="flex items-center gap-2 rounded-2xl border border-border bg-card p-3">
                  {editing === v.id ? (
                    <>
                      <input
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        maxLength={120}
                        autoFocus
                        className="min-w-0 flex-1 rounded-lg border border-border bg-muted px-3 py-1.5 text-sm outline-none"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") rename(v);
                          if (e.key === "Escape") setEditing(null);
                        }}
                      />
                      <button onClick={() => rename(v)} aria-label="Save name" className="text-primary"><Check size={18} /></button>
                      <button onClick={() => setEditing(null)} aria-label="Cancel" className="text-muted-foreground"><X size={18} /></button>
                    </>
                  ) : (
                    <>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{v.title}</p>
                        <p className="text-xs text-muted-foreground">{new Date(v.created_at).toLocaleDateString()}</p>
                      </div>
                      <button
                        onClick={() => {
                          setEditing(v.id);
                          setDraft(v.title);
                        }}
                        aria-label="Edit title"
                        className="rounded-full p-2 hover:bg-muted"
                      >
                        <Pencil size={16} />
                      </button>
                      <button onClick={() => remove(v)} aria-label="Delete video" className="rounded-full p-2 text-destructive hover:bg-muted">
                        <Trash2 size={16} />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-6 text-center">
            <p className="text-sm text-muted-foreground">Sign in to see your profile, followers and uploads.</p>
            <Link to="/auth" className={pill}>Sign in</Link>
          </div>
        )}
      </div>
    </main>
  );
}
