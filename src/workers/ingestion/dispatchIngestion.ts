import type { CapturedItem } from '../../core/models.js';
// Type-only imports: erased at compile time, so referencing these handlers' types
// does not pull their modules (or anything *they* import, e.g. the Telegram bot
// client) into dispatchIngestion's module graph. The real functions are loaded
// lazily, only for the branch that actually needs them — see `load*Handler` below.
import type { webExtractionHandler as WebExtractionHandlerFn } from './handlers/webExtractionHandler.js';
import type { audioTranscriptionHandler as AudioTranscriptionHandlerFn } from './handlers/audioTranscriptionHandler.js';
import type { socialMediaHandler as SocialMediaHandlerFn } from './handlers/socialMediaHandler.js';

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
}

export interface IngestionHandlers {
  webExtractionHandler: typeof WebExtractionHandlerFn;
  audioTranscriptionHandler: typeof AudioTranscriptionHandlerFn;
  socialMediaHandler: typeof SocialMediaHandlerFn;
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

export type IngestionStatus = 'extracting' | 'transcribing';

/** Called right before a handler that will take a while starts doing real work. */
export type StatusUpdater = (status: IngestionStatus) => Promise<void>;

/** Source types with their own dedicated handler; anything else with a URL falls
 *  through to generic web extraction. Reddit and Instagram are deliberately kept
 *  out of that fallback (D1): they need their own route, not a generic scrape.
 *  `photo` has no dedicated handler yet — kept out of the fallback so an item with
 *  no fileId-driven route doesn't silently get scraped as if it were a web page. */
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

  if (type === 'youtube' || type === 'tiktok') {
    if (!item.originalUrl) {
      throw new Error(`Item ${itemId} has source type ${type} but no originalUrl.`);
    }

    await onStatusChange('extracting');

    const socialMediaHandler = options.handlers?.socialMediaHandler ?? (await loadSocialMediaHandler());
    const result = await socialMediaHandler(item.originalUrl, itemId);
    return { handled: true, title: result.title, content: result.content, description: '' };
  }

  const isWebSource =
    WEB_SOURCE_TYPES.has(type) || (!!item.originalUrl && !NON_WEB_SOURCE_TYPES.has(type));

  if (isWebSource) {
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
    return { handled: true, title: '', content: result.content, description: '' };
  }

  return { handled: false, title: '', content: item.rawInput, description: '' };
}
