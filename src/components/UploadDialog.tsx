import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { FileVideo, Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { readVideoDuration, uploadDetailsSchema, type UploadDetails } from "@/lib/upload";

export function UploadDialog({ open, onOpenChange, signedIn, busy, onUpload }: {
  open: boolean; onOpenChange: (open: boolean) => void; signedIn: boolean; busy: string | null;
  onUpload: (file: File, details: UploadDetails) => Promise<boolean>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const selection = useRef(0);
  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState(0);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const disabled = !!busy || checking;
  const choose = async (next?: File) => {
    if (!next) return;
    const version = ++selection.current;
    setFile(null); setDuration(0); setError(""); setChecking(true);
    try {
      const seconds = await readVideoDuration(next);
      if (version !== selection.current) return;
      setFile(next); setDuration(seconds);
      setTitle((value) => value || next.name.replace(/\.[^.]+$/, "").slice(0, 200));
    } catch (e) {
      if (version === selection.current) setError(e instanceof Error ? e.message : "Couldn't read video");
    } finally { if (version === selection.current) setChecking(false); }
  };
  return (
    <Dialog open={open} onOpenChange={(value) => { if (!disabled) onOpenChange(value); }}>
      <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-lg p-5 [&>button]:disabled:opacity-40">
        <DialogTitle className="text-base tracking-normal">Upload video</DialogTitle>
        <DialogDescription className="text-xs">Up to 20 minutes · 100MB maximum</DialogDescription>
        {!signedIn ? (
          <Button asChild><Link to="/auth">Sign in to upload</Link></Button>
        ) : (
          <form className="space-y-4" onSubmit={async (e) => {
            e.preventDefault();
            if (!file || disabled) return;
            const result = uploadDetailsSchema.safeParse({ title, description, duration, size: file.size });
            if (!result.success) { setError(result.error.issues[0]?.message ?? "Check your video details"); return; }
            setError("");
            if (await onUpload(file, result.data)) {
              setFile(null); setTitle(""); setDescription(""); setDuration(0); onOpenChange(false);
            }
          }}>
            <input ref={input} type="file" accept="video/*,.mov,.mp4,.m4v,.webm,.3gp" className="sr-only" aria-label="Choose video file" disabled={disabled} onChange={(e) => { choose(e.target.files?.[0]); e.target.value = ""; }} />
            <Button type="button" variant="outline" disabled={disabled} onClick={() => input.current?.click()} className="h-28 w-full flex-col gap-2 whitespace-normal border-dashed border-border bg-muted/20 text-foreground hover:bg-muted/40">
              {checking ? <Loader2 className="animate-spin" /> : <FileVideo />}
              <span className="max-w-full truncate text-sm">{checking ? "Checking video…" : file ? file.name : "Choose video"}</span>
              {file && <span className="text-xs text-muted-foreground">{Math.floor(duration / 60)}:{String(Math.floor(duration % 60)).padStart(2, "0")} · {(file.size / 1024 / 1024).toFixed(1)}MB</span>}
            </Button>
            <div className="space-y-1.5">
              <label htmlFor="upload-title" className="text-xs font-semibold">Title</label>
              <input id="upload-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required disabled={disabled} placeholder="Add a title" className="w-full rounded-md border border-border bg-background px-3 py-2 text-base outline-none focus:border-primary sm:text-sm" />
              <p className="text-right text-xs text-muted-foreground">{title.length}/200</p>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="upload-description" className="text-xs font-semibold">Description <span className="font-normal text-muted-foreground">(optional)</span></label>
              <textarea id="upload-description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} disabled={disabled} placeholder="Add a description" rows={3} className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-base outline-none focus:border-primary sm:text-sm" />
              <p className="text-right text-xs text-muted-foreground">{description.length}/2000</p>
            </div>
            {error && <p role="alert" className="text-xs text-accent">{error}</p>}
            {busy && <p role="status" aria-live="polite" className="text-xs text-muted-foreground">{busy}</p>}
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1 border-border" disabled={disabled} onClick={() => onOpenChange(false)}><X /> Cancel</Button>
              <Button type="submit" className="flex-1" disabled={!file || !title.trim() || disabled}>{busy ? <Loader2 className="animate-spin" /> : <Upload />} {busy ? "Uploading…" : "Post video"}</Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}