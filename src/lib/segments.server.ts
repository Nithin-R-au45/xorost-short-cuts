import { createOpenAI } from "@ai-sdk/openai";
import { Output, streamText } from "ai";
import { z } from "zod";

const SegmentSchema = z.object({
  title: z.string().describe("Catchy title, max 8 words"),
  summary: z.string().describe("1-2 sentence summary of what happens in this minute"),
});

export async function summarizeSegment(opts: {
  videoTitle: string;
  idx: number;
  frames: string[];
  prevTitle?: string;
}) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("AI is not configured");
  let runId: string | undefined;
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: async (input, init) => {
      const headers = new Headers(init?.headers);
      if (runId) headers.set("X-Lovable-AIG-Run-ID", runId);
      const res = await fetch(input, { ...init, headers });
      runId ??= res.headers.get("X-Lovable-AIG-Run-ID") ?? undefined;
      return res;
    },
  });
  const result = streamText({
    model: provider.responses("openai/gpt-6-astra"),
    system:
      "You write concise titles and summaries for one-minute parts of a longer video, based on still frames sampled from that minute. Be specific about what is visible. Don't mention 'frames' or 'images'.",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Video: "${opts.videoTitle}". This is part ${opts.idx + 1} (minute ${opts.idx}–${opts.idx + 1}).${opts.prevTitle ? ` Previous part was titled "${opts.prevTitle}".` : ""}`,
          },
          ...opts.frames.map((f) => ({ type: "image" as const, image: f })),
        ],
      },
    ],
    output: Output.object({ schema: SegmentSchema }),
    providerOptions: {
      openai: {
        store: false,
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        include: ["reasoning.encrypted_content"],
      },
    },
  });
  return await result.output;
}
