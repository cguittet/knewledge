import { NextResponse, type NextRequest } from "next/server";
import { apiHandler, principal } from "@/lib/http";

export const GET = apiHandler(async (request: NextRequest) => {
  const { userId, db } = await principal(request);
  const { data, error } = await db.from("topics").select("id,name,created_at,item_topics(count)").eq("user_id", userId).order("name");
  if (error) throw error;
  return NextResponse.json({ topics: data });
});

