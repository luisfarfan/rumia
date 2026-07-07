/**
 * Parses and cleans WebVTT (.vtt) format captions into clean plain text.
 * Removes timestamps, headers, metadata, and redundant duplicate lines.
 */
export function parseVtt(vttContent: string): string {
  const lines = vttContent.split(/\r?\n/);
  const cleanedLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip WebVTT header, metadata, cues, and timestamp lines
    if (
      !trimmed ||
      trimmed.startsWith('WEBVTT') ||
      trimmed.startsWith('Kind:') ||
      trimmed.startsWith('Language:') ||
      trimmed.includes('-->')
    ) {
      continue;
    }

    // Remove basic styling tags (e.g. <c>text</c>)
    const cleanLine = trimmed.replace(/<[^>]*>/g, '');

    if (cleanLine) {
      // Avoid duplicate adjacent lines (common in rolling auto-generated captions)
      if (cleanedLines.length === 0 || cleanedLines[cleanedLines.length - 1] !== cleanLine) {
        cleanedLines.push(cleanLine);
      }
    }
  }

  // Join lines with space and resolve double spaces
  return cleanedLines.join(' ').replace(/\s+/g, ' ').trim();
}
