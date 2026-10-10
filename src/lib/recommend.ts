/**
 * "For You" ranking adapted from X's open-source For You algorithm
 * (github.com/xai-org/x-algorithm), scaled down to run in the browser:
 *  1. Candidate sources — in-network (creators you engaged with), out-of-network
 *     (topic similarity to your interest profile), and popular videos.
 *  2. Hydration — engagement history, creator affinity, popularity, topics.
 *  3. Filters — your own disliked videos, fully watched videos sink.
 *  4. Scoring — predict per-action probabilities, blend with weights.
 *  5. Author diversity — repeated creators are attenuated.
 * Also borrows from justin-theodorus/for-you (user embedding = centroid of engaged
 * videos, cosine similarity) and ChitviJoshi/Post_Recommendation_System
 * (interest + popularity + a ~1-in-7 discovery slot for new topics).
 */
import { supabase } from "@/integrations/supabase/client";
import { fetchVideos, type Vid } from "@/lib/videos";

// Weights scale *predicted probabilities* of the viewer's own actions (like X's param.rs).
const W = { like: 1.0, save: 1.5, comment: 1.2, share: 0.8, watch: 2.0, dislike: -4.0 };
const AUTHOR_DECAY = 0.6; // each extra video by the same creator keeps 60% of its score
const STOP = new Set("the a an and or of to in on for with is are was this that it at by from as be part video minute".split(" "));

const tokens = (t: string) =>
  t.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w));
const textOf = (v: Vid) => [v.title, ...(v.segments ?? []).flatMap((s) => [s.title, s.summary])].join(" ");
const sig = (x: number) => 1 / (1 + Math.exp(-x));

export async function forYou(userId?: string): Promise<Vid[]> {
  const [videos, { data: pop }, { data: reacts }, { data: comments }] = await Promise.all([
    fetchVideos(),
    supabase.rpc("video_popularity"),
    supabase.from("reactions").select("user_id,video_key,value"),
    supabase.from("comments").select("user_id,video_key"),
  ]);
  if (!videos.length) return [];

  const [{ data: views }, { data: saves }] = userId
    ? await Promise.all([
        supabase.from("video_views").select("video_id,seconds,max_part").eq("user_id", userId),
        supabase.from("saves").select("video_key").eq("user_id", userId),
      ])
    : [{ data: [] }, { data: [] }];

  const byKey = new Map(videos.map((v) => [v.key, v]));
  const popMap = new Map((pop ?? []).map((p) => [p.video_id, p]));
  const viewMap = new Map((views ?? []).map((w) => [w.video_id, w]));
  const savedKeys = new Set((saves ?? []).map((s) => s.video_key));
  const myReact = new Map<string, number>();
  const likeCount = new Map<string, number>();
  const dislikeCount = new Map<string, number>();
  for (const r of reacts ?? []) {
    if (r.user_id === userId) myReact.set(r.video_key, r.value);
    const m = r.value > 0 ? likeCount : dislikeCount;
    m.set(r.video_key, (m.get(r.video_key) ?? 0) + 1);
  }
  const commentCount = new Map<string, number>();
  const myComments = new Set<string>();
  for (const c of comments ?? []) {
    commentCount.set(c.video_key, (commentCount.get(c.video_key) ?? 0) + 1);
    if (c.user_id === userId) myComments.add(c.video_key);
  }

  // Engagement history → per-video signal strength (positive or negative)
  const signal = (v: Vid) => {
    const w = viewMap.get(v.id!);
    const parts = Math.max(1, v.segments?.length ?? 1);
    let s = 0;
    if (w) s += Math.min(1, (w.max_part + 1) / parts) * 1.5;
    if (myReact.get(v.key) === 1) s += 2;
    if (myReact.get(v.key) === -1) s -= 3;
    if (savedKeys.has(v.key)) s += 2.5;
    if (myComments.has(v.key)) s += 1.5;
    return s;
  };

  // Interest profile (topic weights) + creator affinity
  const interest = new Map<string, number>();
  const affinity = new Map<string, number>();
  for (const v of videos) {
    const s = signal(v);
    if (!s) continue;
    for (const t of new Set(tokens(textOf(v)))) interest.set(t, (interest.get(t) ?? 0) + s);
    if (v.userId && v.userId !== userId) affinity.set(v.userId, (affinity.get(v.userId) ?? 0) + s);
  }
  // Semantic user embedding: signal-weighted centroid of engaged videos
  let centroid: number[] | null = null;
  for (const v of videos) {
    const s = signal(v);
    if (!s || !v.embedding?.length || v.userId === userId) continue;
    centroid ??= new Array(v.embedding.length).fill(0);
    v.embedding.forEach((x, i) => (centroid![i] = (centroid![i] ?? 0) + x * s));
  }
  const cos = (a: number[], b: number[]) => {
    let d = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) { d += a[i]! * (b[i] ?? 0); na += a[i]! ** 2; nb += (b[i] ?? 0) ** 2; }
    return na && nb ? d / Math.sqrt(na * nb) : 0;
  };
  const norm = Math.sqrt([...interest.values()].reduce((a, b) => a + b * b, 0)) || 1;
  const hasHistory = interest.size > 0;

  const scored = videos
    .filter((v) => myReact.get(v.key) !== -1) // filters
    .map((v) => {
      const toks = new Set(tokens(textOf(v)));
      let sim = 0;
      for (const t of toks) sim += interest.get(t) ?? 0;
      sim = sim / norm / Math.sqrt(toks.size || 1);
      const semantic = centroid && v.embedding?.length ? Math.max(0, cos(centroid, v.embedding)) : null;
      if (semantic !== null) sim = 0.7 * semantic + 0.3 * sim;
      const aff = affinity.get(v.userId ?? "") ?? 0;
      const p = popMap.get(v.id!);
      const likes = likeCount.get(v.key) ?? 0;
      const dislikes = dislikeCount.get(v.key) ?? 0;
      const popularity = Math.log1p(Number(p?.viewers ?? 0) + likes * 2 + Number(p?.saves ?? 0) * 3 + (commentCount.get(v.key) ?? 0) * 2);
      const ageDays = v.createdAt ? (Date.now() - new Date(v.createdAt).getTime()) / 864e5 : 30;
      const fresh = Math.exp(-ageDays / 14);
      const quality = (likes + 1) / (likes + dislikes + 2);
      const seen = viewMap.get(v.id!);
      const finished = seen && seen.max_part + 1 >= Math.max(1, v.segments?.length ?? 1);

      const base = 2.5 * sim + 0.6 * Math.tanh(aff / 3) + 0.4 * popularity + 0.8 * fresh + (quality - 0.5) - (finished ? 3 : 0) - 2;
      const pred = {
        like: sig(base),
        save: sig(base - 0.8),
        comment: sig(base - 1.2),
        share: sig(base - 1.5),
        watch: sig(base + 0.5),
        dislike: sig(-base - 2 + (1 - quality) * 2),
      };
      const score = (Object.keys(W) as (keyof typeof W)[]).reduce((a, k) => a + W[k] * pred[k], 0);
      const reason =
        aff > 1 ? "From a creator you enjoy" : sim > 0.15 ? "Matches your interests" : hasHistory && popularity > 1 ? "Popular on Xorost" : fresh > 0.7 ? "New on Xorost" : "Popular on Xorost";
      return { v: { ...v, reason }, score, sim, quality };
    })
    .sort((a, b) => b.score - a.score);

  // Author diversity
  const seenAuthors = new Map<string, number>();
  const out = scored
    .map((s) => {
      const n = seenAuthors.get(s.v.userId ?? "") ?? 0;
      seenAuthors.set(s.v.userId ?? "", n + 1);
      return { ...s, score: s.score * Math.pow(AUTHOR_DECAY, n) };
    })
    .sort((a, b) => b.score - a.score);
  void byKey;
  if (!hasHistory) return out.map((s) => s.v);

  // Discovery: every 7th slot goes to a well-liked video outside your usual topics
  const discovery = out.filter((s) => s.sim < 0.1 && s.quality >= 0.5);
  const used = new Set<string>();
  const final: Vid[] = [];
  const main = out.filter((s) => !discovery.slice(0, Math.floor(out.length / 7)).includes(s));
  let di = 0;
  for (const s of main) {
    if (final.length % 7 === 6 && di < discovery.length) {
      const d = discovery[di++]!;
      final.push({ ...d.v, reason: "Something new to explore" });
      used.add(d.v.key);
    }
    if (!used.has(s.v.key)) final.push(s.v), used.add(s.v.key);
  }
  for (const d of discovery) if (!used.has(d.v.key)) final.push(d.v);
  return final;
}

export async function recordView(userId: string, videoId: string, part: number, seconds: number) {
  const { data } = await supabase.from("video_views").select("seconds,max_part").eq("user_id", userId).eq("video_id", videoId).maybeSingle();
  await supabase.from("video_views").upsert({
    user_id: userId,
    video_id: videoId,
    seconds: (data?.seconds ?? 0) + Math.round(seconds),
    max_part: Math.max(data?.max_part ?? 0, part),
    updated_at: new Date().toISOString(),
  });
}
