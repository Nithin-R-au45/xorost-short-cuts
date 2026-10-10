import { supabase } from "@/integrations/supabase/client";

export const SEG = 60;
export type Segment = { idx: number; title: string; summary: string };
export type Vid = { id?: string; title: string; description?: string; src: string; key: string; segments?: Segment[]; userId?: string; createdAt?: string; reason?: string; embedding?: number[] | null };

export async function fetchVideos(ids?: string[]): Promise<Vid[]> {
  let q = supabase.from("videos").select("id,title,description,path,user_id,created_at,embedding,video_segments(idx,title,summary)").order("created_at", { ascending: false }).limit(200);
  if (!ids) q = q.eq("status", "approved");
  if (ids) {
    if (!ids.length) return [];
    q = q.in("id", ids);
  }
  const { data } = await q;
  if (!data?.length) return [];
  const { data: signed } = await supabase.storage.from("videos").createSignedUrls(data.map((d) => d.path), 60 * 60 * 6);
  return data.map((d, i) => ({
    id: d.id,
    title: d.title,
    description: d.description,
    src: signed?.[i]?.signedUrl ?? "",
    key: "vid:" + d.id,
    userId: d.user_id,
    createdAt: d.created_at,
    embedding: d.embedding,
    segments: (d.video_segments ?? []).sort((a, b) => a.idx - b.idx),
  }));
}

/** Grab a few small JPEG frames from each minute of a video file. */
export async function extractFrames(file: File, onProgress?: (p: number) => void): Promise<string[][]> {
  const url = URL.createObjectURL(file);
  const v = document.createElement("video");
  v.muted = true;
  v.playsInline = true;
  v.setAttribute("playsinline", "");
  v.preload = "auto";
  v.src = url;
  await new Promise<void>((res, rej) => {
    v.onloadedmetadata = () => res();
    v.onerror = () => rej(new Error("Can't read video"));
  });
  const parts = Math.max(1, Math.ceil(v.duration / SEG));
  const w = 384;
  const h = Math.round((w * v.videoHeight) / (v.videoWidth || 1)) || 216;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  const out: string[][] = [];
  for (let p = 0; p < parts; p++) {
    const start = p * SEG;
    const len = Math.min(SEG, v.duration - start);
    const frames: string[] = [];
    for (const f of [0.15, 0.5, 0.85]) {
      v.currentTime = start + len * f;
      await new Promise((r) => (v.onseeked = r));
      ctx.drawImage(v, 0, 0, w, h);
      frames.push(c.toDataURL("image/jpeg", 0.6));
    }
    out.push(frames);
    onProgress?.((p + 1) / parts);
  }
  URL.revokeObjectURL(url);
  return out;
}

/** Capture one JPEG frame near the start of a video file, as a Blob for upload. */
export async function extractThumb(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const v = document.createElement("video");
    v.muted = true;
    v.playsInline = true;
    v.setAttribute("playsinline", "");
    v.preload = "auto";
    v.src = url;
    const timeout = (ms: number) => new Promise<never>((_, rej) => setTimeout(() => rej(new Error("Thumbnail timed out")), ms));
    await Promise.race([new Promise<void>((res, rej) => {
      v.onloadeddata = () => res();
      v.onerror = () => rej(new Error("Can't read video"));
    }), timeout(8000)]);
    const seeked = new Promise((r) => (v.onseeked = r));
    v.currentTime = Math.min(1, v.duration * 0.1 || 0.1);
    await Promise.race([seeked, timeout(8000)]);
    const w = 480;
    const h = Math.round((w * v.videoHeight) / (v.videoWidth || 1)) || 270;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    c.getContext("2d")!.drawImage(v, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.75));
    if (!blob) throw new Error("Couldn't capture thumbnail");
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}
