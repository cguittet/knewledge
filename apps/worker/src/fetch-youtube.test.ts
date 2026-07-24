import { describe, expect, it, vi } from "vitest";
import { YoutubeTranscriptNotAvailableError } from "youtube-transcript";
import { fetchSupadataTranscript, fetchYoutubeContent } from "./fetch-youtube.js";

const longSegment = "A sufficiently long auto-generated caption segment that contains useful spoken content for a reliable summary and transcript.";

describe("YouTube transcript fallback", () => {
  it("uses the fallback when direct caption retrieval produces a false negative", async () => {
    const fetchFn = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.startsWith("https://api.supadata.ai/v1/transcript?")) {
        return Response.json({ content: [{ text: longSegment.repeat(2), offset: 0, duration: 5_000, lang: "en" }], lang: "en", availableLangs: ["en"] });
      }
      if (url.startsWith("https://www.youtube.com/oembed")) {
        return Response.json({ title: "Example video", author_name: "Example creator" });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const result = await fetchYoutubeContent("https://youtu.be/dQw4w9WgXcQ", {
      supadataApiKey: "test-key",
      directFetcher: async () => { throw new YoutubeTranscriptNotAvailableError("dQw4w9WgXcQ"); },
      fetchFn: fetchFn as typeof fetch,
      sleep: async () => undefined,
    });

    expect(result.extractionMethod).toBe("youtube_transcript_fallback");
    expect(result.language).toBe("en");
    expect(result.text).toContain("[0:00]");
  });

  it("polls asynchronous generated-transcript jobs", async () => {
    let polls = 0;
    const fetchFn = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("/v1/transcript?")) return Response.json({ jobId: "job_123" }, { status: 202 });
      polls += 1;
      return Response.json(polls === 1
        ? { status: "active" }
        : { status: "completed", content: [{ text: longSegment, offset: 0, lang: "en" }], lang: "en" });
    });

    const result = await fetchSupadataTranscript("https://youtu.be/dQw4w9WgXcQ", "test-key", {
      fetchFn: fetchFn as typeof fetch,
      sleep: async () => undefined,
      maxFallbackWaitMs: 1_000,
    });

    expect(polls).toBe(2);
    expect(result.language).toBe("en");
  });

  it("does not claim that captions do not exist when direct retrieval fails", async () => {
    await expect(fetchYoutubeContent("https://youtu.be/dQw4w9WgXcQ", {
      directFetcher: async () => { throw new YoutubeTranscriptNotAvailableError("dQw4w9WgXcQ"); },
      sleep: async () => undefined,
    })).rejects.toMatchObject({
      category: "captions_unavailable",
      message: expect.stringContaining("could not be retrieved"),
    });
  });
});
