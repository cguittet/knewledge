import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

const BLOCKED_HOSTS = new Set(["localhost", "localhost.localdomain", "metadata.google.internal"]);

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

export function normalizeUrl(raw: string): string {
  const url = new URL(raw);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new UnsafeUrlError("Only HTTP and HTTPS URLs are supported");
  url.hash = "";
  url.hostname = url.hostname.toLowerCase();
  if ((url.protocol === "http:" && url.port === "80") || (url.protocol === "https:" && url.port === "443")) url.port = "";
  for (const key of [...url.searchParams.keys()]) {
    if (/^(utm_|fbclid$|gclid$)/i.test(key)) url.searchParams.delete(key);
  }
  url.searchParams.sort();
  return url.toString();
}

export function isPrivateIp(address: string): boolean {
  if (address === "::1" || address === "0:0:0:0:0:0:0:1") return true;
  const normalized = address.replace(/^::ffff:/, "");
  if (isIP(normalized) === 4) {
    const [a = 0, b = 0] = normalized.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
  }
  const lower = normalized.toLowerCase();
  return lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe8") || lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb") || lower === "::";
}

export async function assertPublicUrl(raw: string): Promise<URL> {
  const url = new URL(normalizeUrl(raw));
  if (BLOCKED_HOSTS.has(url.hostname) || url.hostname.endsWith(".local")) throw new UnsafeUrlError("Local hosts are not allowed");
  const directIp = isIP(url.hostname) ? [url.hostname] : [];
  const resolved = directIp.length ? directIp : (await lookup(url.hostname, { all: true, verbatim: true })).map((record) => record.address);
  if (!resolved.length || resolved.some(isPrivateIp)) throw new UnsafeUrlError("URL resolves to a private or invalid address");
  return url;
}
