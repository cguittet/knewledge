const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

export function youtubeVideoId(raw: string): string | null {
  let url: URL;
  try { url = new URL(raw); } catch { return null; }
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  let candidate: string | null = null;
  if (host === "youtu.be") candidate = url.pathname.split("/").filter(Boolean)[0] ?? null;
  if (host === "youtube.com" || host.endsWith(".youtube.com")) {
    if (url.pathname === "/watch") candidate = url.searchParams.get("v");
    else if (/^\/(shorts|embed|live)\//.test(url.pathname)) candidate = url.pathname.split("/")[2] ?? null;
  }
  return candidate && VIDEO_ID.test(candidate) ? candidate : null;
}

export function isYoutubeUrl(raw: string): boolean { return youtubeVideoId(raw) !== null; }

export function canonicalYoutubeUrl(raw: string): string | null {
  const id = youtubeVideoId(raw);
  return id ? `https://www.youtube.com/watch?v=${id}` : null;
}
