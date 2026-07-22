import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import robotsParser from "robots-parser";
import { assertPublicUrl, UnsafeUrlError } from "@knewledge/core";

export class FetchPageError extends Error {
  constructor(public category: "authentication_required" | "paywall" | "robots_denied" | "bot_protection" | "unsupported_content" | "empty_content" | "captions_unavailable" | "fetch_timeout" | "transient" | "unsafe_url", message: string) {
    super(message); this.name = "FetchPageError";
  }
}

const MAX_HTML_BYTES = 5 * 1024 * 1024;
const USER_AGENT = "KnewledgeBot/0.1 (+https://knewledge.example/about)";

async function respectsRobots(url: URL, signal: AbortSignal) {
  const robotsUrl = new URL("/robots.txt", url.origin);
  try {
    const response = await fetch(robotsUrl, { signal, headers: { "user-agent": USER_AGENT }, redirect: "manual" });
    if (!response.ok) return true;
    const body = (await response.text()).slice(0, 500_000);
    return robotsParser(robotsUrl.toString(), body).isAllowed(url.toString(), USER_AGENT) !== false;
  } catch { return true; }
}

async function boundedText(response: Response) {
  const length = Number(response.headers.get("content-length") ?? 0);
  if (length > MAX_HTML_BYTES) throw new FetchPageError("unsupported_content", "Page is larger than the 5 MB extraction limit");
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = []; let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_HTML_BYTES) { await reader.cancel(); throw new FetchPageError("unsupported_content", "Page is larger than the 5 MB extraction limit"); }
    chunks.push(value);
  }
  const merged = new Uint8Array(total); let offset = 0;
  for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(merged);
}

export async function fetchReadablePage(rawUrl: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    let url: URL;
    try {
      url = await assertPublicUrl(rawUrl);
    } catch (error) {
      if (error instanceof UnsafeUrlError) throw new FetchPageError("unsafe_url", error.message);
      throw error;
    }
    if (!(await respectsRobots(url, controller.signal))) throw new FetchPageError("robots_denied", "The site does not allow automated retrieval of this page");
    let response: Response | undefined;
    for (let redirects = 0; redirects <= 5; redirects += 1) {
      response = await fetch(url, { signal: controller.signal, redirect: "manual", headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml" } });
      if (![301, 302, 303, 307, 308].includes(response.status)) break;
      const location = response.headers.get("location");
      if (!location) throw new FetchPageError("transient", "Redirect did not include a destination");
      url = await assertPublicUrl(new URL(location, url).toString());
      if (!(await respectsRobots(url, controller.signal))) throw new FetchPageError("robots_denied", "The redirect destination does not allow automated retrieval");
    }
    if (!response) throw new FetchPageError("transient", "No response received");
    if (response.status === 401) throw new FetchPageError("authentication_required", "This page requires authentication");
    if (response.status === 402) throw new FetchPageError("paywall", "This page is behind a paywall");
    if (response.status === 403 || response.status === 429) throw new FetchPageError("bot_protection", "The site blocked automated retrieval");
    if (!response.ok) throw new FetchPageError(response.status >= 500 ? "transient" : "unsupported_content", `Page returned HTTP ${response.status}`);
    const contentType = response.headers.get("content-type") ?? "";
    if (!/text\/html|application\/xhtml\+xml/i.test(contentType)) throw new FetchPageError("unsupported_content", `Unsupported content type: ${contentType || "unknown"}`);
    const html = await boundedText(response);
    const dom = new JSDOM(html, { url: url.toString() });
    const article = new Readability(dom.window.document).parse();
    const text = article?.textContent?.replace(/\n{3,}/g, "\n\n").trim();
    if (!text || text.length < 120) throw new FetchPageError("empty_content", "The page did not contain enough readable text");
    const paywallSignals = /subscribe to (continue|read)|already a subscriber|sign in to continue/i;
    if (text.length < 1000 && paywallSignals.test(text)) throw new FetchPageError("paywall", "The readable content appears to be behind a paywall");
    return { url: url.toString(), title: article?.title ?? dom.window.document.title, author: article?.byline ?? null, publication: article?.siteName ?? null, excerpt: article?.excerpt ?? null, text: text.slice(0, 250_000) };
  } catch (error) {
    if (error instanceof FetchPageError) throw error;
    if (error instanceof Error && error.name === "AbortError") throw new FetchPageError("fetch_timeout", "Page retrieval exceeded 15 seconds");
    throw new FetchPageError("transient", error instanceof Error ? error.message : "Page retrieval failed");
  } finally { clearTimeout(timeout); }
}
