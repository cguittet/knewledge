import { NextResponse, type NextRequest } from "next/server";
import { UpdateCaptureRequest } from "@knewledge/contracts";
import { apiHandler, ApiError, parseJson, principal } from "@/lib/http";

type Context = { params: Promise<{ id: string }> };

export const GET = apiHandler(async (request: NextRequest, context: Context) => {
  const { userId, db } = await principal(request);
  const { id } = await context.params;
  const { data, error } = await db.from("captures").select("*,assets(*),content_revisions(*,item_analyses(*),item_topics(*,topics(*)),content_chunks(id,ordinal,content)),digest_relations!digest_relations_current_capture_id_fkey(*)").eq("id", id).eq("user_id", userId).is("deleted_at", null).maybeSingle();
  if (error) throw error;
  if (!data) throw new ApiError(404, "Capture not found", "not_found");
  return NextResponse.json({ capture: data });
});

export const PATCH = apiHandler(async (request: NextRequest, context: Context) => {
  const { userId, db } = await principal(request);
  const { id } = await context.params;
  const body = await parseJson(request, UpdateCaptureRequest);
  const { data, error } = await db.from("captures").update({ ...body, updated_at: new Date().toISOString() }).eq("id", id).eq("user_id", userId).is("deleted_at", null).select("id,note,archived,updated_at").maybeSingle();
  if (error) throw error;
  if (!data) throw new ApiError(404, "Capture not found", "not_found");
  return NextResponse.json({ capture: data });
});

export const DELETE = apiHandler(async (request: NextRequest, context: Context) => {
  const { db, auth } = await principal(request);
  if (auth !== "session") throw new ApiError(403, "Deletion requires an interactive session", "forbidden");
  const { id } = await context.params;
  const { error } = await db.rpc("soft_delete_capture", { target_capture_id: id });
  if (error) throw error;
  return new NextResponse(null, { status: 204 });
});

