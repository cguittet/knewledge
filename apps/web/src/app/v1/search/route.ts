import { NextResponse, type NextRequest } from "next/server";
import OpenAI from "openai";
import { apiHandler, ApiError, principal } from "@/lib/http";
import { serverEnv } from "@/lib/env";

export const GET = apiHandler(async (request: NextRequest) => {
  const { db } = await principal(request);
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim();
  if (!query) throw new ApiError(422, "Search query is required", "missing_query");
  const env = serverEnv();
  const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const embedding = await openai.embeddings.create({ model: env.OPENAI_EMBEDDING_MODEL, input: query, encoding_format: "float" });
  const vector = embedding.data[0]?.embedding;
  if (!vector) throw new Error("Embedding response was empty");
  const { data, error } = await db.rpc("hybrid_search", {
    search_query: query,
    query_embedding: vector,
    result_limit: Math.min(Number(url.searchParams.get("limit") ?? 20), 100),
    source_filter: url.searchParams.get("kind") || null,
    status_filter: url.searchParams.get("status") || null,
    captured_after: url.searchParams.get("after") || null,
    captured_before: url.searchParams.get("before") || null,
  });
  if (error) throw error;
  return NextResponse.json({ results: data, query });
});

