import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { SocialBar } from "@/components/SocialBar";

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

type Vid = { title: string; src: string };
const BASE = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/";
const DEFAULTS: Vid[] = [
  { title: "Big Buck Bunny", src: BASE + "BigBuckBunny.mp4" },
  { title: "Elephants Dream", src: BASE + "ElephantsDream.mp4" },
  { title: "Sintel", src: BASE + "Sintel.mp4" },
  { title: "Tears of Steel", src: BASE + "TearsOfSteel.mp4" },
];
const SEG = 60;

function Index() {
  const [videos, setVideos] = useState<Vid[]>(DEFAULTS);
  const [vi, setVi] = useState(0);
  const [part, setPart] = useState(0);
  const [duration, setDuration] = useState(0);
  const [progress, setProgress] = useState(0);
  const [ended, setEnded] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [showHint, setShowHint] = useState(false);
  const ref = useRef<HTMLVideoElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const lock = useRef(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!localStorage.getItem("xorost_seen_controls")) setShowHint(true);
  }, []);

  const dismissHint = () => {
    if (!showHint) return;
    setShowHint(false);
    localStorage.setItem("xorost_seen_controls", "1");
  };

  const parts = Math.max(1, Math.ceil(duration / SEG));
  const video = videos[vi] ?? DEFAULTS[0]!;

  const nextPart = (d: number) => {
    setPart((p) => {
      const n = p + d;
      if (n < 0 || n >= parts) return p;
      return n;
    });
  };
  const nextVideo = (d: number) => {
    setVi((v) => (v + d + videos.length) % videos.length);
    setPart(0);
    setDuration(0);
  };

  // seek to part start
  useEffect(() => {
    const el = ref.current;
    if (!el || !duration) return;
    el.currentTime = part * SEG;
    setEnded(false);
    el.play().catch(() => {});
  }, [part, duration]);

  const onTime = () => {
    const el = ref.current!;
    const start = part * SEG;
    const end = Math.min(start + SEG, duration || Infinity);
    setProgress(Math.min(1, (el.currentTime - start) / (end - start)));
    if (el.currentTime >= end - 0.05) {
      el.pause();
      setEnded(true);
    }
  };

  const swipe = (dx: number, dy: number) => {
    const now = Date.now();
    if (now - lock.current < 400) return;
    lock.current = now;
    if (Math.abs(dx) > Math.abs(dy)) nextPart(dx < 0 ? 1 : -1);
    else nextVideo(dy < 0 ? 1 : -1);
  };

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") swipe(-100, 0);
      if (e.key === "ArrowRight") swipe(100, 0);
      if (e.key === "ArrowUp") swipe(0, -100);
      if (e.key === "ArrowDown") swipe(0, 100);
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });

  const onUpload = (f?: File) => {
    if (!f) return;
    const v = { title: f.name.replace(/\.[^.]+$/, ""), src: URL.createObjectURL(f) };
    setVideos((vs) => [v, ...vs]);
    setVi(0);
    setPart(0);
    setDuration(0);
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  return (
    <main className="flex h-[100dvh] items-center justify-center bg-background">
      <div
        className="relative h-full w-full max-w-[min(100vw,56.25dvh)] overflow-hidden bg-background select-none touch-none"
        onPointerDown={dismissHint}
        onTouchStart={(e) => (touch.current = { x: e.touches[0]!.clientX, y: e.touches[0]!.clientY })}
        onTouchEnd={(e) => {
          if (!touch.current) return;
          const dx = e.changedTouches[0]!.clientX - touch.current.x;
          const dy = e.changedTouches[0]!.clientY - touch.current.y;
          touch.current = null;
          if (Math.max(Math.abs(dx), Math.abs(dy)) > 40) swipe(dx, dy);
          else ref.current && (ref.current.paused ? ref.current.play() : ref.current.pause());
        }}
        onMouseDown={(e) => (touch.current = { x: e.clientX, y: e.clientY })}
        onMouseUp={(e) => {
          if (!touch.current) return;
          const dx = e.clientX - touch.current.x;
          const dy = e.clientY - touch.current.y;
          touch.current = null;
          if (Math.max(Math.abs(dx), Math.abs(dy)) > 40) swipe(dx, dy);
          else ref.current && (ref.current.paused ? ref.current.play() : ref.current.pause());
        }}
        onMouseLeave={() => (touch.current = null)}
        onWheel={(e) => Math.max(Math.abs(e.deltaX), Math.abs(e.deltaY)) > 30 && swipe(-e.deltaX, -e.deltaY)}
      >
        <video
          key={video.src}
          ref={ref}
          src={video.src}
          className="h-full w-full object-cover"
          playsInline
          muted
          autoPlay
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
          onTimeUpdate={onTime}
        />

        {/* header */}
        <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-overlay to-transparent p-4">
          <div className="flex items-center justify-between">
            <h1 className="font-display text-2xl font-bold tracking-tight">
              Xoro<span className="text-primary">st</span>
            </h1>
            <div className="pointer-events-auto flex items-center gap-2">
              <label className="cursor-pointer rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground" onClick={(e) => e.stopPropagation()}>
                + Upload
                <input type="file" accept="video/*" className="hidden" onChange={(e) => onUpload(e.target.files?.[0])} />
              </label>
              {session ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    supabase.auth.signOut();
                  }}
                  className="rounded-full border border-border bg-background/60 px-4 py-1.5 text-sm font-semibold"
                  title={session.user.email ?? undefined}
                >
                  Sign out
                </button>
              ) : (
                <Link
                  to="/auth"
                  onClick={(e) => e.stopPropagation()}
                  className="rounded-full border border-border bg-background/60 px-4 py-1.5 text-sm font-semibold"
                >
                  Sign in
                </Link>
              )}
            </div>
          </div>
          <div className="mt-3 flex gap-1">
            {Array.from({ length: parts }).map((_, i) => (
              <div key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-primary" style={{ width: i < part ? "100%" : i === part ? `${progress * 100}%` : "0%" }} />
              </div>
            ))}
          </div>
        </div>

        {/* footer */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-overlay to-transparent p-5 pb-8">
          <p className="font-display text-sm uppercase tracking-widest text-primary">
            Part {part + 1} of {duration ? parts : "…"}
          </p>
          <h2 className="font-display text-3xl font-bold">{video.title}</h2>
          <p className="text-sm text-muted-foreground">
            {fmt(part * SEG)} – {fmt(Math.min((part + 1) * SEG, duration))}
          </p>
        </div>

        <SocialBar videoKey={video.src.startsWith("blob:") ? "local:" + video.title : video.src} title={video.title} session={session} />

        {showHint && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 bg-overlay text-center">
            <p className="font-display text-xl font-semibold">How Xorost works</p>
            <p className="text-sm text-muted-foreground">Swipe or drag ← for the next part · ↑ for a new video</p>
            <p className="text-xs text-muted-foreground">Tap anywhere to start</p>
          </div>
        )}

        {ended && !showHint && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 bg-overlay text-center">
            {part + 1 < parts ? (
              <>
                <p className="animate-hint font-display text-5xl">←</p>
                <p className="font-display text-xl font-semibold">Swipe left for Part {part + 2}</p>
              </>
            ) : (
              <>
                <p className="font-display text-5xl">↑</p>
                <p className="font-display text-xl font-semibold">The end — swipe up for a new video</p>
              </>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
