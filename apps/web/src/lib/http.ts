import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createUserClient } from "./supabase/server";
import { createServiceClient } from "./supabase/service";

export class ApiError extends Error {
  constructor(public status: number, message: string, public code = "request_failed") {
    super(message);
  }
}

export async function principal(request?: NextRequest) {
  const userClient = await createUserClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (user) return { userId: user.id, db: userClient, auth: "session" as const };

  const token = request?.headers.get("x-extension-token");
  if (token) {
    const service = createServiceClient();
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const { data } = await service.from("extension_pairings").select("user_id").eq("token_hash", tokenHash).not("used_at", "is", null).gt("expires_at", new Date().toISOString()).maybeSingle();
    if (data?.user_id) return { userId: data.user_id as string, db: service, auth: "extension" as const };
  }
  throw new ApiError(401, "Authentication required", "unauthorized");
}

export async function parseJson<T>(request: Request, schema: { parse(value: unknown): T }): Promise<T> {
  let body: unknown;
  try { body = await request.json(); } catch { throw new ApiError(400, "Request body must be valid JSON", "invalid_json"); }
  return schema.parse(body);
}

export function apiHandler<T extends unknown[]>(handler: (...args: T) => Promise<Response>) {
  return async (...args: T) => {
    try {
      return await handler(...args);
    } catch (error) {
      if (error instanceof ApiError) return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
      if (error && typeof error === "object" && "issues" in error) return NextResponse.json({ error: "validation_failed", message: "Invalid request", details: (error as { issues: unknown }).issues }, { status: 422 });
      console.error(error);
      return NextResponse.json({ error: "internal_error", message: "Something went wrong" }, { status: 500 });
    }
  };
}

export async function enforceCaptureQuota(userId: string, db: ReturnType<typeof createServiceClient>, additionalCaptures = 1) {
  const monthStart = new Date();
  monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
  const [{ count }, { data: profile }] = await Promise.all([
    db.from("captures").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("captured_at", monthStart.toISOString()).is("deleted_at", null),
    db.from("user_profiles").select("monthly_capture_limit").eq("user_id", userId).single(),
  ]);
  if ((count ?? 0) + additionalCaptures > Number(profile?.monthly_capture_limit ?? 500)) throw new ApiError(429, "This import would exceed the monthly capture limit", "quota_exceeded");
}
