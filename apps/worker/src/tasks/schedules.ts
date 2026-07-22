import { schedules, tasks, logger } from "@trigger.dev/sdk";
import { isDigestDue } from "@knewledge/core";
import { db } from "../clients.js";

export const dispatchDigests = schedules.task({
  id: "dispatch-due-digests",
  cron: "*/15 * * * *",
  run: async ({ timestamp }) => {
    const { data, error } = await db.from("digest_settings").select("*,user_profiles(preferred_language)").eq("enabled", true);
    if (error) throw error;
    let dispatched = 0;
    for (const row of data ?? []) {
      const settings = { timezone: row.timezone, weekday: row.weekday, localTime: String(row.local_time).slice(0, 5), preferredLanguage: row.user_profiles?.preferred_language ?? "en", enabled: row.enabled };
      if (!isDigestDue(settings, timestamp, row.last_period_end ? new Date(row.last_period_end) : null)) continue;
      await tasks.trigger("generate-digest", { userId: row.user_id, now: timestamp.toISOString() }, { idempotencyKey: `digest:${row.user_id}:${timestamp.toISOString().slice(0, 13)}` });
      dispatched += 1;
    }
    logger.info("Digest dispatch complete", { dispatched });
    return { dispatched };
  },
});

export const cleanupDeletedCaptures = schedules.task({
  id: "cleanup-deleted-captures",
  cron: "0 * * * *",
  run: async () => {
    const { data, error } = await db.from("cleanup_queue").select("*").is("completed_at", null).lte("run_after", new Date().toISOString()).limit(100);
    if (error) throw error;
    for (const job of data ?? []) {
      if (job.object_keys?.length) await db.storage.from("captures").remove(job.object_keys);
      await db.from("captures").delete().eq("id", job.capture_id).eq("user_id", job.user_id);
      await db.from("cleanup_queue").update({ completed_at: new Date().toISOString() }).eq("id", job.id);
    }
    return { cleaned: data?.length ?? 0 };
  },
});
