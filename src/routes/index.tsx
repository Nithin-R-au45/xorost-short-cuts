import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { pill, useSession } from "@/lib/session";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Player } from "@/components/Player";
import { ProfileMenu } from "@/components/ProfileMenu";
import { extractFrames, type Vid } from "@/lib/videos";
import { forYou } from "@/lib/recommend";
import { embedVideo, generateSegment } from "@/lib/segments.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Xorost — Long videos, one minute at a time" },
      { name: "description", content: "Xorost cuts long videos into 1-minute parts. Swipe left for the next part, swipe up for a new video." },
      { property: "og:title", content: "Xorost — Long videos, one minute at a time" },
      { property: "og:description", content: "Swipe left to continue, swipe up for something new." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const session = useSession();
  const [videos, setVideos] = useState<Vid[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const uid = session?.user.id;
  const reload = () => forYou(uid).then(setVideos);
  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  const onUpload = async (f?: File) => {
    if (!f) return;
    if (!session) {
      toast("Sign in to upload videos");
      return;
    }
    try {
      const title = f.name.replace(/\.[^.]+$/, "").slice(0, 200) || "Untitled";
      setBusy("Uploading…");
      const path = `${session.user.id}/${crypto.randomUUID()}-${f.name.replace(/[^\w.-]/g, "_")}`;
      const up = await supabase.storage.from("videos").upload(path, f, { contentType: f.type });
      if (up.error) throw up.error;
      const { data: v, error } = await supabase.from("videos").insert({ user_id: session.user.id, title, path }).select("id").single();
      if (error) throw error;
      await reload();
      setBusy("Reading video…");
      const frames = await extractFrames(f);
      let prevTitle: string | undefined;
      for (let i = 0; i < frames.length; i++) {
        setBusy(`AI writing part ${i + 1} of ${frames.length}…`);
        try {
          const seg = await generateSegment({ data: { videoId: v.id, idx: i, frames: frames[i]!, prevTitle } });
          prevTitle = seg.title;
        } catch (e) {
          toast.error(`AI couldn't describe part ${i + 1}: ${(e as Error).message}`);
          break;
        }
      }
      await embedVideo({ data: { videoId: v.id } }).catch(() => {});
      await reload();
      toast.success("Video ready");
    } catch (e) {
      toast.error((e as Error).message || "Upload failed");
    } finally {
      setBusy(null);
    }
  };

  const header = (
    <>
      {busy && <span className="rounded-full bg-background/70 px-3 py-1.5 text-xs">{busy}</span>}
      <label className="cursor-pointer rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground" onClick={(e) => e.stopPropagation()}>
        + Upload
        <input type="file" accept="video/*" className="hidden" disabled={!!busy} onChange={(e) => onUpload(e.target.files?.[0])} />
      </label>
      {session ? (
        <ProfileMenu session={session} />
      ) : (
        <Link to="/auth" onClick={(e) => e.stopPropagation()} className={pill}>Sign in</Link>
      )}
    </>
  );

  return (
    <Player
      videos={videos}
      session={session}
      headerRight={header}
      empty={
        <>
          <div className="flex flex-wrap items-center justify-center gap-2">{header}</div>
          <p className="font-display text-2xl font-semibold">No videos yet</p>
          <p className="max-w-xs text-sm text-muted-foreground">
            Upload a long video — Xorost plays it one minute at a time, with an AI title and summary for each part.
          </p>
        </>
      }
    />
  );
}
