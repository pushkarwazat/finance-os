/**
 * chunker — sentence-aware text chunker for RAG ingestion.
 *
 * Splits extracted document text into overlapping chunks of ~350 words each.
 * Section headings are detected and attached to each chunk for citation display.
 */

export interface TextChunk {
  chunkIndex: number;
  text: string;
  wordCount: number;
  tokenCount: number;
  sectionTitle: string | null;
}

const CHUNK_SIZE_WORDS = 350;
const OVERLAP_WORDS = 60;

/** Rough token estimate: ~4 chars per token for English prose. */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** Split text into whitespace-delimited words. */
function words(text: string): string[] {
  return text.split(/\s+/).filter((w) => w.length > 0);
}

/**
 * Heuristic: a paragraph is a section heading if its first line is short,
 * starts with a capital letter or digit, and does not end with sentence punctuation.
 */
function detectHeading(paragraph: string): string | null {
  const firstLine = (paragraph.split("\n")[0] ?? "").trim();
  if (
    firstLine.length > 0 &&
    firstLine.length < 120 &&
    /^[A-Z0-9]/.test(firstLine) &&
    !/[.!?]\s*$/.test(firstLine)
  ) {
    return firstLine;
  }
  return null;
}

/**
 * Chunk `text` into overlapping segments of ~CHUNK_SIZE_WORDS words.
 *
 * Algorithm:
 *   1. Split on blank lines → paragraphs
 *   2. At heading boundaries (or when the buffer fills), flush a chunk
 *   3. Carry the last OVERLAP_WORDS words into the next chunk for continuity
 */
export function chunkText(text: string): TextChunk[] {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  if (paragraphs.length === 0) return [];

  const chunks: TextChunk[] = [];
  let buffer: string[] = [];
  let currentTitle: string | null = null;
  let idx = 0;

  const flush = (titleOverride?: string | null): void => {
    if (buffer.length === 0) return;
    const text = buffer.join(" ");
    chunks.push({
      chunkIndex: idx++,
      text,
      wordCount: buffer.length,
      tokenCount: estimateTokens(text),
      sectionTitle: titleOverride !== undefined ? titleOverride : currentTitle,
    });
    buffer = buffer.slice(-OVERLAP_WORDS);
  };

  for (const para of paragraphs) {
    const heading = detectHeading(para);
    const paraWords = words(para);

    // Heading boundary: flush the current chunk before starting the new section
    if (heading && buffer.length > OVERLAP_WORDS) {
      flush(currentTitle);
      currentTitle = heading;
    } else if (heading) {
      currentTitle = heading;
    }

    // Capacity boundary: flush before appending if the buffer is full
    if (
      buffer.length + paraWords.length > CHUNK_SIZE_WORDS &&
      buffer.length > OVERLAP_WORDS
    ) {
      flush();
    }

    buffer.push(...paraWords);

    // Safety valve: flush immediately if a single paragraph is enormous
    while (buffer.length > CHUNK_SIZE_WORDS * 2) {
      flush();
    }
  }

  // Final flush
  if (buffer.length > 0) {
    const text = buffer.join(" ");
    chunks.push({
      chunkIndex: idx,
      text,
      wordCount: buffer.length,
      tokenCount: estimateTokens(text),
      sectionTitle: currentTitle,
    });
  }

  return chunks;
}
