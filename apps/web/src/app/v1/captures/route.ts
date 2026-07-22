import { NextResponse, type NextRequest } from "next/server";
import { apiHandler, principal } from "@/lib/http";

export const GET = apiHandler(async (request: NextRequest) => {
  const { userId, db } = await principal(request);
  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 30), 1), 100);
  let query = db.from("captures").select("id,kind,status,original_url,note,archived,captured_at,failure_category,failure_detail,content_revisions(id,title,language,item_analyses(title,summary,key_ideas,entities,confidence))").eq("user_id", userId).is("deleted_at", null).order("captured_at", { ascending: false }).limit(limit);
  const status = url.searchParams.get("status");
  const kind = url.searchParams.get("kind");
  if (status) query = query.eq("status", status);
  if (kind) query = query.eq("kind", kind);
  const { data, error } = await query;
  if (error) throw error;
  return NextResponse.json({ captures: data });
});

