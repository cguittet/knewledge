import { NextResponse, type NextRequest } from "next/server";
import { CreateImageCaptureRequest } from "@knewledge/contracts";
import { apiHandler, ApiError, parseJson, principal } from "@/lib/http";
import { queueCapture } from "@/lib/jobs";

type Context = { params: Promise<{ id: string }> };

export const POST = apiHandler(async (request: NextRequest, context: Context) => {
  const { userId, db } = await principal(request);
  const { id } = await context.params;
  const body = await parseJson(request, CreateImageCaptureRequest);
  const { data: capture } = await db.from("captures").select("id,status").eq("id", id).eq("user_id", userId).is("deleted_at", null).maybeSingle();
  if (!capture) throw new ApiError(404, "Capture not found", "not_found");
  if (body.assets.some((asset) => !asset.objectKey.startsWith(`${userId}/`))) throw new ApiError(403, "An asset does not belong to this account", "invalid_asset_owner");
  const { data: existing } = await db.from("assets").select("ordinal").eq("capture_id", id).order("ordinal", { ascending: false }).limit(1);
  const nextOrdinal = Number(existing?.[0]?.ordinal ?? -1) + 1;
  if (nextOrdinal + body.assets.length > 20) throw new ApiError(422, "A capture can contain at most 20 images", "too_many_assets");
  const { error } = await db.from("assets").insert(body.assets.map((asset, index) => ({ user_id: userId, capture_id: id, object_key: asset.objectKey, ordinal: nextOrdinal + index, mime_type: asset.mimeType, size_bytes: asset.sizeBytes })));
  if (error) throw error;
  await db.from("captures").update({ status: "queued", failure_category: null, failure_detail: null }).eq("id", id).eq("user_id", userId);
  await queueCapture(id, userId);
  return NextResponse.json({ captureId: id, status: "queued" }, { status: 202 });
});
