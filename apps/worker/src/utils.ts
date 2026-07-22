import { createHash } from "node:crypto";

export function contentHash(text: string) { return createHash("sha256").update(text.normalize("NFC").replace(/\s+/g, " ").trim()).digest("hex"); }
export function normalizeTopic(topic: string) { return topic.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80); }

