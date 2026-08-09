import type { CapturedItem } from '../../core/models.js';
import { webExtractionHandler } from './handlers/webExtractionHandler.js';
import { audioTranscriptionHandler } from './handlers/audioTranscriptionHandler.js';
import { socialMediaHandler } from './handlers/socialMediaHandler.js';
import { tiktokCarouselHandler } from './handlers/tiktokCarouselHandler.js';
import { photoHandler } from './handlers/photoHandler.js';

/** The subset of a captured item the dispatcher needs to pick and run a handler. */
export type DispatchableItem = Pick<
  CapturedItem,
  'detectedSource' | 'originalUrl' | 'fileId' | 'fileSize' | 'rawInput'
>;

export interface DispatchIngestionResult {
  /** False when no handler applies to the item's source type. */
  handled: boolean;
  title: string;
  content: string;
  description: string;
  degradedReason: string | null;
}

export interface IngestionHandlers {
  webExtractionHandler: typeof webExtractionHandler;
  audioTranscriptionHandler: typeof audioTranscriptionHandler;
  socialMediaHandler: typeof socialMediaHandler;
  tiktokCarouselHandler: typeof tiktokCarouselHandler;
  photoHandler: typeof photoHandler;
}

/** The real handlers, used when the caller does not inject fakes (i.e. in production). */
export const defaultIngestionHandlers: IngestionHandlers = {
  webExtractionHandler,
  audioTranscriptionHandler,
  socialMediaHandler,
  tiktokCarouselHandler,
  photoHandler,
};

export type IngestionStatus = 'extracting' | 'transcribing';

/** Called right before a handler that will take a while starts doing real work. */
export type StatusUpdater = (status: IngestionStatus) => Promise<void>;

/** Source types with their own dedicated handler; anything else with a URL falls
 *  through to generic web extraction. Reddit and Instagram are deliberately kept
 *  out of that fallback (D1): they need their own route, not a generic scrape. */
const NON_WEB_SOURCE_TYPES = new Set([
  'youtube',
  'tiktok',
  'photo',
  'audio',
  'voice',
  'instagram',
  'reddit',
  'pdf',
]);

/** Source types that always route to web extraction, whether or not a generic URL
 *  fallback would also have matched them. */
const WEB_SOURCE_TYPES = new Set(['web', 'url', 'github', 'x', 'linkedin']);

/**
 * Resolves which handler applies to a captured item's source type and runs it.
 *
 * This is the single place the source-type-to-handler mapping lives: callers (the
 * BullMQ worker, tests) never need to know the list of source types themselves.
 * Invocable without a queue or a Redis connection — it only depends on the handler
 * functions themselves (which can be swapped via `handlers` for testing) and an
 * optional status-update callback.
 *
 * When the selected handler throws, this function propagates the error rather than
 * turning it into content (D2) — callers see a failed item, not a fabricated one.
 */
export async function dispatchIngestion(
  item: DispatchableItem,
  itemId: string,
  options: { handlers?: IngestionHandlers; onStatusChange?: StatusUpdater } = {}
): Promise<DispatchIngestionResult> {
  const handlers = options.handlers ?? defaultIngestionHandlers;
  const onStatusChange = options.onStatusChange ?? (async () => {});
  const type = item.detectedSource || 'text';

  if (type === 'youtube' || type === 'tiktok') {
    if (!item.originalUrl) {
      throw new Error(`Item ${itemId} has source type ${type} but no originalUrl.`);
    }

    await onStatusChange('extracting');

    let title = '';
    let content = '';
    let description = '';
    let degradedReason: string | null = null;

    try {
      const result = await handlers.socialMediaHandler(item.originalUrl, itemId);
      title = result.title;
      content = result.content;
      if (result.visualAnalysisFailed) {
        degradedReason = 'visual analysis unavailable: entry built from audio/subtitles only';
      }
    } catch (smError: any) {
      const errorText = (smError.message || '') + ' ' + (smError.stderr || '') + ' ' + String(smError);
      // yt-dlp rejects TikTok photo carousels with "Unsupported URL". Those are
      // not broken links — they are slideshows, and the scraper API can read them.
      if (errorText.includes('Unsupported URL') && type === 'tiktok') {
        try {
          const carousel = await handlers.tiktokCarouselHandler(item.originalUrl, itemId);
          title = carousel.title;
          content = carousel.content;
        } catch {
          const result = await handlers.webExtractionHandler(item.originalUrl);
          title = result.title;
          description = result.description || '';
          content = result.content;
          degradedReason = 'tiktok carousel unavailable: fell back to page metadata';
        }
      } else if (errorText.includes('Unsupported URL')) {
        const result = await handlers.webExtractionHandler(item.originalUrl);
        title = result.title;
        description = result.description || '';
        content = result.content;
      } else {
        throw smError; // Rethrow if it's a different error
      }
    }

    return { handled: true, title, content, description, degradedReason };
  }

  if (type === 'photo') {
    if (!item.fileId) {
      throw new Error(`Item ${itemId} has source type photo but no fileId.`);
    }

    await onStatusChange('extracting');

    const caption = item.rawInput?.trim();
    const result = await handlers.photoHandler(item.fileId, {
      ...(caption ? { caption } : {}),
      itemId,
    });

    return { handled: true, title: result.title, content: result.content, description: '', degradedReason: null };
  }

  const isWebSource =
    WEB_SOURCE_TYPES.has(type) || (!!item.originalUrl && !NON_WEB_SOURCE_TYPES.has(type));

  if (isWebSource) {
    if (!item.originalUrl) {
      throw new Error(`Item ${itemId} has source type ${type} but no originalUrl.`);
    }

    await onStatusChange('extracting');

    const result = await handlers.webExtractionHandler(item.originalUrl);
    return {
      handled: true,
      title: result.title,
      content: result.content,
      description: result.description || '',
      degradedReason: null,
    };
  }

  if (type === 'audio' || type === 'voice') {
    if (!item.fileId) {
      throw new Error(`Item ${itemId} has source type ${type} but no fileId.`);
    }

    await onStatusChange('transcribing');

    const result = await handlers.audioTranscriptionHandler(item.fileId, item.fileSize);
    return { handled: true, title: '', content: result.content, description: '', degradedReason: null };
  }

  return { handled: false, title: '', content: item.rawInput, description: '', degradedReason: null };
}
