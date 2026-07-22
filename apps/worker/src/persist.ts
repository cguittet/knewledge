import { chunkText, firstRelation } from "@knewledge/core";
import type { ItemAnalysis } from "@knewledge/contracts";
import { db, openai } from "./clients.js";
import { env } from "./env.js";
import { contentHash, normalizeTopic } from "./utils.js";

export async function persistAnalysis(input: { userId: string; captureId: string; analysis: ItemAnalysis; extractionMethod: string; fetchedAt?: string | null; sourceMetadata?: Record<string, unknown> }) {
  const hash = contentHash(input.analysis.extractedText);
  const { data: currentCapture } = await db.from("captures").select("normalized_url,captured_at").eq("id", input.captureId).eq("user_id", input.userId).maybeSingle();
  let previousRevisionId: string | null = null;
  if (currentCapture?.normalized_url) {
    const { data: previousCapture } = await db.from("captures").select("content_revisions(id,created_at)").eq("user_id", input.userId).eq("normalized_url", currentCapture.normalized_url).lt("captured_at", currentCapture.captured_at).order("captured_at", { ascending: false }).limit(1).maybeSingle();
    previousRevisionId = previousCapture?.content_revisions?.sort((a: { created_at: string }, b: { created_at: string }) => b.created_at.localeCompare(a.created_at))?.[0]?.id ?? null;
  }
  const { data: prior } = await db.from("content_revisions").select("id,item_analyses(*)").eq("user_id", input.userId).eq("content_hash", hash).neq("capture_id", input.captureId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const { data: revision, error } = await db.from("content_revisions").upsert({
    user_id: input.userId, capture_id: input.captureId, content_hash: hash, title: input.analysis.source.title ?? input.analysis.title,
    author: input.analysis.source.author, publication: input.analysis.source.publication, published_at: input.analysis.source.publishedAt,
    language: input.analysis.language, extracted_text: input.analysis.extractedText, extraction_method: input.extractionMethod,
    source_metadata: input.sourceMetadata ?? {}, fetched_at: input.fetchedAt ?? null, previous_revision_id: previousRevisionId,
  }, { onConflict: "capture_id,content_hash" }).select("id").single();
  if (error || !revision) throw error ?? new Error("Revision was not persisted");

  const reused = firstRelation(prior?.item_analyses);
  const analysisRow = reused ? { ...reused, id: undefined, revision_id: revision.id, user_id: input.userId, created_at: undefined, model: `${reused.model}:reused` } : {
    user_id: input.userId, revision_id: revision.id, title: input.analysis.title, summary: input.analysis.summary,
    key_ideas: input.analysis.keyIdeas, entities: input.analysis.entities, source_clues: input.analysis.source,
    confidence: input.analysis.confidence, model: env.OPENAI_ITEM_MODEL, prompt_version: "item-v1",
  };
  const { id: _id, created_at: _created, ...cleanAnalysis } = analysisRow as Record<string, unknown>;
  const { error: analysisError } = await db.from("item_analyses").upsert(cleanAnalysis, { onConflict: "revision_id" });
  if (analysisError) throw analysisError;

  const chunks = chunkText(input.analysis.extractedText);
  if (chunks.length) {
    const embeddingResponse = await openai.embeddings.create({ model: env.OPENAI_EMBEDDING_MODEL, input: chunks.map((chunk) => chunk.text), encoding_format: "float" });
    const { error: chunkError } = await db.from("content_chunks").upsert(chunks.map((chunk, index) => ({ user_id: input.userId, capture_id: input.captureId, revision_id: revision.id, ordinal: chunk.index, content: chunk.text, start_offset: chunk.start, end_offset: chunk.end, embedding: embeddingResponse.data[index]?.embedding ?? null })), { onConflict: "revision_id,ordinal" });
    if (chunkError) throw chunkError;
  }

  for (const topicName of input.analysis.topics) {
    const normalized = normalizeTopic(topicName);
    if (!normalized) continue;
    const topicEmbedding = await openai.embeddings.create({ model: env.OPENAI_EMBEDDING_MODEL, input: topicName, encoding_format: "float" });
    const vector = topicEmbedding.data[0]?.embedding;
    const { data: match } = vector ? await db.rpc("match_topic", { target_user_id: input.userId, query_embedding: vector, minimum_similarity: 0.88 }) : { data: null };
    let topicId = match?.[0]?.topic_id as string | undefined;
    if (!topicId) {
      const { data: topic, error: topicError } = await db.from("topics").upsert({ user_id: input.userId, name: topicName, normalized_name: normalized, embedding: vector ?? null }, { onConflict: "user_id,normalized_name" }).select("id").single();
      if (topicError) throw topicError;
      topicId = topic.id as string;
    }
    await db.from("item_topics").upsert({ user_id: input.userId, revision_id: revision.id, topic_id: topicId, confidence: 1 }, { onConflict: "revision_id,topic_id" });
  }
  return revision.id as string;
}
