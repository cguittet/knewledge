import { NextResponse, type NextRequest } from "next/server";
import { DigestSettings } from "@knewledge/contracts";
import { apiHandler, parseJson, principal } from "@/lib/http";

export const GET = apiHandler(async (request: NextRequest) => {
  const { userId, db } = await principal(request);
  const { data, error } = await db.from("digest_settings").select("timezone,weekday,local_time,enabled,user_profiles(preferred_language)").eq("user_id", userId).single();
  if (error) throw error;
  return NextResponse.json({ settings: data });
});

export const PATCH = apiHandler(async (request: NextRequest) => {
  const { userId, db } = await principal(request);
  const body = await parseJson(request, DigestSettings);
  const [{ error }, { error: profileError }] = await Promise.all([
    db.from("digest_settings").update({ timezone: body.timezone, weekday: body.weekday, local_time: body.localTime, enabled: body.enabled }).eq("user_id", userId),
    db.from("user_profiles").update({ preferred_language: body.preferredLanguage }).eq("user_id", userId),
  ]);
  if (error) throw error;
  if (profileError) throw profileError;
  return NextResponse.json({ settings: body });
});

