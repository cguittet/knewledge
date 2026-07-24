import {
  YoutubeTranscript,
  YoutubeTranscriptDisabledError,
  YoutubeTranscriptNotAvailableError,
  YoutubeTranscriptTooManyRequestError,
  YoutubeTranscriptVideoUnavailableError,
} from "youtube-transcript";
import { canonicalYoutubeUrl, youtubeVideoId } from "@knewledge/core";
import { z } from "zod";
import { FetchPageError } from "./fetch-page.js";

type OEmbed = { title?: string; author_name?: string; author_url?: string; thumbnail_url?: string };
type TranscriptSegment = { text: string; offset: number; duration?: number | undefined; lang?: string | undefined };

const SupadataSegment = z.object({
  text: z.string(),
  offset: z.number().nonnegative().default(0),
  duration: z.number().nonnegative().optional(),
  lang: z.string().optional(),
});
const SupadataResult = z.object({
  content: z.union([z.string(), z.array(SupadataSegment)]),
  lang: z.string().optional(),
  availableLangs: z.array(z.string()).optional(),
});
const SupadataJob = z.object({ jobId: z.string().min(1) });
const SupadataJobResult = z.object({
  status: z.enum(["queued", "active", "completed", "failed"]),
  content: z.union([z.string(), z.array(SupadataSegment)]).optional(),
  lang: z.string().optional(),
  availableLangs: z.array(z.string()).optional(),
  error: z.unknown().optional(),
});

type FetchYoutubeOptions = {
  supadataApiKey?: string | undefined;
  fetchFn?: typeof fetch;
  directFetcher?: (videoId: string) => Promise<TranscriptSegment[]>;
  sleep?: (milliseconds: number) => Promise<void>;
  maxFallbackWaitMs?: number;
};

function timestamp(offsetMs: number) {
  const total = Math.max(0, Math.floor(offsetMs / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}` : `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function renderSegments(segments: TranscriptSegment[]) {
  return segments
    .map((segment) => `[${timestamp(segment.offset)}] ${segment.text.trim()}`)
    .filter((line) => line.length > 8)
    .join("\n");
}

async function fetchWithTimeout(fetchFn: typeof fetch, input: string, init: RequestInit, timeoutMs = 20_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchFn(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function metadata(url: string, fetchFn: typeof fetch): Promise<OEmbed> {
  try {
    const response = await fetchWithTimeout(fetchFn, `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`, { headers: { accept: "application/json" } }, 10_000);
    return response.ok ? await response.json() as OEmbed : {};
  } catch {
    return {};
  }
}

function normalizeSupadataContent(value: z.infer<typeof SupadataResult>) {
  if (typeof value.content === "string") {
    return { text: value.content.trim(), segmentCount: value.content.trim() ? 1 : 0, language: value.lang ?? null };
  }
  return {
    text: renderSegments(value.content),
    segmentCount: value.content.length,
    language: value.lang ?? value.content.find((segment) => segment.lang)?.lang ?? null,
  };
}

export async function fetchSupadataTranscript(url: string, apiKey: string, options: Pick<FetchYoutubeOptions, "fetchFn" | "sleep" | "maxFallbackWaitMs"> = {}) {
  const fetchFn = options.fetchFn ?? fetch;
  const sleep = options.sleep ?? ((milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const endpoint = new URL("https://api.supadata.ai/v1/transcript");
  endpoint.searchParams.set("url", url);
  endpoint.searchParams.set("mode", "auto");
  const headers = { accept: "application/json", "x-api-key": apiKey };
  const response = await fetchWithTimeout(fetchFn, endpoint.toString(), { headers });
  const body: unknown = await response.json().catch(() => null);

  if (response.ok && response.status !== 202) return normalizeSupadataContent(SupadataResult.parse(body));
  if (response.status !== 202) throw new Error(`Transcript fallback returned HTTP ${response.status}`);

  const { jobId } = SupadataJob.parse(body);
  const deadline = Date.now() + (options.maxFallbackWaitMs ?? 8 * 60_000);
  while (Date.now() < deadline) {
    await sleep(3_000);
    const poll = await fetchWithTimeout(fetchFn, `https://api.supadata.ai/v1/transcript/${encodeURIComponent(jobId)}`, { headers });
    const job = SupadataJobResult.parse(await poll.json());
    if (job.status === "failed") throw new Error("Transcript fallback could not process this video");
    if (job.status === "completed") {
      return normalizeSupadataContent(SupadataResult.parse({ content: job.content, lang: job.lang, availableLangs: job.availableLangs }));
    }
  }
  throw new Error("Transcript fallback timed out");
}

async function fetchDirectTranscript(videoId: string, directFetcher: (videoId: string) => Promise<TranscriptSegment[]>, sleep: (milliseconds: number) => Promise<void>) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const segments = await directFetcher(videoId);
      const text = renderSegments(segments);
      if (text.length >= 120) return { text, segmentCount: segments.length, language: segments.find((segment) => segment.lang)?.lang ?? null };
      lastError = new YoutubeTranscriptNotAvailableError(videoId);
    } catch (error) {
      lastError = error;
    }
    if (attempt < 2) await sleep(500 * (attempt + 1));
  }
  throw lastError;
}

export async function fetchYoutubeContent(rawUrl: string, options: FetchYoutubeOptions = {}) {
  const videoId = youtubeVideoId(rawUrl);
  const url = canonicalYoutubeUrl(rawUrl);
  if (!videoId || !url) throw new FetchPageError("unsupported_content", "This is not a supported YouTube video URL");

  const fetchFn = options.fetchFn ?? fetch;
  const sleep = options.sleep ?? ((milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const directFetcher = options.directFetcher ?? ((id: string) => YoutubeTranscript.fetchTranscript(id));
  let transcript: { text: string; segmentCount: number; language: string | null } | null = null;
  let extractionMethod = "youtube_captions";
  let directError: unknown;

  try {
    transcript = await fetchDirectTranscript(videoId, directFetcher, sleep);
  } catch (error) {
    directError = error;
  }

  if (!transcript && options.supadataApiKey) {
    try {
      transcript = await fetchSupadataTranscript(url, options.supadataApiKey, options);
      extractionMethod = "youtube_transcript_fallback";
    } catch (fallbackError) {
      if (directError instanceof YoutubeTranscriptTooManyRequestError) {
        throw new FetchPageError("transient", "YouTube caption retrieval was rate-limited and the transcript fallback also failed");
      }
      throw new FetchPageError("transient", fallbackError instanceof Error ? fallbackError.message : "Transcript fallback failed");
    }
  }

  if (!transcript) {
    if (directError instanceof YoutubeTranscriptTooManyRequestError) throw new FetchPageError("transient", "YouTube temporarily rate-limited caption retrieval");
    if (directError instanceof YoutubeTranscriptVideoUnavailableError) throw new FetchPageError("unsupported_content", "This YouTube video is private, deleted, age-restricted, or unavailable");
    if (directError instanceof YoutubeTranscriptDisabledError || directError instanceof YoutubeTranscriptNotAvailableError) {
      throw new FetchPageError("captions_unavailable", "YouTube captions could not be retrieved. Configure the transcript fallback or attach screenshots to this item.");
    }
    throw new FetchPageError("transient", directError instanceof Error ? directError.message : "YouTube caption retrieval failed");
  }

  if (transcript.text.length < 120) throw new FetchPageError("captions_unavailable", "The retrieved transcript is too short to summarize reliably");
  const details = await metadata(url, fetchFn);
  return {
    videoId,
    url,
    text: transcript.text,
    title: details.title ?? `YouTube video ${videoId}`,
    author: details.author_name ?? null,
    publication: "YouTube",
    thumbnailUrl: details.thumbnail_url ?? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    authorUrl: details.author_url ?? null,
    segmentCount: transcript.segmentCount,
    language: transcript.language,
    extractionMethod,
  };
}
