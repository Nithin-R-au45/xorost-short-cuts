import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CircleUserRound, Bookmark, LogOut, ArrowLeft, Pencil, Trash2, Check, X, Play, MessageCircle } from "lucide-react";
import { Player } from "@/components/Player";
import { fetchVideos, type Vid } from "@/lib/videos";
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

type MyVideo = { id: string; title: string; path: string; thumb_path: string | null; created_at: string };

function ProfilePage() {
  const session = useSession();
  const navigate = useNavigate();
  const uid = session?.user.id;
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);
  const [views, setViews] = useState(0);
  const [followerList, setFollowerList] = useState<string[]>([]);
  const [followingList, setFollowingList] = useState<string[]>([]);
  const [showList, setShowList] = useState<"followers" | "following" | null>(null);
  const [videos, setVideos] = useState<MyVideo[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [playing, setPlaying] = useState<Vid[] | null>(null);

  const load = async () => {
    if (!uid) return;
    const [{ data: fr }, { data: fg }, { data: v }] = await Promise.all([
      supabase.from("follows").select("follower_id").eq("followee_id", uid),
      supabase.from("follows").select("followee_id").eq("follower_id", uid),
      supabase.from("videos").select("id,title,path,thumb_path,created_at").eq("user_id", uid).order("created_at", { ascending: false }),
    ]);
    const ids = [...(fr ?? []).map((x) => x.follower_id), ...(fg ?? []).map((x) => x.followee_id)];
    const { data: profs } = ids.length
      ? await supabase.from("profiles").select("id,name").in("id", ids)
      : { data: [] as { id: string; name: string }[] };
    const nm = (id: string) => profs?.find((p) => p.id === id)?.name ?? "user";
    setFollowerList((fr ?? []).map((x) => nm(x.follower_id)));
    setFollowingList((fg ?? []).map((x) => nm(x.followee_id)));
    setFollowers(fr?.length ?? 0);
    setFollowing(fg?.length ?? 0);
    setVideos(v ?? []);
    if (v?.length) {
      const { data: vw } = await supabase.from("video_views").select("video_id").in("video_id", v.map((x) => x.id));
      setViews(vw?.length ?? 0);
      const { data: cm } = await supabase.from("comments").select("video_key").in("video_key", v.map((x) => `vid:${x.id}`));
      const cc: Record<string, number> = {};
      (cm ?? []).forEach((x) => {
        const id = x.video_key.slice(4);
        cc[id] = (cc[id] ?? 0) + 1;
      });
      setCommentCounts(cc);
      // Prefer the stored thumbnail image; fall back to the video file for older uploads.
      const paths = v.map((x) => x.thumb_path ?? x.path);
      const { data: signed } = await supabase.storage.from("videos").createSignedUrls(paths, 60 * 60 * 6);
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
    await supabase.storage.from("videos").remove(v.thumb_path ? [v.path, v.thumb_path] : [v.path]);
    toast("Video deleted");
    load();
  };

  const openVideo = async (v: MyVideo) => {
    const vids = await fetchVideos([v.id]);
    if (!vids.length) {
      toast.error("Couldn't open video");
      return;
    }
    setPlaying(vids);
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

            <div className="mt-3 grid grid-cols-4 gap-2 text-center">
              <button onClick={() => setShowList(showList === "followers" ? null : "followers")} className={`rounded-2xl border bg-card p-3 ${showList === "followers" ? "border-primary" : "border-border"}`}>
                <p className="font-display text-xl font-bold">{followers}</p>
                <p className="text-xs text-muted-foreground">Followers</p>
              </button>
              <button onClick={() => setShowList(showList === "following" ? null : "following")} className={`rounded-2xl border bg-card p-3 ${showList === "following" ? "border-primary" : "border-border"}`}>
                <p className="font-display text-xl font-bold">{following}</p>
                <p className="text-xs text-muted-foreground">Following</p>
              </button>
              <div className="rounded-2xl border border-border bg-card p-3">
                <p className="font-display text-xl font-bold">{views}</p>
                <p className="text-xs text-muted-foreground">Views</p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-3">
                <p className="font-display text-xl font-bold">{videos.length}</p>
                <p className="text-xs text-muted-foreground">Videos</p>
              </div>
            </div>
            {showList && (
              <div className="mt-3 rounded-2xl border border-border bg-card p-3">
                <p className="mb-2 text-sm font-semibold">{showList === "followers" ? "Followers" : "Following"}</p>
                {(showList === "followers" ? followerList : followingList).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nobody yet.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {(showList === "followers" ? followerList : followingList).map((n, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <CircleUserRound size={18} className="text-muted-foreground" /> {n}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

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
            <div className="mt-2 grid grid-cols-3 gap-0.5">
              {videos.length === 0 && (
                <p className="col-span-3 rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
                  No uploads yet. Tap + Upload on the feed to add your first video.
                </p>
              )}
              {videos.map((v) => (
                <div key={v.id} className="relative aspect-square overflow-hidden bg-muted">
                  <button onClick={() => openVideo(v)} aria-label={`Play ${v.title}`} className="block h-full w-full cursor-pointer">
                    {thumbs[v.id] && v.thumb_path ? (
                      <img src={thumbs[v.id]} alt={v.title} className="h-full w-full object-cover" />
                    ) : thumbs[v.id] ? (
                      <video
                        src={thumbs[v.id] + "#t=1"}
                        muted
                        playsInline
                        preload="metadata"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                        <CircleUserRound size={22} />
                      </div>
                    )}
                  </button>
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-overlay/25">
                    <Play size={18} className="text-foreground" />
                  </div>
                  <div className="pointer-events-none absolute bottom-1 left-1 flex items-center gap-1 rounded-full bg-overlay/60 px-1.5 py-0.5 text-[10px] font-semibold text-foreground">
                    <MessageCircle size={11} />
                    {commentCounts[v.id] ?? 0}
                  </div>
                  <div className="absolute right-1 top-1 flex gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditing(v.id);
                        setDraft(v.title);
                      }}
                      aria-label="Edit title"
                      className="rounded-full bg-overlay/60 p-1.5 hover:bg-overlay"
                    >
                      <Pencil size={13} className="text-foreground" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        remove(v);
                      }}
                      aria-label="Delete video"
                      className="rounded-full bg-overlay/60 p-1.5 text-destructive hover:bg-overlay"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                  {editing === v.id && (
                    <div
                      className="absolute inset-0 flex flex-col justify-center gap-1.5 bg-overlay p-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        maxLength={120}
                        autoFocus
                        className="w-full rounded-lg border border-border bg-muted px-2 py-1 text-xs outline-none"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") rename(v);
                          if (e.key === "Escape") setEditing(null);
                        }}
                      />
                      <div className="flex justify-end gap-2">
                        <button onClick={() => rename(v)} aria-label="Save name" className="text-primary"><Check size={16} /></button>
                        <button onClick={() => setEditing(null)} aria-label="Cancel" className="text-muted-foreground"><X size={16} /></button>
                      </div>
                    </div>
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
      {playing && (
        <div className="fixed inset-0 z-50">
          <Player
            videos={playing}
            session={session}
            headerRight={
              <button onClick={() => setPlaying(null)} aria-label="Close player" className="rounded-full p-1.5 hover:bg-muted">
                <X size={20} />
              </button>
            }
            empty={<p className="text-sm text-muted-foreground">Video unavailable.</p>}
          />
        </div>
      )}
    </main>
  );
}
