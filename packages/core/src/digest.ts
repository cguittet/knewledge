import { DateTime } from "luxon";
import type { DigestSettings } from "@knewledge/contracts";

export interface DigestWindow {
  periodStart: Date;
  periodEnd: Date;
}

export function isDigestDue(settings: DigestSettings, now: Date, lastPeriodEnd?: Date | null): boolean {
  if (!settings.enabled) return false;
  const local = DateTime.fromJSDate(now, { zone: settings.timezone });
  const [hour = 0, minute = 0] = settings.localTime.split(":").map(Number);
  const scheduled = local.set({ hour, minute, second: 0, millisecond: 0 });
  if (local.weekday % 7 !== settings.weekday || local < scheduled || local >= scheduled.plus({ minutes: 15 })) return false;
  return !lastPeriodEnd || DateTime.fromJSDate(lastPeriodEnd).toUTC() < scheduled.toUTC();
}

export function digestWindow(settings: DigestSettings, now: Date, lastPeriodEnd?: Date | null): DigestWindow {
  const local = DateTime.fromJSDate(now, { zone: settings.timezone });
  const [hour = 0, minute = 0] = settings.localTime.split(":").map(Number);
  const end = local.set({ hour, minute, second: 0, millisecond: 0 }).toUTC();
  const start = lastPeriodEnd ? DateTime.fromJSDate(lastPeriodEnd).toUTC() : end.minus({ days: 7 });
  if (!start.isValid || !end.isValid || start >= end) throw new Error("Invalid digest window");
  return { periodStart: start.toJSDate(), periodEnd: end.toJSDate() };
}

export function keepStrongRelations<T extends { confidence: number; currentCaptureId: string }>(relations: T[]): T[] {
  const counts = new Map<string, number>();
  return relations
    .filter((relation) => relation.confidence >= 0.8)
    .sort((a, b) => b.confidence - a.confidence)
    .filter((relation) => {
      const count = counts.get(relation.currentCaptureId) ?? 0;
      if (count >= 3) return false;
      counts.set(relation.currentCaptureId, count + 1);
      return true;
    });
}

