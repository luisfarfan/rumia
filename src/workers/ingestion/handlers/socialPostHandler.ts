import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ImageAnalysisService } from '../../../services/imageAnalysisService.js';
import { fetchOpenGraph } from '../../../utils/media/ogTags.js';
import { extensionForContentType } from '../../../utils/media/imageMime.js';

interface SocialPostHandlerResult {
  title: string;
  content: string;
  /** True when the post's image could not be read, so only the caption survived. */
  visualAnalysisFailed: boolean;
  /** The post's own image, kept for the dashboard preview. */
  thumbnailUrl: string | null;
}

/**
 * A platform exposes one post's content, not a feed's. A profile URL has nothing
 * to preview, so it yields the account bio — which would be stored as if it were
 * a post.
 *
 * Covers the post shapes of every routed platform: Instagram `/p/` `/reel/`,
 * Facebook `/posts/` `/permalink.php`, Threads and Bluesky `/post/`, X
 * `/status/`, Pinterest `/pin/`, and the `<author>/<numeric id>` shape used by
 * both Mastodon (`/@user/113…`) and Tumblr (`/blog/825…`).
 */
const POST_URL_PATTERN =
  /\/(p|reel|reels|tv|posts?|permalink\.php|photo|videos|share|status(?:es)?|pin)\b|\/[^/]+\/\d{6,}\/?$/i;

function extensionFor(imageUrl: string): string {
  const pathname = imageUrl.split('?')[0] ?? '';
  const ext = path.extname(pathname).toLowerCase();
  return ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext) ? ext : '.jpg';
}

/**
 * Ingests a public Instagram or Facebook post.
 *
 * No session is involved: Meta serves each post's caption, engagement and image
 * URL as Open Graph tags so that link previews work. Those tags are then combined
 * with a read of the image itself — for an image-first platform the picture is
 * most of the content, and the vision tier transcribes any text in it.
 */
export async function socialPostHandler(url: string, itemId: string): Promise<SocialPostHandlerResult> {
  if (!POST_URL_PATTERN.test(new URL(url).pathname)) {
    throw new Error(
      `${url} looks like a profile or feed, not a single post. ` +
        'Only individual public posts expose their content without a session.'
    );
  }

  console.log(`[SocialPost] Fetching Open Graph metadata for ${url}`);
  const og = await fetchOpenGraph(url);

  // The caption lives in og:title on Instagram and in og:description on Facebook,
  // so neither alone is enough — and if both are missing there is no content.
  const caption = og.title ?? og.description;
  if (!caption) {
    throw new Error(
      `No Open Graph content found for ${url}: the post may be private, deleted, or a feed.`
    );
  }

  const parts = [caption];
  if (og.description && og.description !== caption) parts.push(og.description);

  let visualAnalysisFailed = false;

  if (og.image) {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'metapost-'));
    let imagePath = '';
    try {
      const imageResponse = await fetch(og.image, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!imageResponse.ok) {
        throw new Error(`image download failed: status ${imageResponse.status}`);
      }

      // The served Content-Type wins over the URL: Facebook serves post images
      // from `.png` paths whose bytes are JPEG, and a mislabelled data URI is
      // rejected by the vision model.
      const ext = extensionForContentType(imageResponse.headers.get('content-type')) ?? extensionFor(og.image);
      imagePath = path.join(tempDir, `image${ext}`);
      fs.writeFileSync(imagePath, Buffer.from(await imageResponse.arrayBuffer()));

      const analysis = await ImageAnalysisService.analyze([imagePath], {
        kind: 'imagen',
        caption,
        usageMeta: { flow: 'web_extraction', itemId },
      });
      parts.push(`## Lectura de la imagen\n\n${analysis}`);
    } catch (err) {
      // The caption is still worth keeping; the entry is just degraded, and the
      // caller records why rather than storing the error as content.
      console.warn(`[SocialPost] Could not read the post image for ${url}:`, err);
      visualAnalysisFailed = true;
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  } else {
    console.warn(`[SocialPost] ${url} exposed no og:image.`);
  }

  const title = caption.split('\n')[0]?.slice(0, 120) || 'Publicación sin título';

  return { title, content: parts.join('\n\n'), visualAnalysisFailed, thumbnailUrl: og.image ?? null };
}
