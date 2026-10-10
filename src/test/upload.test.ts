import { describe, expect, it } from "vitest";
import { MAX_VIDEO_BYTES, MAX_VIDEO_SECONDS, uploadDetailsSchema } from "@/lib/upload";

const valid = { title: "My video", description: "Creator description", duration: 60, size: 1024 };
describe("upload details", () => {
  it("accepts exact size and duration limits", () => {
    expect(uploadDetailsSchema.safeParse({ ...valid, duration: MAX_VIDEO_SECONDS, size: MAX_VIDEO_BYTES }).success).toBe(true);
  });
  it("rejects videos over either limit", () => {
    expect(uploadDetailsSchema.safeParse({ ...valid, duration: MAX_VIDEO_SECONDS + 0.1 }).success).toBe(false);
    expect(uploadDetailsSchema.safeParse({ ...valid, size: MAX_VIDEO_BYTES + 1 }).success).toBe(false);
  });
  it("validates and trims creator text", () => {
    expect(uploadDetailsSchema.parse({ ...valid, title: "  My title  " }).title).toBe("My title");
    expect(uploadDetailsSchema.safeParse({ ...valid, title: " " }).success).toBe(false);
    expect(uploadDetailsSchema.safeParse({ ...valid, title: "x".repeat(201) }).success).toBe(false);
    expect(uploadDetailsSchema.safeParse({ ...valid, description: "x".repeat(2001) }).success).toBe(false);
  });
  it("rejects unreadable or empty videos", () => {
    for (const duration of [0, -1, Infinity, NaN]) expect(uploadDetailsSchema.safeParse({ ...valid, duration }).success).toBe(false);
    expect(uploadDetailsSchema.safeParse({ ...valid, size: 0 }).success).toBe(false);
  });
});