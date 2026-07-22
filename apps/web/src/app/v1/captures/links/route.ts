import { NextResponse, type NextRequest } from "next/server";
import { CreateLinkCapturesRequest } from "@knewledge/contracts";
import { canonicalYoutubeUrl, isYoutubeUrl, normalizeUrl } from "@knewledge/core";
import { apiHandler, ApiError, enforceCaptureQuota, parseJson, principal } from "@/lib/http";
import { queueCapture } from "@/lib/jobs";

export const POST = apiHandler(async (request: NextRequest) => {
  const { userId, db } = await principal(request);
  const body = await parseJson(request, CreateLinkCapturesRequest);
  await enforceCaptureQuota(userId, db, body.links.length);
  const capturedAt = body.capturedAt ?? new Date().toISOString();
  const rows = body.links.map((link) => {
    try {
      const youtube = isYoutubeUrl(link.url);
      return { user_id: userId, kind: youtube ? "youtube" : "link", original_url: link.url, normalized_url: youtube ? canonicalYoutubeUrl(link.url) : normalizeUrl(link.url), note: link.note ?? null, captured_at: capturedAt, status: "queued" };
    } catch (error) {
      throw new ApiError(422, error instanceof Error ? error.message : "Invalid URL", "invalid_url");
    }
  });
  const { data, error } = await db.from("captures").insert(rows).select("id,status,original_url,captured_at");
  if (error || !data) throw error ?? new Error("Captures were not created");
  await Promise.all(data.map((capture) => queueCapture(capture.id as string, userId)));
  return NextResponse.json({ captures: data }, { status: 202 });
});
