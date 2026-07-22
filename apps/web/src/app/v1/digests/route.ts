import { NextResponse, type NextRequest } from "next/server";
import { apiHandler, principal } from "@/lib/http";

export const GET = apiHandler(async (request: NextRequest) => {
  const { userId, db } = await principal(request);
  const { data, error } = await db.from("digests").select("*,digest_entries(*,captures(id,kind,original_url,captured_at,content_revisions(item_analyses(title,summary)))),digest_relations(*)").eq("user_id", userId).order("period_end", { ascending: false }).limit(52);
  if (error) throw error;
  return NextResponse.json({ digests: data });
});

