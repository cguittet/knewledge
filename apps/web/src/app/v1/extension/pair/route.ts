import { createHash, randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { apiHandler, principal } from "@/lib/http";

export const POST = apiHandler(async (request: NextRequest) => {
  const { userId, db, auth } = await principal(request);
  if (auth !== "session") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const code = randomBytes(5).toString("hex").toUpperCase();
  const codeHash = createHash("sha256").update(code).digest("hex");
  const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
  const { error } = await db.from("extension_pairings").insert({ user_id: userId, code_hash: codeHash, expires_at: expiresAt });
  if (error) throw error;
  return NextResponse.json({ code, expiresAt });
});

