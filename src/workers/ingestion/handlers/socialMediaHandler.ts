import { YtDlpWrapper } from '../../../utils/media/ytDlpWrapper.js';
import { validateSocialMediaUrl } from '../../../utils/media/urlValidator.js';
import { runIngestionAgent } from '../../../agents/ingestionAgent.js';

interface SocialMediaHandlerResult {
  title: string;
  content: string;
  /** True when the visual analysis failed, so the entry is text-only. */
  visualAnalysisFailed: boolean;
  /** True when speech could not be transcribed, so the entry is visual-only. */
  transcriptionFailed: boolean;
  /** The platform's poster frame, for the dashboard preview. */
  thumbnailUrl: string | null;
}

/**
 * Handles downloading, transcribing, and visual analysis of YouTube/TikTok links.
 * Sanitizes URL first, downloads media to /tmp, runs LangGraph agent, and cleans up.
 */
export async function socialMediaHandler(url: string, itemId: string): Promise<SocialMediaHandlerResult> {
  console.log(`[SocialMediaHandler] Processing social media URL: ${url}`);

  // 1. Strict URL validation against command injection
  if (!validateSocialMediaUrl(url)) {
    throw new Error(`Rejected invalid or unsafe social media URL: "${url}"`);
  }

  // 2. Download and extract media streams (VTT, Audio, Keyframes)
  const media = await YtDlpWrapper.extractMedia(url);

  try {
    console.log(`[SocialMediaHandler] Invoking multimodal LangGraph Ingestion Agent...`);
    // 3. Invoke LangGraph agent
    const result = await runIngestionAgent({
      url,
      itemId,
      title: media.title,
      duration: media.duration,
      subtitlesText: media.subtitlesText,
      audioPath: media.audioPath,
      framePaths: media.framePaths,
    });

    return { ...result, thumbnailUrl: media.thumbnailUrl };
  } finally {
    // 4. Guaranteed cleanup to prevent disk leaks
    media.cleanup();
  }
}
