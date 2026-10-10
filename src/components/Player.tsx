import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { SocialBar } from "@/components/SocialBar";
import { SEG, type Vid } from "@/lib/videos";
import { recordView } from "@/lib/recommend";

export function Player({ videos, session, headerRight, empty }: { videos: Vid[]; session: Session | null; headerRight: ReactNode; empty: ReactNode }) {
  const [vi, setVi] = useState(0);
  const [part, setPart] = useState(0);
  const [duration, setDuration] = useState(0);
  const [progress, setProgress] = useState(0);
  const [ended, setEnded] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const ref = useRef<HTMLVideoElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const lock = useRef(0);

  useEffect(() => {
    if (!localStorage.getItem("xorost_seen_controls")) setShowHint(true);
  }, []);

  const dismissHint = () => {
    if (!showHint) return;
    setShowHint(false);
    localStorage.setItem("xorost_seen_controls", "1");
  };

  const parts = Math.max(1, Math.ceil(duration / SEG));
  const video = videos[vi];

  const nextPart = (d: number) => {
    const n = part + d;
    if (n < 0) return;
    if (n >= parts) {
      // past the last part — roll into the next video, TikTok-style
      nextVideo(1);
      return;
    }
    setPart(n);
  };
  const nextVideo = (d: number) => {
    if (!videos.length) return;
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

  useEffect(() => {
    const uid = session?.user.id;
    if (uid && video?.id) recordView(uid, video.id, part, 0).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video?.id, part, session?.user.id]);

  const onTime = () => {
    const el = ref.current!;
    const start = part * SEG;
    const end = Math.min(start + SEG, duration || Infinity);
    setProgress(Math.min(1, (el.currentTime - start) / (end - start)));
    if (el.currentTime >= end - 0.05) {
      if (!ended && session && video?.id) recordView(session.user.id, video.id, part, end - start).catch(() => {});
      if (part + 1 >= parts) {
        // last part finished — keep the feed going
        nextVideo(1);
        return;
      }
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

  useEffect(() => {
    setVi(0);
    setPart(0);
    setDuration(0);
  }, [videos.length]);

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
        {video ? (
        <>
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
              Xoro<span className="text-foreground">st</span>
            </h1>
            <div className="pointer-events-auto flex items-center gap-2">
              {headerRight}
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
          {video.reason && <p className="mb-1 text-xs text-muted-foreground">✦ {video.reason}</p>}
          <p className="font-display text-sm uppercase tracking-widest text-primary">
            Part {part + 1} of {duration ? parts : "…"}
          </p>
          <h2 className="font-display text-3xl font-bold">{video.title}</h2>
          {video.segments?.[part] && (
            <div className="mt-1 max-w-[80%]">
              <p className="font-semibold">{video.segments[part].title}</p>
              <p className="text-sm text-muted-foreground">{video.segments[part].summary}</p>
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            {fmt(part * SEG)} – {fmt(Math.min((part + 1) * SEG, duration))}
          </p>
        </div>

        <SocialBar videoKey={video.key} title={video.title} session={session} authorId={video.userId} />

        {showHint && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 bg-overlay text-center">
            <p className="font-display text-xl font-semibold">How Xorost works</p>
            <p className="text-sm text-muted-foreground">Swipe or drag ← for the next part · ↑ for a new video</p>
            <p className="text-xs text-muted-foreground">Tap anywhere to start</p>
          </div>
        )}

        {ended && !showHint && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 bg-overlay text-center">
            <p className="animate-hint font-display text-5xl">←</p>
            <p className="font-display text-xl font-semibold">Swipe left for Part {part + 2}</p>
          </div>
        )}
        </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">{empty}</div>
        )}
      </div>
    </main>
  );
}
