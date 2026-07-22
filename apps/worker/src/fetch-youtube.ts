import {
  YoutubeTranscript,
  YoutubeTranscriptDisabledError,
  YoutubeTranscriptNotAvailableError,
  YoutubeTranscriptTooManyRequestError,
  YoutubeTranscriptVideoUnavailableError,
} from "youtube-transcript";
import { canonicalYoutubeUrl, youtubeVideoId } from "@knewledge/core";
import { FetchPageError } from "./fetch-page.js";

type OEmbed = { title?: string; author_name?: string; author_url?: string; thumbnail_url?: string };

function timestamp(offsetMs: number) {
  const total = Math.max(0, Math.floor(offsetMs / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}` : `${minutes}:${String(seconds).padStart(2, "0")}`;
}

async function metadata(url: string): Promise<OEmbed> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`, { signal: controller.signal, headers: { accept: "application/json" } });
    return response.ok ? await response.json() as OEmbed : {};
  } catch { return {}; } finally { clearTimeout(timer); }
}

export async function fetchYoutubeContent(rawUrl: string) {
  const videoId = youtubeVideoId(rawUrl);
  const url = canonicalYoutubeUrl(rawUrl);
  if (!videoId || !url) throw new FetchPageError("unsupported_content", "This is not a supported YouTube video URL");
  try {
    const [segments, details] = await Promise.all([YoutubeTranscript.fetchTranscript(videoId), metadata(url)]);
    const text = segments.map((segment) => `[${timestamp(segment.offset)}] ${segment.text.trim()}`).filter((line) => line.length > 8).join("\n");
    if (text.length < 120) throw new FetchPageError("captions_unavailable", "This YouTube video does not have enough publicly available caption text to summarize");
    return {
      videoId, url, text,
      title: details.title ?? `YouTube video ${videoId}`,
      author: details.author_name ?? null,
      publication: "YouTube",
      thumbnailUrl: details.thumbnail_url ?? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      authorUrl: details.author_url ?? null,
      segmentCount: segments.length,
    };
  } catch (error) {
    if (error instanceof FetchPageError) throw error;
    if (error instanceof YoutubeTranscriptTooManyRequestError) throw new FetchPageError("transient", "YouTube temporarily rate-limited caption retrieval");
    if (error instanceof YoutubeTranscriptDisabledError || error instanceof YoutubeTranscriptNotAvailableError) throw new FetchPageError("captions_unavailable", "This video has no publicly available captions");
    if (error instanceof YoutubeTranscriptVideoUnavailableError) throw new FetchPageError("unsupported_content", "This YouTube video is private, deleted, age-restricted, or unavailable");
    throw new FetchPageError("transient", error instanceof Error ? error.message : "YouTube caption retrieval failed");
  }
}
