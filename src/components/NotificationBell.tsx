import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Notif = { id: string; actor_name: string; kind: string; read: boolean; created_at: string };

export function NotificationBell({ uid }: { uid: string }) {
  const [items, setItems] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const seen = useRef<Set<string> | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from("notifications")
      .select("id,actor_name,kind,read,created_at")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(30);
    const list = data ?? [];
    if (seen.current) {
      list.filter((n) => !seen.current!.has(n.id) && !n.read).forEach((n) => toast(`${n.actor_name} started following you`));
    }
    seen.current = new Set(list.map((n) => n.id));
    setItems(list);
  };

  useEffect(() => {
    load();
    const t = window.setInterval(load, 15000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);

  const unread = items.filter((n) => !n.read).length;

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && unread) {
      setItems((l) => l.map((n) => ({ ...n, read: true })));
      await supabase.from("notifications").update({ read: true }).eq("user_id", uid).eq("read", false);
    }
  };

  return (
    <div ref={box} className="relative" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
      <button onClick={toggle} aria-label="Notifications" className="relative flex h-9 w-9 items-center justify-center rounded-full bg-background/70 text-foreground">
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-11 w-64 rounded-xl border border-border bg-card p-1.5 shadow-lg">
          <p className="px-3 py-1.5 text-xs text-muted-foreground">Notifications</p>
          {items.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">Nothing yet.</p>
          ) : (
            items.map((n) => (
              <p key={n.id} className="rounded-lg px-3 py-2 text-sm">
                <span className="font-semibold">{n.actor_name}</span> started following you
                <span className="block text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString()}</span>
              </p>
            ))
          )}
        </div>
      )}
    </div>
  );
}
