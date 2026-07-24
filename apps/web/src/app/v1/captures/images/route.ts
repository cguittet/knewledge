import { NextResponse, type NextRequest } from "next/server";
import { CreateImageCaptureRequest } from "@knewledge/contracts";
import { apiHandler, ApiError, enforceCaptureQuota, parseJson, principal } from "@/lib/http";
import { queueCapture } from "@/lib/jobs";

export const POST = apiHandler(async (request: NextRequest) => {
  const { userId, db } = await principal(request);
  const body = await parseJson(request, CreateImageCaptureRequest);
  await enforceCaptureQuota(userId, db);
  if (body.assets.some((asset) => !asset.objectKey.startsWith(`${userId}/`))) throw new ApiError(403, "An asset does not belong to this account", "invalid_asset_owner");

  const { data: capture, error } = await db.from("captures").insert({
    user_id: userId, kind: "image", note: body.note ?? null,
    captured_at: body.capturedAt ?? new Date().toISOString(), status: "queued",
  }).select("id,status,captured_at").single();
  if (error || !capture) throw error ?? new Error("Capture was not created");

  const { error: assetError } = await db.from("assets").insert(body.assets.map((asset, ordinal) => ({
    user_id: userId, capture_id: capture.id, object_key: asset.objectKey,
    ordinal, original_name: asset.fileName, mime_type: asset.mimeType, size_bytes: asset.sizeBytes,
  })));
  if (assetError) {
    await db.from("captures").delete().eq("id", capture.id).eq("user_id", userId);
    throw assetError;
  }
  await queueCapture(capture.id as string, userId);
  return NextResponse.json({ capture }, { status: 202 });
});
