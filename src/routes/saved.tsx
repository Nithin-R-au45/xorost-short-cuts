import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Player } from "@/components/Player";
import { fetchVideos, type Vid } from "@/lib/videos";
import { pill, useSession } from "./index";

export const Route = createFileRoute("/saved")({
  head: () => ({
    meta: [
      { title: "Saved videos — Xorost" },
      { name: "description", content: "Browse and play the videos you bookmarked on Xorost." },
      { property: "og:title", content: "Saved videos — Xorost" },
      { property: "og:description", content: "Your bookmarked Xorost videos, one minute at a time." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Saved,
});

function Saved() {
  const session = useSession();
  const [videos, setVideos] = useState<Vid[] | null>(null);
  const [pick, setPick] = useState<number | null>(null);

  useEffect(() => {
    if (!session) return;
    supabase
      .from("saves")
      .select("video_key")
      .eq("user_id", session.user.id)
      .then(async ({ data }) => {
        const ids = (data ?? []).map((s) => s.video_key).filter((k) => k.startsWith("vid:")).map((k) => k.slice(4));
        setVideos(await fetchVideos(ids));
      });
  }, [session]);

  if (pick !== null && videos) {
    const ordered = [...videos.slice(pick), ...videos.slice(0, pick)];
    return (
      <Player
        videos={ordered}
        session={session}
        headerRight={<button className={pill} onClick={(e) => { e.stopPropagation(); setPick(null); }}>← Saved</button>}
        empty={null}
      />
    );
  }

  return (
    <main className="min-h-[100dvh] bg-background p-5">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="font-display text-3xl font-bold">Saved</h1>
          <Link to="/" className={pill}>Home</Link>
        </div>
        {!session ? (
          <p className="text-muted-foreground">
            <Link to="/auth" className="text-primary underline">Sign in</Link> to see your saved videos.
          </p>
        ) : videos === null ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : !videos.length ? (
          <p className="text-muted-foreground">Nothing saved yet — tap the bookmark on any video.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {videos.map((v, i) => (
              <button key={v.key} onClick={() => setPick(i)} className="overflow-hidden rounded-xl border border-border bg-card text-left">
                <video src={v.src + "#t=1"} muted preload="metadata" className="aspect-[9/16] w-full object-cover" />
                <div className="p-2">
                  <p className="truncate font-semibold">{v.title}</p>
                  <p className="text-xs text-muted-foreground">{v.segments?.length ? `${v.segments.length} parts` : "Video"}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
