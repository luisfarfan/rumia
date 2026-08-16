import type { CapturedItem } from '../../core/models.js';
import { strategyFor } from '../../core/sources.js';
// Type-only imports: erased at compile time, so referencing these handlers' types
// does not pull their modules (or anything *they* import, e.g. the Telegram bot
// client) into dispatchIngestion's module graph. The real functions are loaded
// lazily, only for the branch that actually needs them — see `load*Handler` below.
import type { webExtractionHandler as WebExtractionHandlerFn } from './handlers/webExtractionHandler.js';
import type { audioTranscriptionHandler as AudioTranscriptionHandlerFn } from './handlers/audioTranscriptionHandler.js';
import type { socialMediaHandler as SocialMediaHandlerFn } from './handlers/socialMediaHandler.js';
import type { photoHandler as PhotoHandlerFn } from './handlers/photoHandler.js';
import type { tiktokCarouselHandler as TiktokCarouselHandlerFn } from './handlers/tiktokCarouselHandler.js';
import type { socialPostHandler as SocialPostHandlerFn } from './handlers/socialPostHandler.js';

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
  /**
   * Set when the item was ingested with part of the pipeline unavailable, so a
   * degraded entry stays distinguishable from a complete one after the fact.
   * Null means nothing was missing.
   */
  degradedReason: string | null;
  /** Preview image for the dashboard, when the source exposes one. */
  thumbnailUrl: string | null;
}

/**
 * Handler overrides for tests. Every member is optional: a test exercising one
 * branch injects only that branch's handler, and any branch it does not inject
 * still loads the real module lazily — so forgetting one is a loud failure, not a
 * silent no-op.
 */
export interface IngestionHandlers {
  webExtractionHandler?: typeof WebExtractionHandlerFn;
  audioTranscriptionHandler?: typeof AudioTranscriptionHandlerFn;
  socialMediaHandler?: typeof SocialMediaHandlerFn;
  photoHandler?: typeof PhotoHandlerFn;
  tiktokCarouselHandler?: typeof TiktokCarouselHandlerFn;
  socialPostHandler?: typeof SocialPostHandlerFn;
}

/** Lazily imports the real web-extraction handler. Only called when an item is
 *  actually routed to web extraction and no `handlers` override was injected. */
async function loadWebExtractionHandler(): Promise<typeof WebExtractionHandlerFn> {
  const mod = await import('./handlers/webExtractionHandler.js');
  return mod.webExtractionHandler;
}

/** Lazily imports the real audio-transcription handler (and, transitively, the
 *  Telegram bot client). Only called when an item is actually routed to audio
 *  transcription and no `handlers` override was injected. */
async function loadAudioTranscriptionHandler(): Promise<typeof AudioTranscriptionHandlerFn> {
  const mod = await import('./handlers/audioTranscriptionHandler.js');
  return mod.audioTranscriptionHandler;
}

/** Lazily imports the real social-media handler. Only called when an item is
 *  actually routed to youtube/tiktok and no `handlers` override was injected. */
async function loadSocialMediaHandler(): Promise<typeof SocialMediaHandlerFn> {
  const mod = await import('./handlers/socialMediaHandler.js');
  return mod.socialMediaHandler;
}

/** Lazily imports the Telegram photo handler (and, transitively, the bot client). */
async function loadPhotoHandler(): Promise<typeof PhotoHandlerFn> {
  const mod = await import('./handlers/photoHandler.js');
  return mod.photoHandler;
}

/** Lazily imports the TikTok carousel handler. Only reached when yt-dlp rejects a
 *  TikTok URL as unsupported, which is how photo slideshows present themselves. */
async function loadTiktokCarouselHandler(): Promise<typeof TiktokCarouselHandlerFn> {
  const mod = await import('./handlers/tiktokCarouselHandler.js');
  return mod.tiktokCarouselHandler;
}

/** Lazily imports the Open Graph post handler, shared by every social platform. */
async function loadSocialPostHandler(): Promise<typeof SocialPostHandlerFn> {
  const mod = await import('./handlers/socialPostHandler.js');
  return mod.socialPostHandler;
}

export type IngestionStatus = 'extracting' | 'transcribing';

/** Called right before a handler that will take a while starts doing real work. */
export type StatusUpdater = (status: IngestionStatus) => Promise<void>;


/**
 * Resolves which handler applies to a captured item's source type and runs it.
 *
 * This is the single place the source-type-to-handler mapping lives: callers (the
 * BullMQ worker, tests) never need to know the list of source types themselves.
 * Invocable without a queue or a Redis connection — it only depends on the handler
 * functions themselves (which can be swapped via `handlers` for testing) and an
 * optional status-update callback. Handlers are imported lazily, one at a time,
 * only for the branch actually taken: dispatching a github/x/linkedin item never
 * loads the audio-transcription handler's module graph, so it never touches the
 * Telegram bot client either.
 *
 * When the selected handler throws, this function propagates the error rather than
 * turning it into content (D2) — callers see a failed item, not a fabricated one.
 */
export async function dispatchIngestion(
  item: DispatchableItem,
  itemId: string,
  options: { handlers?: IngestionHandlers; onStatusChange?: StatusUpdater } = {}
): Promise<DispatchIngestionResult> {
  const onStatusChange = options.onStatusChange ?? (async () => {});
  const type = item.detectedSource || 'text';

  const strategy = strategyFor(type);

  if (strategy === 'media') {
    const url = item.originalUrl;
    if (!url) {
      throw new Error(`Item ${itemId} has source type ${type} but no originalUrl.`);
    }

    await onStatusChange('extracting');

    const socialMediaHandler = options.handlers?.socialMediaHandler ?? (await loadSocialMediaHandler());
    try {
      const result = await socialMediaHandler(url, itemId);
      // Both halves of a video can fail independently; say which one did.
      const missing: string[] = [];
      if (result.visualAnalysisFailed) missing.push('visual analysis');
      if (result.transcriptionFailed) missing.push('audio transcription');
      return {
        handled: true,
        title: result.title,
        content: result.content,
        description: '',
        thumbnailUrl: result.thumbnailUrl,
        degradedReason: missing.length
          ? `${missing.join(' and ')} unavailable: entry built from the remaining sources`
          : null,
      };
    } catch (mediaError: unknown) {
      // yt-dlp rejects TikTok photo carousels with "Unsupported URL". Those are not
      // broken links — they are slideshows, and the scraper API can read them.
      const text = describeError(mediaError);

      if (type === 'tiktok' && text.includes('Unsupported URL')) {
        try {
          const carouselHandler =
            options.handlers?.tiktokCarouselHandler ?? (await loadTiktokCarouselHandler());
          const carousel = await carouselHandler(url, itemId);
          return {
            handled: true,
            title: carousel.title,
            content: carousel.content,
            description: '',
            thumbnailUrl: carousel.thumbnailUrl,
        degradedReason: null,
          };
        } catch (carouselError) {
          console.warn(`[dispatchIngestion] Carousel handler failed for ${url}:`, carouselError);
        }
      }

      // Any other media failure — a platform demanding OAuth, a geo-block, a
      // removed video — still leaves the page itself readable. Its Open Graph
      // tags carry the title, description and poster, which beats losing the
      // item entirely, and the caller records that the media was not read.
      try {
        const socialPostHandler = options.handlers?.socialPostHandler ?? (await loadSocialPostHandler());
        const post = await socialPostHandler(url, itemId);
        return {
          handled: true,
          title: post.title,
          content: post.content,
          description: '',
          thumbnailUrl: post.thumbnailUrl,
          degradedReason:
            'media download unavailable: entry built from the page description, not the video itself',
        };
      } catch (postError) {
        console.warn(`[dispatchIngestion] Open Graph fallback failed for ${url}:`, postError);
      }

      const webExtractionHandler =
        options.handlers?.webExtractionHandler ?? (await loadWebExtractionHandler());
      const result = await webExtractionHandler(url);
      return {
        handled: true,
        title: result.title,
        content: result.content,
        description: result.description || '',
        thumbnailUrl: result.thumbnailUrl,
        degradedReason:
          type === 'tiktok'
            ? 'tiktok carousel unavailable: fell back to page metadata'
            : 'media extraction unavailable: fell back to page metadata',
      };
    }
  }

  if (strategy === 'post') {
    const url = item.originalUrl;
    if (!url) {
      throw new Error(`Item ${itemId} has source type ${type} but no originalUrl.`);
    }

    await onStatusChange('extracting');

    const socialPostHandler = options.handlers?.socialPostHandler ?? (await loadSocialPostHandler());
    const result = await socialPostHandler(url, itemId);
    return {
      handled: true,
      title: result.title,
      content: result.content,
      description: '',
      thumbnailUrl: result.thumbnailUrl,
      degradedReason: result.visualAnalysisFailed
        ? 'post image unreadable: entry built from the caption only'
        : null,
    };
  }

  if (type === 'photo') {
    if (!item.fileId) {
      throw new Error(`Item ${itemId} has source type photo but no fileId.`);
    }

    await onStatusChange('extracting');

    const photoHandler = options.handlers?.photoHandler ?? (await loadPhotoHandler());
    const caption = item.rawInput?.trim();
    const result = await photoHandler(item.fileId, {
      ...(caption ? { caption } : {}),
      itemId,
    });
    return {
      handled: true,
      title: result.title,
      content: result.content,
      description: '',
      thumbnailUrl: null,
        degradedReason: null,
    };
  }

  if (strategy === 'web' && item.originalUrl) {
    if (!item.originalUrl) {
      throw new Error(`Item ${itemId} has source type ${type} but no originalUrl.`);
    }

    await onStatusChange('extracting');

    const webExtractionHandler = options.handlers?.webExtractionHandler ?? (await loadWebExtractionHandler());
    const result = await webExtractionHandler(item.originalUrl);
    return {
      handled: true,
      title: result.title,
      content: result.content,
      description: result.description || '',
      thumbnailUrl: result.thumbnailUrl,
      degradedReason: null,
    };
  }

  if (type === 'audio' || type === 'voice') {
    if (!item.fileId) {
      throw new Error(`Item ${itemId} has source type ${type} but no fileId.`);
    }

    await onStatusChange('transcribing');

    const audioTranscriptionHandler =
      options.handlers?.audioTranscriptionHandler ?? (await loadAudioTranscriptionHandler());
    const result = await audioTranscriptionHandler(item.fileId, item.fileSize);
    return { handled: true, title: '', content: result.content, description: '', thumbnailUrl: null, degradedReason: null };
  }

  // No reader applies. Say so explicitly: an item whose "content" is its own URL
  // looks ingested in the dashboard, and that is the illusion this records against.
  return {
    handled: false,
    title: '',
    content: item.rawInput,
    description: '',
    thumbnailUrl: null,
    degradedReason: `no reader for source "${type}": stored as the raw link`,
  };
}

/** Flattens an error into searchable text. yt-dlp surfaces its reason on `stderr`
 *  rather than `message`, so checking only `message` misses "Unsupported URL". */
function describeError(error: unknown): string {
  const parts = [String(error)];
  if (error && typeof error === 'object') {
    const e = error as { message?: unknown; stderr?: unknown };
    if (typeof e.message === 'string') parts.push(e.message);
    if (typeof e.stderr === 'string') parts.push(e.stderr);
  }
  return parts.join(' ');
}
