import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const generateSegment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        videoId: z.string().uuid(),
        idx: z.number().int().min(0).max(1000),
        prevTitle: z.string().max(200).optional(),
        frames: z.array(z.string().startsWith("data:image/").max(400_000)).min(1).max(4),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: v } = await context.supabase
      .from("videos")
      .select("id,title,user_id")
      .eq("id", data.videoId)
      .maybeSingle();
    if (!v || v.user_id !== context.userId) throw new Error("Not your video");
    const { summarizeSegment } = await import("./segments.server");
    const out = await summarizeSegment({ videoTitle: v.title, idx: data.idx, frames: data.frames, prevTitle: data.prevTitle });
    const row = { video_id: v.id, idx: data.idx, title: out.title.slice(0, 120), summary: out.summary.slice(0, 600) };
    const { error } = await context.supabase.from("video_segments").upsert(row);
    if (error) throw new Error(error.message);
    return row;
  });

export const embedVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ videoId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: v } = await context.supabase
      .from("videos")
      .select("id,title,user_id,video_segments(idx,title,summary)")
      .eq("id", data.videoId)
      .maybeSingle();
    if (!v || v.user_id !== context.userId) throw new Error("Not your video");
    const text = [v.title, ...(v.video_segments ?? []).map((s) => `${s.title}. ${s.summary}`)].join("\n").slice(0, 8000);
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("AI is not configured");
    const res = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({ model: "google/gemini-embedding-2", input: text, dimensions: 256 }),
    });
    if (!res.ok) throw new Error(`Embedding failed [${res.status}]: ${await res.text()}`);
    const json = (await res.json()) as { data: { embedding: number[] }[] };
    const embedding = json.data[0]!.embedding;
    const { error } = await context.supabase.from("videos").update({ embedding }).eq("id", v.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
