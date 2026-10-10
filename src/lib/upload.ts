import { z } from "zod";

export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
export const MAX_VIDEO_SECONDS = 20 * 60;
export const uploadDetailsSchema = z.object({
  title: z.string().trim().min(1, "Add a title").max(200, "Title must be 200 characters or fewer"),
  description: z.string().trim().max(2000, "Description must be 2,000 characters or fewer"),
  duration: z.number().finite().positive().max(MAX_VIDEO_SECONDS, "Video must be 20 minutes or shorter"),
  size: z.number().int().positive().max(MAX_VIDEO_BYTES, "Video must be 100MB or smaller"),
});
export type UploadDetails = z.infer<typeof uploadDetailsSchema>;

export async function readVideoDuration(file: File): Promise<number> {
  if (file.size > MAX_VIDEO_BYTES) throw new Error("Video must be 100MB or smaller");
  if (!file.size) throw new Error("This file is empty");
  if (!file.type.startsWith("video/") && !/\.(mp4|mov|m4v|webm|3gp)$/i.test(file.name)) {
    throw new Error("Choose a video file");
  }
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "metadata";
  video.muted = true;
  video.playsInline = true;
  try {
    return await new Promise<number>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error("Couldn't read this video. Try an MP4 video.")), 15000);
      video.onloadedmetadata = () => {
        window.clearTimeout(timer);
        const result = uploadDetailsSchema.shape.duration.safeParse(video.duration);
        if (!result.success) reject(new Error("Video must be 20 minutes or shorter"));
        else resolve(result.data);
      };
      video.onerror = () => {
        window.clearTimeout(timer);
        reject(new Error("Couldn't read this video. Try an MP4 video."));
      };
      video.src = url;
    });
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}