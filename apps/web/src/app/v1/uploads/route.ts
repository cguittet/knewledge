import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { CreateUploadRequest } from "@knewledge/contracts";
import { apiHandler, parseJson, principal } from "@/lib/http";

function safeName(name: string) {
  return name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-120);
}

export const POST = apiHandler(async (request: NextRequest) => {
  const { userId, db } = await principal(request);
  const body = await parseJson(request, CreateUploadRequest);
  const uploads = await Promise.all(body.files.map(async (file) => {
    const objectKey = `${userId}/${randomUUID()}-${safeName(file.fileName)}`;
    const { data, error } = await db.storage.from("captures").createSignedUploadUrl(objectKey);
    if (error) throw error;
    return { objectKey, token: data.token, signedUrl: data.signedUrl, mimeType: file.mimeType, sizeBytes: file.sizeBytes };
  }));
  return NextResponse.json({ uploads }, { status: 201 });
});

