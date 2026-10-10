import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { Session } from "@supabase/supabase-js";
import { Heart, ThumbsDown, Share2, MessageCircle, Bookmark, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Comment = { id: string; author: string; body: string; created_at: string; user_id: string };

export function SocialBar({ videoKey, title, session }: { videoKey: string; title: string; session: Session | null }) {
  const nav = useNavigate();
  const uid = session?.user.id;
  const [likes, setLikes] = useState(0);
  const [dislikes, setDislikes] = useState(0);
  const [mine, setMine] = useState(0);
  const [saved, setSaved] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");

  const load = async () => {
    const { data: r } = await supabase.from("reactions").select("user_id,value").eq("video_key", videoKey);
    setLikes(r?.filter((x) => x.value === 1).length ?? 0);
    setDislikes(r?.filter((x) => x.value === -1).length ?? 0);
    setMine(r?.find((x) => x.user_id === uid)?.value ?? 0);
    const { data: c } = await supabase.from("comments").select("*").eq("video_key", videoKey).order("created_at", { ascending: false }).limit(100);
    setComments(c ?? []);
    if (uid) {
      const { data: s } = await supabase.from("saves").select("video_key").eq("video_key", videoKey).maybeSingle();
      setSaved(!!s);
    } else setSaved(false);
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoKey, uid]);

  const need = () => {
    if (uid) return false;
    toast("Sign in to do that");
    nav({ to: "/auth" });
    return true;
  };

  const react = async (v: number) => {
    if (need()) return;
    if (mine === v) await supabase.from("reactions").delete().eq("user_id", uid!).eq("video_key", videoKey);
    else await supabase.from("reactions").upsert({ user_id: uid!, video_key: videoKey, value: v });
    load();
  };
  const toggleSave = async () => {
    if (need()) return;
    if (saved) await supabase.from("saves").delete().eq("user_id", uid!).eq("video_key", videoKey);
    else await supabase.from("saves").insert({ user_id: uid!, video_key: videoKey });
    toast(saved ? "Removed from saved" : "Saved");
    load();
  };
  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title, url });
      else {
        await navigator.clipboard.writeText(url);
        toast("Link copied");
      }
    } catch {
      /* cancelled */
    }
  };
  const post = async () => {
    if (need() || !text.trim()) return;
    const author = session!.user.email?.split("@")[0] ?? "user";
    const { error } = await supabase.from("comments").insert({ user_id: uid!, author, video_key: videoKey, body: text.trim().slice(0, 500) });
    if (error) {
      toast.error("Couldn't post comment");
      return;
    }
    setText("");
    load();
  };

  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  const Btn = ({ on, active, icon, label }: { on: () => void; active?: boolean; icon: React.ReactNode; label: string | number }) => (
    <button onClick={on} className="flex flex-col items-center gap-1 text-xs font-semibold">
      <span className={`grid h-11 w-11 place-items-center rounded-full bg-background/60 ${active ? "text-primary" : ""}`}>{icon}</span>
      {label}
    </button>
  );

  return (
    <>
      <div
        className="absolute bottom-28 right-3 z-10 flex flex-col gap-4"
        onPointerDown={stop}
        onMouseDown={stop}
        onMouseUp={stop}
        onTouchStart={stop}
        onTouchEnd={stop}
      >
        <Btn on={() => react(1)} active={mine === 1} icon={<Heart className={mine === 1 ? "fill-current" : ""} />} label={likes} />
        <Btn on={() => react(-1)} active={mine === -1} icon={<ThumbsDown className={mine === -1 ? "fill-current" : ""} />} label={dislikes} />
        <Btn on={() => setOpen(true)} icon={<MessageCircle />} label={comments.length} />
        <Btn on={toggleSave} active={saved} icon={<Bookmark className={saved ? "fill-current" : ""} />} label={saved ? "Saved" : "Save"} />
        <Btn on={share} icon={<Share2 />} label="Share" />
      </div>

      {open && (
        <div
          className="absolute inset-x-0 bottom-0 z-20 flex h-[60%] flex-col rounded-t-2xl border-t border-border bg-background"
          onPointerDown={stop}
          onMouseDown={stop}
          onMouseUp={stop}
          onTouchStart={stop}
          onTouchEnd={stop}
          onWheel={stop}
        >
          <div className="flex items-center justify-between border-b border-border p-4">
            <p className="font-display font-semibold">{comments.length} comments</p>
            <button onClick={() => setOpen(false)} aria-label="Close comments"><X /></button>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto p-4 touch-auto">
            {comments.length === 0 && <p className="text-sm text-muted-foreground">No comments yet. Be the first!</p>}
            {comments.map((c) => (
              <div key={c.id} className="text-sm">
                <p className="font-semibold text-primary">@{c.author}</p>
                <p className="break-words">{c.body}</p>
              </div>
            ))}
          </div>
          <form
            className="flex gap-2 border-t border-border p-3"
            onSubmit={(e) => {
              e.preventDefault();
              post();
            }}
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onFocus={() => need()}
              maxLength={500}
              placeholder={uid ? "Add a comment…" : "Sign in to comment"}
              className="flex-1 rounded-full border border-border bg-muted px-4 py-2 text-sm outline-none"
            />
            <button type="submit" className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Post</button>
          </form>
        </div>
      )}
    </>
  );
}
