import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler, ApiError, parseJson } from "@/lib/http";
import { createServiceClient } from "@/lib/supabase/service";

const Body = z.object({ code: z.string().length(10).transform((value) => value.toUpperCase()) });

export const POST = apiHandler(async (request: Request) => {
  const { code } = await parseJson(request, Body);
  const db = createServiceClient();
  const codeHash = createHash("sha256").update(code).digest("hex");
  const { data } = await db.from("extension_pairings").select("id,user_id,expires_at,used_at").eq("code_hash", codeHash).is("used_at", null).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (!data) throw new ApiError(401, "Pairing code is invalid or expired", "invalid_pairing_code");
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60_000).toISOString();
  const { error } = await db.from("extension_pairings").update({ token_hash: tokenHash, used_at: new Date().toISOString(), expires_at: expiresAt }).eq("id", data.id);
  if (error) throw error;
  return NextResponse.json({ token, expiresAt });
});
