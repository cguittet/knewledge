import { tasks } from "@trigger.dev/sdk";

export async function queueCapture(captureId: string, userId: string) {
  await tasks.trigger("process-capture", { captureId, userId }, { idempotencyKey: `capture:${captureId}` });
}
