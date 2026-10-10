import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { uploadDetailsSchema } from "./upload";

export const registerVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => uploadDetailsSchema.extend({ path: z.string().max(300) }).parse(input))
  .handler(async ({ data, context }) => {
    const prefix = `${context.userId}/`;
    if (!data.path.startsWith(prefix) || !/^[\w.-]+$/.test(data.path.slice(prefix.length))) {
      throw new Error("Invalid upload path");
    }
    const name = data.path.slice(prefix.length);
    const { data: files, error: listError } = await context.supabase.storage.from("videos").list(context.userId, { search: name, limit: 100 });
    if (listError) throw new Error("Couldn't verify the uploaded file");
    const file = files?.find((item) => item.name === name);
    const size = Number(file?.metadata?.size);
    if (!file || size !== data.size || !uploadDetailsSchema.shape.size.safeParse(size).success) {
      throw new Error("Invalid upload or video exceeds 100MB");
    }
    const { data: video, error } = await context.supabase.from("videos").insert({
      user_id: context.userId, path: data.path, title: data.title, description: data.description,
      duration_seconds: data.duration, size_bytes: size,
    }).select("id,status").single();
    if (error) throw new Error(error.message);
    return video;
  });