import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import Tiktok from '@tobyg74/tiktok-api-dl';
import { ImageAnalysisService } from '../../../services/imageAnalysisService.js';
import { imageMimeType } from '../../../utils/media/imageMime.js';

interface CarouselHandlerResult {
  title: string;
  content: string;
}

/** Cap on slides sent to the model: carousels are usually under 10, and each
 *  image costs tokens. Truncation is logged rather than silent. */
const MAX_SLIDES = 12;

/**
 * Ingests a TikTok photo carousel (`/photo/` URLs).
 *
 * yt-dlp rejects these with "Unsupported URL", which is why they used to fall
 * through to generic web extraction and yield nothing but the og:description.
 * The scraper API exposes the slide images; the vision tier reads them.
 */
export async function tiktokCarouselHandler(url: string, itemId: string): Promise<CarouselHandlerResult> {
  console.log(`[TiktokCarousel] Fetching carousel for ${url}`);

  const response = (await Tiktok.Downloader(url, { version: 'v1' })) as any;
  if (response?.status !== 'success' || !response?.result) {
    throw new Error(`TikTok carousel fetch failed for ${url}: ${response?.message ?? 'unknown error'}`);
  }

  const result = response.result;
  const images: string[] = Array.isArray(result.images) ? result.images : [];
  if (images.length === 0) {
    throw new Error(`TikTok response for ${url} contains no carousel images.`);
  }

  const caption: string = result.desc ?? '';
  const author: string = result.author?.uniqueId ? `@${result.author.uniqueId}` : '';

  if (images.length > MAX_SLIDES) {
    console.warn(`[TiktokCarousel] ${images.length} slides found; analyzing the first ${MAX_SLIDES}.`);
  }
  const selected = images.slice(0, MAX_SLIDES);

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'carousel-'));
  try {
    const localPaths: string[] = [];
    for (const [index, imageUrl] of selected.entries()) {
      const res = await fetch(imageUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!res.ok) {
        throw new Error(`Failed to download carousel slide ${index}: status ${res.status}`);
      }
      // TikTok serves webp; keep the real extension so the data URI is labelled
      // correctly downstream.
      const ext = imageUrl.includes('.jpeg') || imageUrl.includes('.jpg') ? '.jpg' : '.webp';
      const slidePath = path.join(tempDir, `slide-${String(index).padStart(2, '0')}${ext}`);
      fs.writeFileSync(slidePath, Buffer.from(await res.arrayBuffer()));
      localPaths.push(slidePath);
    }

    console.log(
      `[TiktokCarousel] Downloaded ${localPaths.length} slides (${imageMimeType(localPaths[0]!)}). Reading with vision tier...`
    );

    const analysis = await ImageAnalysisService.analyze(localPaths, {
      kind: 'carrusel',
      ...(caption ? { caption } : {}),
      usageMeta: { flow: 'web_extraction', itemId },
    });

    const truncated =
      images.length > MAX_SLIDES
        ? `\n\n> Nota: el carrusel tiene ${images.length} diapositivas; se analizaron las primeras ${MAX_SLIDES}.`
        : '';

    const title = caption.trim().split('\n')[0]?.slice(0, 120) || `Carrusel de TikTok ${author}`.trim();

    return {
      title,
      content: `${analysis}${truncated}`,
    };
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}
