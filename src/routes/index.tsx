import { NotificationBell } from "@/components/NotificationBell";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { pill, useSession } from "@/lib/session";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Player } from "@/components/Player";
import { ProfileMenu } from "@/components/ProfileMenu";
import { extractFrames, extractThumb, type Vid } from "@/lib/videos";
import { forYou } from "@/lib/recommend";
import { embedVideo, generateSegment } from "@/lib/segments.functions";
import { Button } from "@/components/ui/button";
import { UploadDialog } from "@/components/UploadDialog";
import { Upload } from "lucide-react";
import { readVideoDuration, uploadDetailsSchema, type UploadDetails } from "@/lib/upload";
import { registerVideo } from "@/lib/upload.functions";

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
  const [uploadOpen, setUploadOpen] = useState(false);

  const uid = session?.user.id;
  const reload = () => forYou(uid).then(setVideos);
  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  const onUpload = async (f: File, details: UploadDetails): Promise<boolean> => {
    if (!session) {
      toast("Sign in to upload videos");
      return false;
    }
    let uploadedPath: string | null = null;
    let registered = false;
    try {
      const validated = uploadDetailsSchema.parse({ ...details, size: f.size, duration: await readVideoDuration(f) });
      setBusy("Uploading…");
      const path = `${session.user.id}/${crypto.randomUUID()}-${f.name.replace(/[^\w.-]/g, "_").slice(-180)}`;
      const ext = f.name.split(".").pop()?.toLowerCase();
      const contentType = f.type || (ext === "mov" ? "video/quicktime" : ext === "webm" ? "video/webm" : "video/mp4");
      const up = await supabase.storage.from("videos").upload(path, f, { contentType });
      if (up.error) throw up.error;
      uploadedPath = path;
      const v = await registerVideo({ data: { ...validated, path } });
      registered = true;
      setBusy("Reading video…");
      let frames: string[][] = [];
      try { frames = await extractFrames(f); } catch { toast("Video saved. AI descriptions couldn't be generated."); }
      try {
        let thumb: Blob;
        try { thumb = await extractThumb(f); }
        catch {
          const first = frames[0]?.[0];
          if (!first) throw new Error("no frame");
          thumb = await (await fetch(first)).blob();
        }
        const thumbPath = path.replace(/\.[^.]+$/, "") + "-thumb.jpg";
        const tu = await supabase.storage.from("videos").upload(thumbPath, thumb, { contentType: "image/jpeg", upsert: true });
        if (tu.error) throw tu.error;
        const ur = await supabase.from("videos").update({ thumb_path: thumbPath }).eq("id", v.id);
        if (ur.error) throw ur.error;
      } catch (e) {
        console.error("thumbnail failed", e);
      }
      await reload();
      let prevTitle: string | undefined;
      for (let i = 0; i < frames.length; i++) {
        setBusy(`AI writing part ${i + 1} of ${frames.length}…`);
        try {
          const partFrames = frames[i];
          if (!partFrames) continue;
          const seg = await generateSegment({ data: { videoId: v.id, idx: i, frames: partFrames, prevTitle } });
          prevTitle = seg.title;
        } catch (e) {
          toast.error(`AI couldn't describe part ${i + 1}: ${(e as Error).message}`);
          break;
        }
      }
      await embedVideo({ data: { videoId: v.id } }).catch(() => {});
      await reload();
      toast.success("Video ready");
      return true;
    } catch (e) {
      if (uploadedPath && !registered) await supabase.storage.from("videos").remove([uploadedPath]);
      toast.error((e as Error).message || "Upload failed");
      return false;
    } finally {
      setBusy(null);
    }
  };

  const header = (
    <>
      {busy && <span className="rounded-full bg-background/70 px-3 py-1.5 text-xs">{busy}</span>}
      <Button
        size="sm"
        className="touch-manipulation rounded-md"
        disabled={!!busy}
        onClick={(e) => { e.stopPropagation(); setUploadOpen(true); }}
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onMouseUp={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
      >
        <Upload /> Upload
      </Button>
      {session ? (
        <>
          <NotificationBell uid={session.user.id} />
          <ProfileMenu session={session} />
        </>
      ) : (
        <Link to="/auth" onClick={(e) => e.stopPropagation()} className={pill}>Sign in</Link>
      )}
    </>
  );

  return (
    <>
    <Player
      videos={videos}
      session={session}
      headerRight={header}
      empty={
        <>
          <div className="flex flex-wrap items-center justify-center gap-2">{header}</div>
          <p className="font-display text-base font-semibold">No videos yet</p>
        </>
      }
    />
    <UploadDialog open={uploadOpen} onOpenChange={setUploadOpen} signedIn={!!session} busy={busy} onUpload={onUpload} />
    </>
  );
}
