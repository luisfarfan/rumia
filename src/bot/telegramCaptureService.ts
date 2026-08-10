import { CapturedItemsRepo } from '../db/capturedItemsRepo.js';
import type { CapturedItem, CapturedFile } from '../core/models.js';
import { ingestionQueue } from '../workers/ingestion/queue.js';

const URL_REGEX = /(https?:\/\/[^\s]+)/;

export class TelegramCaptureService {
  /**
   * Extracts the first URL and returns it, along with any remaining text as a note.
   */
  static parseText(text: string): { url?: string; note?: string } {
    const match = text.match(URL_REGEX);
    if (!match) {
      return { note: text };
    }
    const url = match[0];
    const note = text.replace(url, '').trim();
    return { url, note: note || undefined };
  }

  /**
   * Identifies a basic provider based on the URL (placeholder for full SourceResolver).
   */
  static detectSource(url?: string): string | undefined {
    if (!url) return undefined;
    const lower = url.toLowerCase();
    if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'youtube';
    if (lower.includes('tiktok.com')) return 'tiktok';
    if (lower.includes('instagram.com')) return 'instagram';
    if (lower.includes('facebook.com') || lower.includes('fb.watch')) return 'facebook';
    if (lower.includes('twitter.com') || lower.includes('x.com')) return 'x';
    if (lower.includes('linkedin.com')) return 'linkedin';
    if (lower.includes('reddit.com')) return 'reddit';
    if (lower.includes('github.com')) return 'github';
    if (lower.endsWith('.pdf')) return 'pdf';
    return 'web';
  }

  /**
   * Processes a Telegram message containing text, a file, or both, and persists it.
   */
  static async capture({
    telegramUserId,
    chatId,
    messageId,
    text,
    file,
    detectedSource: passedDetectedSource,
  }: {
    telegramUserId: number;
    chatId: number;
    messageId: number;
    text?: string;
    file?: CapturedFile;
    detectedSource?: string;
  }): Promise<CapturedItem> {
    const userId = telegramUserId.toString();
    const idempotencyKey = `telegram-${chatId}-${messageId}`;
    
    let originalUrl: string | undefined;
    let note: string | undefined;
    let rawInput = '';

    if (text) {
      const parsed = this.parseText(text);
      originalUrl = parsed.url;
      note = parsed.note;
      rawInput = text;
    }

    if (file) {
      rawInput = rawInput 
        ? `${rawInput} [File: ${file.fileName || file.fileId}]` 
        : `[File: ${file.fileName || file.fileId}]`;
    }

    // Determine basic source provider
    const detectedSource = passedDetectedSource || this.detectSource(originalUrl) || (file ? 'file' : 'text');

    // Create CapturedItem through Repo
    const item = await CapturedItemsRepo.create({
      userId,
      originalUrl,
      rawInput,
      sourceChannel: 'telegram',
      detectedSource,
      idempotencyKey,
      status: 'received',
      fileId: file?.fileId,
      fileName: file?.fileName,
      mimeType: file?.mimeType,
      fileSize: file?.fileSize,
    });

    try {
      // Enqueue job in BullMQ
      await ingestionQueue.add(`ingest-${item.id}`, {
        itemId: item.id,
        sourceType: detectedSource,
      });

      // Update DB status to queued
      await CapturedItemsRepo.update(item.id, { status: 'queued' });
      item.status = 'queued';
      console.log(`Successfully enqueued ingestion job for item: ${item.id}`);
    } catch (err) {
      console.error(`Failed to enqueue job for item ${item.id} (remaining as 'received'):`, err);
    }

    return item;
  }
}
