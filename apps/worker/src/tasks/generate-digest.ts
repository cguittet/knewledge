import { task, logger } from "@trigger.dev/sdk";
import { z } from "zod";
import { digestWindow, firstRelation, keepStrongRelations } from "@knewledge/core";
import type { DigestSettings } from "@knewledge/contracts";
import { db } from "../clients.js";
import { env } from "../env.js";
import { synthesizeDigest } from "../model.js";
import { sendDigestEmail } from "../email.js";
import { jobUsageColumns, type ModelUsage } from "../usage.js";

const Payload = z.object({ userId: z.string().uuid(), now: z.string().datetime() });

export const generateDigest = task({
  id: "generate-digest",
  maxDuration: 600,
  retry: { maxAttempts: 3, minTimeoutInMs: 5_000, maxTimeoutInMs: 60_000, factor: 2 },
  run: async (raw) => {
    const { userId, now } = Payload.parse(raw);
    const usageCalls: ModelUsage[] = [];
    const [{ data: settings }, { data: profile }] = await Promise.all([
      db.from("digest_settings").select("*").eq("user_id", userId).single(),
      db.from("user_profiles").select("email,preferred_language").eq("user_id", userId).single(),
    ]);
    if (!settings || !profile) throw new Error("Digest user configuration not found");
    const config: DigestSettings = { timezone: settings.timezone, weekday: settings.weekday, localTime: String(settings.local_time).slice(0, 5), preferredLanguage: profile.preferred_language, enabled: settings.enabled };
    const window = digestWindow(config, new Date(now), settings.last_period_end ? new Date(settings.last_period_end) : null);
    const jobKey = `digest:${userId}:${window.periodEnd.toISOString()}`;
    await db.from("job_runs").upsert({ user_id: userId, job_type: "generate_digest", idempotency_key: jobKey, status: "running", started_at: new Date().toISOString() }, { onConflict: "idempotency_key", ignoreDuplicates: true });
    const { data: captures, error } = await db.from("captures").select("id,kind,original_url,note,captured_at,status,content_revisions(id,item_analyses(title,summary,key_ideas),content_chunks(embedding,content))").eq("user_id", userId).gte("captured_at", window.periodStart.toISOString()).lt("captured_at", window.periodEnd.toISOString()).is("deleted_at", null).order("captured_at");
    if (error) throw error;
    if (!captures?.length) {
      await db.from("digest_settings").update({ last_period_end: window.periodEnd.toISOString() }).eq("user_id", userId);
      await db.from("job_runs").update({ status: "succeeded", finished_at: new Date().toISOString() }).eq("idempotency_key", jobKey);
      return { skipped: true, reason: "empty" };
    }
    const ready = captures.filter((capture) => capture.status === "ready" && firstRelation(capture.content_revisions?.[0]?.item_analyses));
    const candidates: Record<string, Array<{ capture_id: string; evidence: string; title: string; summary: string; similarity: number }>> = {};
    for (const capture of ready) {
      const embedding = capture.content_revisions?.[0]?.content_chunks?.[0]?.embedding;
      if (!embedding) continue;
      const { data } = await db.rpc("related_chunks", { target_user_id: userId, current_capture: capture.id, before_time: window.periodStart.toISOString(), query_embedding: embedding, result_limit: 20 });
      candidates[capture.id] = (data ?? []) as Array<{ capture_id: string; evidence: string; title: string; summary: string; similarity: number }>;
    }
    const source = JSON.stringify({ instructions: { language: config.preferredLanguage, periodStart: window.periodStart.toISOString(), periodEnd: window.periodEnd.toISOString() }, currentCaptures: ready.map((capture) => ({ id: capture.id, savedAt: capture.captured_at, kind: capture.kind, note: capture.note, analysis: firstRelation(capture.content_revisions[0]!.item_analyses)! })), priorCandidatesByCurrentCapture: candidates });
    const synthesis = await synthesizeDigest(`<UNTRUSTED_CAPTURE_DATA>${source}</UNTRUSTED_CAPTURE_DATA>`, (usage) => usageCalls.push(usage));
    await db.from("job_runs").update(jobUsageColumns(usageCalls)).eq("idempotency_key", jobKey);
    const normalized = (value: string) => value.toLowerCase().replace(/\s+/g, " ").replace(/[^\p{L}\p{N} ]/gu, "").trim();
    synthesis.relations = keepStrongRelations(synthesis.relations.filter((relation) => {
      const current = ready.find((capture) => capture.id === relation.currentCaptureId);
      const prior = candidates[relation.currentCaptureId]?.find((candidate) => candidate.capture_id === relation.priorCaptureId);
      if (!current || !prior) return false;
      const currentSource = JSON.stringify(firstRelation(current.content_revisions[0]!.item_analyses)!);
      return normalized(currentSource).includes(normalized(relation.currentEvidence)) && normalized(prior.evidence).includes(normalized(relation.priorEvidence));
    }));
    const { data: digest, error: digestError } = await db.from("digests").upsert({ user_id: userId, period_start: window.periodStart.toISOString(), period_end: window.periodEnd.toISOString(), title: synthesis.title, overview: synthesis.overview, themes: synthesis.themes, model: env.OPENAI_DIGEST_MODEL }, { onConflict: "user_id,period_end" }).select("id,email_status").single();
    if (digestError || !digest) throw digestError ?? new Error("Digest was not persisted");
    await db.from("digest_entries").upsert(captures.map((capture, ordinal) => ({ user_id: userId, digest_id: digest.id, capture_id: capture.id, ordinal })), { onConflict: "digest_id,capture_id" });
    if (synthesis.relations.length) {
      await db.from("digest_relations").delete().eq("digest_id", digest.id);
      const { error: relationError } = await db.from("digest_relations").insert(synthesis.relations.map((relation) => ({ user_id: userId, digest_id: digest.id, current_capture_id: relation.currentCaptureId, prior_capture_id: relation.priorCaptureId, relation_type: relation.type, explanation: relation.explanation, current_evidence: relation.currentEvidence, prior_evidence: relation.priorEvidence, confidence: relation.confidence })));
      if (relationError) logger.warn("Some digest relationships could not be persisted", { error: relationError.message });
    }
    if (digest.email_status !== "sent") {
      const result = await sendDigestEmail({ email: profile.email, digestId: digest.id, digest: synthesis, itemCount: captures.length });
      if (result.error) throw new Error(result.error.message);
      await db.from("digests").update({ email_status: "sent", email_sent_at: new Date().toISOString() }).eq("id", digest.id);
    }
    await db.from("digest_settings").update({ last_period_end: window.periodEnd.toISOString() }).eq("user_id", userId);
    await db.from("job_runs").update({ status: "succeeded", digest_id: digest.id, finished_at: new Date().toISOString() }).eq("idempotency_key", jobKey);
    return { digestId: digest.id, itemCount: captures.length, relationCount: synthesis.relations.length };
  },
});
