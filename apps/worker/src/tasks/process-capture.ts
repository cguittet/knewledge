import { task, logger } from "@trigger.dev/sdk";
import sharp from "sharp";
import { z } from "zod";
import { db } from "../clients.js";
import { env } from "../env.js";
import { fetchReadablePage, FetchPageError } from "../fetch-page.js";
import { fetchYoutubeContent } from "../fetch-youtube.js";
import { analyzeImages, analyzePdf, analyzeText } from "../model.js";
import { persistAnalysis } from "../persist.js";

const Payload = z.object({ captureId: z.string().uuid(), userId: z.string().uuid() });

export const processCapture = task({
  id: "process-capture",
  maxDuration: 600,
  retry: { maxAttempts: 3, minTimeoutInMs: 2_000, maxTimeoutInMs: 30_000, factor: 2 },
  run: async (raw) => {
    const { captureId, userId } = Payload.parse(raw);
    const jobKey = `capture:${captureId}`;
    await db.from("job_runs").upsert({ user_id: userId, capture_id: captureId, job_type: "process_capture", idempotency_key: jobKey, status: "running", started_at: new Date().toISOString() }, { onConflict: "idempotency_key" });
    await db.from("captures").update({ status: "processing", failure_category: null, failure_detail: null }).eq("id", captureId).eq("user_id", userId);
    try {
      const { data: capture, error } = await db.from("captures").select("*,assets(*)").eq("id", captureId).eq("user_id", userId).is("deleted_at", null).single();
      if (error || !capture) throw error ?? new Error("Capture not found");
      if (capture.kind === "pdf") {
        const [asset] = capture.assets;
        if (!asset || asset.mime_type !== "application/pdf") throw new FetchPageError("unsupported_content", "The uploaded PDF is missing or invalid");
        const { data: blob, error: downloadError } = await db.storage.from("captures").download(asset.object_key);
        if (downloadError) throw downloadError;
        const source = Buffer.from(await blob.arrayBuffer());
        if (source.byteLength > 25 * 1024 * 1024 || source.subarray(0, 5).toString("ascii") !== "%PDF-") {
          throw new FetchPageError("unsupported_content", "The uploaded file is not a valid PDF under 25 MB");
        }
        const filename = asset.original_name || "document.pdf";
        const analysis = await analyzePdf(source, filename);
        await persistAnalysis({ userId, captureId, analysis, extractionMethod: "openai_pdf", sourceMetadata: { filename, sizeBytes: source.byteLength } });
      } else if (capture.kind === "image" || capture.assets.length) {
        const images: Array<{ dataUrl: string; mimeType: string }> = [];
        for (const asset of [...capture.assets].sort((a, b) => a.ordinal - b.ordinal)) {
          const { data: blob, error: downloadError } = await db.storage.from("captures").download(asset.object_key);
          if (downloadError) throw downloadError;
          const source = Buffer.from(await blob.arrayBuffer());
          const normalized = await sharp(source, { failOn: "none" }).rotate().jpeg({ quality: 88, mozjpeg: true }).toBuffer();
          const normalizedKey = `${userId}/normalized/${asset.id}.jpg`;
          const { error: uploadError } = await db.storage.from("captures").upload(normalizedKey, normalized, { contentType: "image/jpeg", upsert: true });
          if (uploadError) throw uploadError;
          await db.from("assets").update({ normalized_object_key: normalizedKey }).eq("id", asset.id).eq("user_id", userId);
          images.push({ mimeType: "image/jpeg", dataUrl: `data:image/jpeg;base64,${normalized.toString("base64")}` });
        }
        const analysis = await analyzeImages(images);
        await persistAnalysis({ userId, captureId, analysis, extractionMethod: capture.kind === "link" ? "attached_images" : "vision" });
      } else if (capture.kind === "youtube") {
        const video = await fetchYoutubeContent(capture.original_url, { supadataApiKey: env.SUPADATA_API_KEY });
        const analysis = await analyzeText(video.text, video);
        analysis.extractedText = video.text;
        analysis.source.title = video.title;
        analysis.source.author = video.author;
        analysis.source.publication = "YouTube";
        await persistAnalysis({ userId, captureId, analysis, extractionMethod: video.extractionMethod, fetchedAt: new Date().toISOString(), sourceMetadata: { videoId: video.videoId, resolvedUrl: video.url, thumbnailUrl: video.thumbnailUrl, authorUrl: video.authorUrl, segmentCount: video.segmentCount, transcriptLanguage: video.language } });
      } else {
        const page = await fetchReadablePage(capture.original_url);
        const analysis = await analyzeText(page.text, page);
        analysis.extractedText = page.text;
        if (!analysis.source.title) analysis.source.title = page.title;
        if (!analysis.source.author) analysis.source.author = page.author;
        if (!analysis.source.publication) analysis.source.publication = page.publication;
        await persistAnalysis({ userId, captureId, analysis, extractionMethod: "readability", fetchedAt: new Date().toISOString(), sourceMetadata: { resolvedUrl: page.url, excerpt: page.excerpt } });
      }
      await db.from("captures").update({ status: "ready" }).eq("id", captureId).eq("user_id", userId);
      await db.from("job_runs").update({ status: "succeeded", finished_at: new Date().toISOString() }).eq("idempotency_key", jobKey);
      return { captureId, status: "ready" };
    } catch (error) {
      const known = error instanceof FetchPageError;
      const category = known ? error.category : "unknown";
      const detail = error instanceof Error ? error.message : "Processing failed";
      logger.error("Capture processing failed", { captureId, category, detail });
      await db.from("captures").update({ status: known ? "needs_attention" : "failed", failure_category: category, failure_detail: detail }).eq("id", captureId).eq("user_id", userId);
      await db.from("job_runs").update({ status: "failed", error_category: category, error_detail: detail, finished_at: new Date().toISOString() }).eq("idempotency_key", jobKey);
      if (!known) throw error;
      return { captureId, status: "needs_attention", category };
    }
  },
});
