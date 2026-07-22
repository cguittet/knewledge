export interface TextChunk {
  index: number;
  text: string;
  start: number;
  end: number;
}

export function chunkText(input: string, targetSize = 2400, overlap = 250): TextChunk[] {
  const text = input.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();
  if (!text) return [];
  if (targetSize <= overlap || overlap < 0) throw new Error("targetSize must be greater than overlap");

  const chunks: TextChunk[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(text.length, start + targetSize);
    if (end < text.length) {
      const boundary = Math.max(text.lastIndexOf("\n", end), text.lastIndexOf(". ", end));
      if (boundary > start + targetSize * 0.6) end = boundary + 1;
    }
    chunks.push({ index: chunks.length, text: text.slice(start, end).trim(), start, end });
    if (end === text.length) break;
    start = Math.max(start + 1, end - overlap);
  }
  return chunks;
}

