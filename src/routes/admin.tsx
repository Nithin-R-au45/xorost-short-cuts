import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Check, X, Trash2, Ban, Play } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { fetchVideos, type Vid } from "@/lib/videos";
import { Player } from "@/components/Player";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Xorost" },
      { name: "description", content: "Review, approve and moderate Xorost uploads and users." },
      { property: "og:title", content: "Admin — Xorost" },
      { property: "og:description", content: "Moderate Xorost posts and users." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

type Row = { id: string; title: string; path: string; thumb_path: string | null; user_id: string; status: string; created_at: string; thumb?: string };
type User = { id: string; name: string; created_at: string; blocked?: string };
type Tab = "posts" | "review" | "users";

function AdminPage() {
  const session = useSession();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>("review");
  const [rows, setRows] = useState<Row[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [playing, setPlaying] = useState<Vid[] | null>(null);

  useEffect(() => {
    if (session === undefined) return;
    if (!session) return setIsAdmin(false);
    supabase.rpc("has_role", { _user_id: session.user.id, _role: "admin" }).then(({ data }) => setIsAdmin(!!data));
  }, [session]);

  const load = useCallback(async () => {
    const [{ data: v }, { data: p }, { data: b }] = await Promise.all([
      supabase.from("videos").select("id,title,path,thumb_path,user_id,status,created_at").order("created_at", { ascending: false }),
      supabase.from("profiles").select("id,name,created_at").order("created_at", { ascending: false }),
      supabase.from("upload_blocks").select("user_id,reason"),
    ]);
    const vids = (v ?? []) as Row[];
    const thumbs = vids.filter((x) => x.thumb_path).map((x) => x.thumb_path!);
    if (thumbs.length) {
      const { data: s } = await supabase.storage.from("videos").createSignedUrls(thumbs, 3600);
      const m = new Map(s?.map((x) => [x.path, x.signedUrl]));
      vids.forEach((x) => (x.thumb = x.thumb_path ? m.get(x.thumb_path) ?? undefined : undefined));
    }
    setRows(vids);
    const bm = new Map((b ?? []).map((x) => [x.user_id, x.reason]));
    setUsers((p ?? []).map((u) => ({ ...u, blocked: bm.get(u.id) })));
  }, []);

  useEffect(() => { if (isAdmin) load(); }, [isAdmin, load]);

  const names = new Map(users.map((u) => [u.id, u.name]));

  const setStatus = async (r: Row, status: "approved" | "rejected") => {
    const { error } = await supabase.from("videos").update({ status }).eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success(status === "approved" ? "Approved" : "Rejected");
    load();
  };
  const remove = async (r: Row) => {
    if (!confirm(`Delete "${r.title}" for everyone?`)) return;
    const { error } = await supabase.from("videos").delete().eq("id", r.id);
    if (error) return toast.error(error.message);
    await supabase.storage.from("videos").remove(r.thumb_path ? [r.path, r.thumb_path] : [r.path]);
    toast.success("Deleted");
    load();
  };
  const block = async (u: User, reason: string) => {
    const { error } = await supabase.from("upload_blocks").upsert({ user_id: u.id, reason });
    if (error) return toast.error(error.message);
    toast.success(`${u.name} can no longer upload`);
    load();
  };
  const unblock = async (u: User) => {
    const { error } = await supabase.from("upload_blocks").delete().eq("user_id", u.id);
    if (error) return toast.error(error.message);
    toast.success(`${u.name} can upload again`);
    load();
  };
  const play = async (r: Row) => {
    const v = await fetchVideos([r.id]);
    if (v.length) setPlaying(v);
  };

  if (isAdmin === null) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (!isAdmin) return (
    <div className="p-6 text-sm">
      <p className="mb-3">Admins only.</p>
      <Link to="/" className="text-primary">Back home</Link>
    </div>
  );

  const list = tab === "review" ? rows.filter((r) => r.status === "pending") : rows;
  const pending = rows.filter((r) => r.status === "pending").length;

  return (
    <div className="mx-auto min-h-screen max-w-2xl bg-background p-4 text-foreground">
      <div className="mb-4 flex items-center gap-3">
        <Link to="/profile" aria-label="Back"><ArrowLeft size={20} /></Link>
        <h1 className="text-lg font-semibold">Admin</h1>
      </div>
      <div className="mb-4 flex gap-2 text-sm">
        {(["posts", "review", "users"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`rounded-full px-3 py-1.5 capitalize ${tab === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
            {t === "posts" ? `Posts (${rows.length})` : t === "review" ? `Review (${pending})` : `Users (${users.length})`}
          </button>
        ))}
      </div>

      {tab !== "users" && (
        <div className="space-y-2">
          {!list.length && <p className="text-sm text-muted-foreground">{tab === "review" ? "Nothing waiting for review." : "No posts yet."}</p>}
          {list.map((r) => (
            <div key={r.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-2">
              <button onClick={() => play(r)} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                {r.thumb && <img src={r.thumb} alt="" className="h-full w-full object-cover" />}
                <Play size={16} className="absolute inset-0 m-auto text-foreground" />
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{r.title}</p>
                <p className="text-xs text-muted-foreground">
                  {names.get(r.user_id) ?? "user"} · {new Date(r.created_at).toLocaleDateString()} ·{" "}
                  <span className={r.status === "approved" ? "text-primary" : r.status === "rejected" ? "text-destructive" : ""}>{r.status}</span>
                </p>
              </div>
              {r.status !== "approved" && (
                <button onClick={() => setStatus(r, "approved")} aria-label="Approve" className="rounded-full bg-muted p-2"><Check size={16} /></button>
              )}
              {r.status !== "rejected" && (
                <button onClick={() => setStatus(r, "rejected")} aria-label="Reject" className="rounded-full bg-muted p-2"><X size={16} /></button>
              )}
              <button onClick={() => remove(r)} aria-label="Delete" className="rounded-full bg-muted p-2 text-destructive"><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
      )}

      {tab === "users" && (
        <div className="space-y-2">
          {users.map((u) => (
            <div key={u.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{u.name}</p>
                <p className="text-xs text-muted-foreground">
                  {rows.filter((r) => r.user_id === u.id).length} posts
                  {u.blocked && <span className="text-destructive"> · uploads blocked ({u.blocked})</span>}
                </p>
              </div>
              {u.id === session?.user.id ? (
                <span className="text-xs text-muted-foreground">You</span>
              ) : u.blocked ? (
                <button onClick={() => unblock(u)} className="rounded-full bg-muted px-3 py-1.5 text-xs">Unblock</button>
              ) : (
                <select defaultValue="" onChange={(e) => e.target.value && block(u, e.target.value)}
                  className="rounded-full border border-border bg-muted px-2 py-1.5 text-xs">
                  <option value="" disabled>Block uploads…</option>
                  <option value="copyright">Copyright</option>
                  <option value="adult content">Adult content</option>
                </select>
              )}
              {u.blocked && <Ban size={14} className="text-destructive" />}
            </div>
          ))}
        </div>
      )}

      {playing && (
        <div className="fixed inset-0 z-50 bg-background">
          <button onClick={() => setPlaying(null)} aria-label="Close" className="absolute right-3 top-3 z-50 rounded-full bg-card p-2"><X size={18} /></button>
          <Player videos={playing} />
        </div>
      )}
    </div>
  );
}
