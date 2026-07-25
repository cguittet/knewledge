import { NextResponse, type NextRequest } from "next/server";
import { CreateTextCaptureRequest } from "@knewledge/contracts";
import { apiHandler, enforceCaptureQuota, parseJson, principal } from "@/lib/http";
import { queueCapture } from "@/lib/jobs";

export const POST = apiHandler(async (request: NextRequest) => {
  const { userId, db } = await principal(request);
  const body = await parseJson(request, CreateTextCaptureRequest);
  await enforceCaptureQuota(userId, db);

  const { data: capture, error } = await db.from("captures").insert({
    user_id: userId,
    kind: "text",
    pasted_text: body.text,
    note: body.note ?? null,
    captured_at: body.capturedAt ?? new Date().toISOString(),
    status: "queued",
  }).select("id,status,captured_at").single();
  if (error || !capture) throw error ?? new Error("Text capture was not created");

  await queueCapture(capture.id as string, userId);
  return NextResponse.json({ capture }, { status: 202 });
});
