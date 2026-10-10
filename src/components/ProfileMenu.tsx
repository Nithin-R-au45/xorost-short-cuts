import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { CircleUserRound, Bookmark, LogOut, ShieldCheck } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export function ProfileMenu({ session }: { session: Session }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const [admin, setAdmin] = useState(false);
  useEffect(() => {
    supabase.rpc("has_role", { _user_id: session.user.id, _role: "admin" }).then(({ data }) => setAdmin(!!data));
  }, [session.user.id]);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);

  const item =
    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted";

  return (
    <div ref={box} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Profile"
        title={session.user.email ?? undefined}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground"
      >
        <CircleUserRound size={20} />
      </button>
      {open && (
        <div className="absolute right-0 top-11 w-48 rounded-xl border border-border bg-card p-1.5 shadow-lg">
          <p className="truncate px-3 py-1.5 text-xs text-muted-foreground">{session.user.email}</p>
          <Link to="/profile" className={item} onClick={() => setOpen(false)}>
            <CircleUserRound size={16} /> Profile
          </Link>
          <Link to="/saved" className={item} onClick={() => setOpen(false)}>
            <Bookmark size={16} /> Saved
          </Link>
          {admin && (
            <Link to="/admin" className={item} onClick={() => setOpen(false)}>
              <ShieldCheck size={16} /> Admin
            </Link>
          )}
          <button
            className={item}
            onClick={async () => {
              setOpen(false);
              await supabase.auth.signOut();
              navigate({ to: "/" });
            }}
          >
            <LogOut size={16} /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
