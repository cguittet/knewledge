const HTTP_URL = /https?:\/\/[^\s,<>"']+/gi;
const TRAILING_PUNCTUATION = /[.;:!?\])}]+$/;

/**
 * Extract HTTP(S) URLs from free-form pasted text. This intentionally treats
 * commas and whitespace as separators so browser "copy all links" output,
 * numbered lists, and ordinary prose all work without format-specific logic.
 */
export function parsePastedUrls(value: string, limit = 50): string[] {
  const matches = value.match(HTTP_URL) ?? [];
  const urls: string[] = [];

  for (const match of matches) {
    const candidate = match.replace(TRAILING_PUNCTUATION, "");
    try {
      const parsed = new URL(candidate);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") continue;
      urls.push(candidate);
      if (urls.length === limit) break;
    } catch {
      // Ignore malformed fragments and let the UI explain when none were found.
    }
  }

  return urls;
}
