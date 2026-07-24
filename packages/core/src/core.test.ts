import { describe, expect, it } from "vitest";
import { canonicalYoutubeUrl, chunkText, digestWindow, firstRelation, isPrivateIp, keepStrongRelations, normalizeUrl, parsePastedUrls, youtubeVideoId } from "./index.js";

describe("Supabase relations", () => {
  it("normalizes one-to-one object and array response shapes", () => {
    expect(firstRelation({ id: "object" })).toEqual({ id: "object" });
    expect(firstRelation([{ id: "array" }])).toEqual({ id: "array" });
    expect(firstRelation([])).toBeUndefined();
  });
});

describe("normalizeUrl", () => {
  it("removes tracking and fragments", () => {
    expect(normalizeUrl("HTTPS://Example.com:443/story?utm_source=x&b=2&a=1#part")).toBe("https://example.com/story?a=1&b=2");
  });
});

describe("URL safety", () => {
  it.each(["127.0.0.1", "10.0.0.2", "169.254.1.2", "192.168.1.1", "::1", "fd00::1"])("blocks %s", (ip) => {
    expect(isPrivateIp(ip)).toBe(true);
  });
  it("allows a public address", () => expect(isPrivateIp("8.8.8.8")).toBe(false));
});

describe("YouTube URLs", () => {
  it.each([
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10",
    "https://youtu.be/dQw4w9WgXcQ",
    "https://youtube.com/shorts/dQw4w9WgXcQ",
    "https://m.youtube.com/live/dQw4w9WgXcQ",
  ])("extracts a video id from %s", (url) => expect(youtubeVideoId(url)).toBe("dQw4w9WgXcQ"));
  it("rejects non-video and malformed URLs", () => expect(youtubeVideoId("https://youtube.com/feed/subscriptions")).toBeNull());
  it("creates one stable canonical URL", () => expect(canonicalYoutubeUrl("https://youtu.be/dQw4w9WgXcQ?t=4")).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ"));
});

describe("pasted URLs", () => {
  it("extracts comma- and space-separated links as separate items", () => {
    expect(parsePastedUrls("https://example.com/one, https://example.com/two https://youtu.be/dQw4w9WgXcQ")).toEqual([
      "https://example.com/one",
      "https://example.com/two",
      "https://youtu.be/dQw4w9WgXcQ",
    ]);
  });

  it("extracts links from Chrome-style numbered text", () => {
    expect(parsePastedUrls("1. https://example.com/one 2. https://example.com/two. 3. https://example.com/three")).toEqual([
      "https://example.com/one",
      "https://example.com/two",
      "https://example.com/three",
    ]);
  });

  it("keeps duplicates as distinct save occurrences", () => {
    expect(parsePastedUrls("https://example.com https://example.com")).toEqual([
      "https://example.com",
      "https://example.com",
    ]);
  });

  it("caps bulk imports at the requested limit", () => {
    expect(parsePastedUrls("https://example.com/one https://example.com/two", 1)).toEqual(["https://example.com/one"]);
  });
});

describe("chunking", () => {
  it("keeps overlap and stable indexes", () => {
    const chunks = chunkText("a ".repeat(3000), 1000, 100);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.map((chunk) => chunk.index)).toEqual(chunks.map((_, index) => index));
  });
});

describe("digest", () => {
  it("uses the previous period end and handles timezone conversion", () => {
    const last = new Date("2026-07-05T22:00:00Z");
    const window = digestWindow({ timezone: "America/New_York", weekday: 0, localTime: "18:00", preferredLanguage: "en", enabled: true }, new Date("2026-07-12T22:05:00Z"), last);
    expect(window.periodStart).toEqual(last);
    expect(window.periodEnd.toISOString()).toBe("2026-07-12T22:00:00.000Z");
  });

  it("keeps three strong relations per current item", () => {
    const relations = [0.99, 0.95, 0.9, 0.85, 0.7].map((confidence, index) => ({ confidence, currentCaptureId: "a", index }));
    expect(keepStrongRelations(relations).map((entry) => entry.index)).toEqual([0, 1, 2]);
  });
});
